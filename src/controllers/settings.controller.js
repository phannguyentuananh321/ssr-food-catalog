const prisma = require('../lib/prisma');
const { verifyPassword } = require('../lib/password');
const {
  generateMfaSecret,
  generateKeyuri,
  generateQrCodeDataUrl,
  verifyTotp,
  generateRecoveryCodes,
  hashRecoveryCode
} = require('../lib/mfa');

function resLocalsCsrf(req) {
  return (req.session && req.session.csrfToken) || (req.res && req.res.locals && req.res.locals.csrfToken) || '';
}

/**
 * Hiển thị trang Cài đặt bảo mật (2FA & Profile)
 */
async function renderSecuritySettings(req, res, next) {
  try {
    const flash = req.session.flash || {};
    delete req.session.flash;

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { recoveryCodes: true }
    });

    if (!user) {
      return res.redirect(303, '/login');
    }

    const unusedRecoveryCodesCount = (user.recoveryCodes || []).filter(rc => !rc.usedAt).length;
    const totalRecoveryCodesCount = (user.recoveryCodes || []).length;

    // Lấy thông tin thiết lập 2FA tạm thời nếu đang mở form setup
    const temp2fa = req.session.temp2fa || null;

    return res.render('settings/security', {
      pageTitle: 'Cài Đặt Bảo Mật',
      currentPath: req.path,
      csrfToken: resLocalsCsrf(req),
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName || user.email.split('@')[0],
        role: user.role,
        twoFactorEnabled: user.twoFactorEnabled
      },
      unusedRecoveryCodesCount,
      totalRecoveryCodesCount,
      temp2fa,
      newlyCreatedRecoveryCodes: flash.newlyCreatedRecoveryCodes || null,
      errorMessage: flash.errorMessage || null,
      notice: flash.notice || null
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * Bắt đầu thiết lập 2FA: sinh secret, QR code và mã dự phòng lưu tạm trong session
 */
async function start2faSetup(req, res, next) {
  try {
    const secret = generateMfaSecret();
    const keyuri = generateKeyuri(req.user.email, secret, 'Ấm Vị');
    const qrCodeDataUrl = await generateQrCodeDataUrl(keyuri);
    const recoveryCodes = generateRecoveryCodes(10);

    // Lưu tạm trong session, KHÔNG lưu vào DB cho đến khi xác nhận mã đầu tiên thành công
    req.session.temp2fa = {
      secret,
      qrCodeDataUrl,
      recoveryCodes
    };

    return req.session.save((err) => {
      if (err) return next(err);
      return res.redirect(303, '/settings/security');
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * Hủy bỏ quá trình thiết lập 2FA đang dở dang
 */
async function cancel2faSetup(req, res, next) {
  try {
    delete req.session.temp2fa;
    return req.session.save((err) => {
      if (err) return next(err);
      return res.redirect(303, '/settings/security');
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * Xác nhận mã 6 số đầu tiên để CHÍNH THỨC kích hoạt 2FA
 */
async function confirm2fa(req, res, next) {
  try {
    const temp2fa = req.session.temp2fa;
    if (!temp2fa || !temp2fa.secret) {
      req.session.flash = { errorMessage: 'Phiên thiết lập 2FA đã hết hạn. Vui lòng thử lại.' };
      return req.session.save(() => res.redirect(303, '/settings/security'));
    }

    const code = String(req.body.code || '').trim();
    const isValid = verifyTotp(code, temp2fa.secret);

    if (!isValid) {
      req.session.flash = {
        errorMessage: 'Mã xác thực không chính xác. Vui lòng kiểm tra lại đồng hồ điện thoại và mã trên Google Authenticator.'
      };
      return req.session.save(() => res.redirect(303, '/settings/security'));
    }

    // Mã đúng: Chính thức lưu vào DB và cấp 10 mã dự phòng
    const plainCodes = temp2fa.recoveryCodes || generateRecoveryCodes(10);

    await prisma.$transaction(async (tx) => {
      // 1. Cập nhật User
      await tx.user.update({
        where: { id: req.user.id },
        data: {
          twoFactorEnabled: true,
          twoFactorSecret: temp2fa.secret
        }
      });

      // 2. Vô hiệu hóa/Xóa mã cũ nếu có
      await tx.recoveryCode.deleteMany({
        where: { userId: req.user.id }
      });

      // 3. Tạo 10 bản ghi RecoveryCode với SHA-256 hash
      await tx.recoveryCode.createMany({
        data: plainCodes.map(plainCode => ({
          userId: req.user.id,
          codeHash: hashRecoveryCode(plainCode)
        }))
      });
    });

    // Xóa session tạm
    delete req.session.temp2fa;

    // Flash mã bản rõ để người dùng tải về/chép đúng 1 lần duy nhất
    req.session.flash = {
      notice: 'Kích hoạt xác thực 2 bước (2FA) thành công! Hãy lưu lại danh sách 10 mã dự phòng bên dưới.',
      newlyCreatedRecoveryCodes: plainCodes
    };

    // Chuyển hướng về trang chủ (/dishes) theo đúng yêu cầu
    return req.session.save((saveErr) => {
      if (saveErr) return next(saveErr);
      return res.redirect(303, '/dishes');
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * Tắt xác thực 2 bước: BẮT BUỘC NHẬP CẢ MẬT KHẨU VÀ MÃ TOTP 6 SỐ
 */
async function disable2fa(req, res, next) {
  try {
    const password = String(req.body.password || '');
    const code = String(req.body.code || '').trim();

    if (!password || !code) {
      req.session.flash = { errorMessage: 'Vui lòng nhập đầy đủ mật khẩu hiện tại và mã xác thực Google Authenticator để tắt 2FA.' };
      return req.session.save(() => res.redirect(303, '/settings/security'));
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      req.session.flash = { errorMessage: 'Tài khoản chưa bật tính năng 2FA.' };
      return req.session.save(() => res.redirect(303, '/settings/security'));
    }

    // 1. Kiểm tra mật khẩu (Yếu tố 1: Thứ bạn biết)
    const isPasswordOk = await verifyPassword(user.passwordHash, password);
    if (!isPasswordOk) {
      req.session.flash = { errorMessage: 'Mật khẩu hiện tại không chính xác. Không thể tắt bảo vệ 2 lớp.' };
      return req.session.save(() => res.redirect(303, '/settings/security'));
    }

    // 2. Kiểm tra mã TOTP (Yếu tố 2: Thứ bạn sở hữu)
    const isTotpOk = verifyTotp(code, user.twoFactorSecret);
    if (!isTotpOk) {
      req.session.flash = { errorMessage: 'Mã xác thực Google Authenticator không chính xác. Không thể tắt bảo vệ 2 lớp.' };
      return req.session.save(() => res.redirect(303, '/settings/security'));
    }

    // Cả 2 đều đúng -> Tắt 2FA và xóa toàn bộ mã dự phòng
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: req.user.id },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null
        }
      });

      await tx.recoveryCode.deleteMany({
        where: { userId: req.user.id }
      });
    });

    req.session.flash = { notice: 'Đã tắt tính năng xác thực 2 bước (2FA) thành công.' };
    return req.session.save((err) => {
      if (err) return next(err);
      return res.redirect(303, '/settings/security');
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * Sinh lại nhóm mã dự phòng mới (Vô hiệu hóa toàn bộ nhóm cũ)
 * BẮT BUỘC XÁC THỰC LẠI BẰNG MẬT KHẨU + MÃ TOTP
 */
async function regenerateRecoveryCodes(req, res, next) {
  try {
    const password = String(req.body.password || '');
    const code = String(req.body.code || '').trim();

    if (!password || !code) {
      req.session.flash = { errorMessage: 'Vui lòng nhập mật khẩu và mã Google Authenticator để tạo lại mã dự phòng.' };
      return req.session.save(() => res.redirect(303, '/settings/security'));
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      req.session.flash = { errorMessage: 'Tài khoản chưa bật tính năng 2FA.' };
      return req.session.save(() => res.redirect(303, '/settings/security'));
    }

    // Kiểm tra Password và TOTP
    const isPasswordOk = await verifyPassword(user.passwordHash, password);
    const isTotpOk = verifyTotp(code, user.twoFactorSecret);

    if (!isPasswordOk || !isTotpOk) {
      req.session.flash = { errorMessage: 'Mật khẩu hoặc mã xác thực không chính xác. Không thể tạo lại mã dự phòng.' };
      return req.session.save(() => res.redirect(303, '/settings/security'));
    }

    // Sinh 10 mã dự phòng mới
    const plainCodes = generateRecoveryCodes(10);

    // Transaction: Xóa nhóm mã cũ -> Tạo nhóm mã mới
    await prisma.$transaction(async (tx) => {
      await tx.recoveryCode.deleteMany({
        where: { userId: req.user.id }
      });

      await tx.recoveryCode.createMany({
        data: plainCodes.map(c => ({
          userId: req.user.id,
          codeHash: hashRecoveryCode(c)
        }))
      });
    });

    req.session.flash = {
      notice: 'Đã tạo lại bộ mã dự phòng mới thành công! Toàn bộ mã cũ đã bị vô hiệu hóa.',
      newlyCreatedRecoveryCodes: plainCodes
    };

    return req.session.save((err) => {
      if (err) return next(err);
      return res.redirect(303, '/settings/security');
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  renderSecuritySettings,
  start2faSetup,
  cancel2faSetup,
  confirm2fa,
  disable2fa,
  regenerateRecoveryCodes
};
