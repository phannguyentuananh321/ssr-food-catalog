const { config } = require('../config/env');
const { safeNextPath } = require('../middleware/auth');
const { verifyRecaptcha } = require('../lib/recaptcha');
const { normalizeEmail } = require('../lib/tokens');
const { verifyTotp, verifyRecoveryCode } = require('../lib/mfa');
const prisma = require('../lib/prisma');
const {
  validateRegister,
  validateLogin,
  validateActivate,
  validateResendOtp,
  validateForgot,
  validatePasswordReset
} = require('../validators/auth.validator');
const { consumeFixedWindow } = require('../services/rate-limit.service');
const crypto = require('crypto');
const {
  registerUser,
  activateUser,
  resendActivationOtp,
  loginUser,
  requestPasswordReset,
  checkResetTokenValid,
  executePasswordReset
} = require('../services/custom-auth.service');

function authLocals(req, extra = {}) {
  return {
    currentPath: req.path,
    recaptchaSiteKey: config.RECAPTCHA_SITE_KEY,
    csrfToken: resLocalsCsrf(req),
    ...extra
  };
}

function resLocalsCsrf(req) {
  return (req.session && req.session.csrfToken) || '';
}

// ==========================================
// BƯỚC 4: ĐĂNG KÝ VÀ KÍCH HOẠT
// ==========================================

async function renderRegisterPage(req, res) {
  const flash = req.session.flash || {};
  delete req.session.flash;

  return res.render('auth/register', {
    pageTitle: 'Đăng Ký Tài Khoản',
    currentPath: req.path,
    recaptchaSiteKey: config.RECAPTCHA_SITE_KEY,
    csrfToken: resLocalsCsrf(req),
    values: { displayName: '', email: '' },
    errors: {},
    errorMessage: flash.errorMessage || null,
    notice: flash.notice || null
  });
}

async function register(req, res, next) {
  try {
    const ip = req.ip;
    const body = req.body || {};
    const values = {
      displayName: String(body.displayName || body.username || '').trim(),
      email: String(body.email || '').trim()
    };

    // 1. Rate limit register-ip:<ip> 5 lần/60 phút; vượt thì 429
    const rateLimitKey = `register-ip:${ip}`;
    const rate = await consumeFixedWindow(rateLimitKey, 5, 60 * 60 * 1000);
    if (!rate.allowed) {
      return res.status(429).render('errors/429', {
        pageTitle: 'Quá Nhiều Yêu Cầu',
        title: 'Giới Hạn Đăng Ký',
        message: `Bạn đã gửi quá nhiều yêu cầu đăng ký từ địa chỉ này. Vui lòng thử lại sau ${rate.retryAfterSeconds} giây.`
      });
    }

    // 2. Xác minh reCAPTCHA phía server; thiếu hoặc sai thì hiện lại form, không tạo user, không gửi OTP
    const captchaToken = body['g-recaptcha-response'] || body.recaptchaToken;
    const isCaptchaValid = await verifyRecaptcha(captchaToken, ip);
    if (!isCaptchaValid) {
      return res.status(200).render('auth/register', {
        pageTitle: 'Đăng Ký Tài Khoản',
        currentPath: req.path,
        recaptchaSiteKey: config.RECAPTCHA_SITE_KEY,
        csrfToken: resLocalsCsrf(req),
        values,
        errors: { captcha: 'Vui lòng xác minh mã reCAPTCHA hợp lệ.' },
        errorMessage: 'Xác minh reCAPTCHA không thành công.',
        notice: null
      });
    }

    // 3. Validate bằng Zod; lỗi thì render 200 với VALIDATION_FAILED, giữ email và tên, bỏ password
    const validation = validateRegister({
      email: values.email,
      displayName: values.displayName,
      password: String(body.password || ''),
      confirmPassword: String(body.confirmPassword || '')
    });

    if (!validation.success) {
      return res.status(200).render('auth/register', {
        pageTitle: 'Đăng Ký Tài Khoản',
        currentPath: req.path,
        recaptchaSiteKey: config.RECAPTCHA_SITE_KEY,
        csrfToken: resLocalsCsrf(req),
        values,
        errors: validation.errors,
        errorMessage: 'VALIDATION_FAILED: Vui lòng kiểm tra lại thông tin đăng ký.',
        notice: null
      });
    }

    // 4, 5, 6. Chuẩn hóa email, tạo User pending hoặc xử lý email đã có tài khoản
    const result = await registerUser({
      email: validation.data.email,
      displayName: validation.data.displayName,
      password: validation.data.password,
      ip
    });

    // Cả hai nhánh trả cùng thông báo và cùng 303 sang /activate qua flash trong session (không đưa vào URL)
    req.session.flash = {
      email: result.email,
      notice: result.notice
    };

    return res.redirect(303, '/activate');
  } catch (error) {
    return next(error);
  }
}

async function renderActivatePage(req, res) {
  const flash = req.session.flash || {};
  delete req.session.flash;

  return res.render('auth/activate', {
    pageTitle: 'Kích Hoạt Tài Khoản',
    currentPath: req.path,
    csrfToken: resLocalsCsrf(req),
    email: flash.email || '',
    errors: {},
    errorMessage: flash.errorMessage || null,
    notice: flash.notice || null
  });
}

async function activate(req, res, next) {
  try {
    const email = String(req.body.email || '').trim();
    const otp = String(req.body.otp || req.body.token || '').trim();

    const validation = validateActivate({ email, otp });
    if (!validation.success) {
      return res.status(200).render('auth/activate', {
        pageTitle: 'Kích Hoạt Tài Khoản',
        currentPath: req.path,
        csrfToken: resLocalsCsrf(req),
        email,
        errors: validation.errors,
        errorMessage: 'Vui lòng kiểm tra lại email và mã OTP (6 chữ số).',
        notice: null
      });
    }

    const result = await activateUser({ email, otp });

    if (!result.success) {
      if (result.status === 429) {
        return res.status(429).render('errors/429', {
          pageTitle: 'Tài Khoản Tạm Khóa',
          title: 'Nhập Sai Mã Quá Nhiều Lần',
          message: result.message
        });
      }

      return res.status(200).render('auth/activate', {
        pageTitle: 'Kích Hoạt Tài Khoản',
        currentPath: req.path,
        csrfToken: resLocalsCsrf(req),
        email,
        errors: { otp: result.message },
        errorMessage: result.message,
        notice: null
      });
    }

    // Kích hoạt thành công: 303 sang /login kèm thông báo; KHÔNG tạo session
    req.session.flash = {
      notice: 'Tài khoản của bạn đã được kích hoạt thành công! Vui lòng đăng nhập.'
    };
    return res.redirect(303, '/login');
  } catch (error) {
    return next(error);
  }
}

async function resendActivation(req, res, next) {
  try {
    const email = String(req.body.email || '').trim();
    const validation = validateResendOtp({ email });
    if (!validation.success) {
      return res.status(200).render('auth/activate', {
        pageTitle: 'Kích Hoạt Tài Khoản',
        currentPath: req.path,
        csrfToken: resLocalsCsrf(req),
        email,
        errors: validation.errors,
        errorMessage: 'Email không hợp lệ.',
        notice: null
      });
    }

    const result = await resendActivationOtp({ email });

    if (!result.success) {
      if (result.status === 429) {
        return res.status(429).render('errors/429', {
          pageTitle: 'Quá Nhiều Yêu Cầu',
          title: 'Chờ Trước Khi Gửi Lại Mã',
          message: result.message
        });
      }

      return res.status(200).render('auth/activate', {
        pageTitle: 'Kích Hoạt Tài Khoản',
        currentPath: req.path,
        csrfToken: resLocalsCsrf(req),
        email,
        errors: {},
        errorMessage: result.message,
        notice: null
      });
    }

    req.session.flash = {
      email: result.email,
      notice: result.notice
    };
    return res.redirect(303, '/activate');
  } catch (error) {
    return next(error);
  }
}

// ==========================================
// BƯỚC 5: ĐĂNG NHẬP VÀ CHỐNG BRUTE FORCE
// ==========================================

async function renderLoginPage(req, res) {
  const flash = req.session.flash || {};
  delete req.session.flash;

  const nextPath = safeNextPath(req.query.next);
  const email = flash.email || '';

  return res.render('auth/login', {
    pageTitle: 'Đăng Nhập',
    currentPath: req.path,
    csrfToken: resLocalsCsrf(req),
    recaptchaSiteKey: config.RECAPTCHA_SITE_KEY,
    email,
    errors: {},
    errorMessage: flash.errorMessage || null,
    notice: flash.notice || null,
    captchaRequired: Boolean(flash.captchaRequired),
    retryAfterSeconds: flash.retryAfterSeconds || 0,
    next: nextPath || ''
  });
}

async function login(req, res, next) {
  try {
    const ip = req.ip;
    const body = req.body || {};
    const email = String(body.email || '').trim();
    const password = String(body.password || '');
    const captchaToken = body['g-recaptcha-response'] || body.recaptchaToken;
    const nextPath = safeNextPath(body.next || req.query.next);

    const validation = validateLogin({ email, password });
    if (!validation.success) {
      return res.status(200).render('auth/login', {
        pageTitle: 'Đăng Nhập',
        currentPath: req.path,
        csrfToken: resLocalsCsrf(req),
        recaptchaSiteKey: config.RECAPTCHA_SITE_KEY,
        email,
        errors: validation.errors,
        errorMessage: 'Vui lòng nhập đầy đủ email và mật khẩu.',
        notice: null,
        captchaRequired: false,
        next: nextPath || ''
      });
    }

    const result = await loginUser({
      email: validation.data.email,
      password: validation.data.password,
      ip,
      captchaToken
    });

    if (!result.success) {
      if (result.status === 429) {
        return res.status(429).render('errors/429', {
          pageTitle: 'Tài Khoản Tạm Khóa',
          title: 'Đăng Nhập Thất Bại Quá Nhiều Lần',
          message: result.message
        });
      }

      return res.status(200).render('auth/login', {
        pageTitle: 'Đăng Nhập',
        currentPath: req.path,
        csrfToken: resLocalsCsrf(req),
        recaptchaSiteKey: config.RECAPTCHA_SITE_KEY,
        email: result.email || email,
        errors: result.error === 'CAPTCHA_REQUIRED' ? { captcha: result.message } : {},
        errorMessage: result.message,
        isPendingUser: Boolean(result.isPendingUser),
        notice: null,
        captchaRequired: Boolean(result.captchaRequired),
        next: nextPath || ''
      });
    }

    // Kiểm tra MFA: Nếu tài khoản đã kích hoạt 2FA, bắt buộc qua bước 2 (TOTP / Recovery Code)
    if (result.requiresMfa) {
      // TUYỆT ĐỐI KHÔNG GÁN req.session.userId Ở BƯỚC 1!
      // Chỉ gán đối tượng tạm thời mfaPending với TTL 5 phút
      req.session.mfaPending = {
        userId: result.user.id,
        email: result.user.email,
        expiresAt: Date.now() + 5 * 60 * 1000,
        attempts: 0,
        nextPath: nextPath || ''
      };

      return req.session.save((saveErr) => {
        if (saveErr) return next(saveErr);
        return res.redirect(303, '/login/2fa');
      });
    }

    // Đăng nhập thành công hoàn tất (không bật 2FA):
    // regenerate session (sid mới), gán userId, xóa bộ đếm login-email, 303 tới next an toàn hoặc /dishes
    req.session.regenerate((err) => {
      if (err) return next(err);

      req.session.userId = result.user.id;
      // Sinh csrf token mới cho session sau login
      req.session.csrfToken = crypto.randomBytes(32).toString('hex');

      req.session.save((saveErr) => {
        if (saveErr) return next(saveErr);
        const target = nextPath || '/dishes';
        return res.redirect(303, target);
      });
    });
  } catch (error) {
    return next(error);
  }
}

// ==========================================
// BƯỚC 6: ĐĂNG XUẤT
// ==========================================

async function logout(req, res, next) {
  try {
    if (!req.session) {
      res.clearCookie('sid', { path: '/' });
      return res.redirect(303, '/login');
    }

    // 1. Hủy bản ghi session ở store trước
    req.session.destroy((err) => {
      if (err) {
        console.error('[LOGOUT ERROR]:', err.message);
      }
      // 2. Xóa cookie sid
      res.clearCookie('sid', { path: '/' });
      // 3. 303 tới /login
      return res.redirect(303, '/login');
    });
  } catch (error) {
    return next(error);
  }
}

// ==========================================
// BƯỚC 7: QUÊN MẬT KHẨU & ĐẶT LẠI MẬT KHẨU
// ==========================================

async function renderForgotPage(req, res) {
  const flash = req.session.flash || {};
  delete req.session.flash;

  return res.render('auth/forgot-password', {
    pageTitle: 'Quên Mật Khẩu',
    currentPath: req.path,
    csrfToken: resLocalsCsrf(req),
    email: flash.email || '',
    errors: {},
    errorMessage: flash.errorMessage || null,
    notice: flash.notice || null
  });
}

async function forgotPassword(req, res, next) {
  try {
    const email = String(req.body.email || '').trim();
    const validation = validateForgot({ email });
    if (!validation.success) {
      return res.status(200).render('auth/forgot-password', {
        pageTitle: 'Quên Mật Khẩu',
        currentPath: req.path,
        csrfToken: resLocalsCsrf(req),
        email,
        errors: validation.errors,
        errorMessage: 'Email không đúng định dạng.',
        notice: null
      });
    }

    const result = await requestPasswordReset({
      email: validation.data.email,
      ip: req.ip
    });

    if (!result.success && result.status === 429) {
      return res.status(429).render('errors/429', {
        pageTitle: 'Quá Nhiều Yêu Cầu',
        title: 'Giới Hạn Yêu Cầu Quên Mật Khẩu',
        message: result.message
      });
    }

    req.session.flash = {
      notice: result.notice
    };
    return res.redirect(303, '/forgot');
  } catch (error) {
    return next(error);
  }
}

async function renderResetPage(req, res, next) {
  try {
    // Header Referrer-Policy: no-referrer cho /reset
    res.setHeader('Referrer-Policy', 'no-referrer');

    const token = String(req.query.token || '').trim();
    const tokenCheck = await checkResetTokenValid(token);

    return res.render('auth/reset-password', {
      pageTitle: 'Đặt Lại Mật Khẩu',
      currentPath: req.path,
      csrfToken: resLocalsCsrf(req),
      token,
      isValidToken: tokenCheck.valid,
      tokenError: tokenCheck.valid ? null : tokenCheck.message,
      errors: {},
      errorMessage: null,
      notice: null
    });
  } catch (error) {
    return next(error);
  }
}

async function resetPassword(req, res, next) {
  try {
    // Header Referrer-Policy: no-referrer cho /reset
    res.setHeader('Referrer-Policy', 'no-referrer');

    const token = String(req.body.token || '').trim();
    const password = String(req.body.password || '');
    const confirmPassword = String(req.body.confirmPassword || '');

    const validation = validatePasswordReset({ token, password, confirmPassword });
    if (!validation.success) {
      return res.status(200).render('auth/reset-password', {
        pageTitle: 'Đặt Lại Mật Khẩu',
        currentPath: req.path,
        csrfToken: resLocalsCsrf(req),
        token,
        isValidToken: true,
        errors: validation.errors,
        errorMessage: 'Vui lòng kiểm tra lại thông tin mật khẩu mới.',
        notice: null
      });
    }

    const result = await executePasswordReset({
      token: validation.data.token,
      newPassword: validation.data.password
    });

    if (!result.success) {
      return res.status(200).render('auth/reset-password', {
        pageTitle: 'Đặt Lại Mật Khẩu',
        currentPath: req.path,
        csrfToken: resLocalsCsrf(req),
        token,
        isValidToken: false,
        tokenError: result.message,
        errors: {},
        errorMessage: result.message,
        notice: null
      });
    }

    // Đổi mật khẩu thành công: 303 tới /login kèm flash; KHÔNG tự đăng nhập
    req.session.flash = {
      notice: 'Mật khẩu đã được thay đổi thành công! Vui lòng đăng nhập với mật khẩu mới.'
    };
    return res.redirect(303, '/login');
  } catch (error) {
    return next(error);
  }
}

// ==========================================
// BƯỚC 5B: XÁC THỰC 2 LỚP (MFA / TOTP)
// ==========================================

async function renderMfaPage(req, res) {
  const pending = req.session.mfaPending;
  if (!pending || Date.now() > pending.expiresAt) {
    delete req.session.mfaPending;
    return res.redirect(303, '/login');
  }

  const remainingAttempts = Math.max(0, 5 - (pending.attempts || 0));

  return res.render('auth/mfa', {
    pageTitle: 'Xác Thực 2 Bước (2FA)',
    currentPath: req.path,
    csrfToken: resLocalsCsrf(req),
    email: pending.email || '',
    errors: {},
    errorMessage: null,
    remainingAttempts
  });
}

async function verifyMfa(req, res, next) {
  try {
    const pending = req.session.mfaPending;
    if (!pending || Date.now() > pending.expiresAt) {
      delete req.session.mfaPending;
      return res.redirect(303, '/login');
    }

    const rawCode = String(req.body.code || '').trim();
    if (!rawCode) {
      return res.status(200).render('auth/mfa', {
        pageTitle: 'Xác Thực 2 Bước (2FA)',
        currentPath: req.path,
        csrfToken: resLocalsCsrf(req),
        email: pending.email || '',
        errors: { code: 'Vui lòng nhập mã xác thực hoặc mã dự phòng.' },
        errorMessage: 'Vui lòng nhập mã xác thực từ Google Authenticator hoặc mã dự phòng.',
        remainingAttempts: Math.max(0, 5 - (pending.attempts || 0))
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: pending.userId },
      include: { recoveryCodes: true }
    });

    if (!user || !user.twoFactorEnabled) {
      delete req.session.mfaPending;
      return res.redirect(303, '/login');
    }

    let isValid = false;
    let usedRecoveryCodeId = null;

    // 1. Kiểm tra mã TOTP 6 số
    if (/^\d{6}$/.test(rawCode)) {
      isValid = verifyTotp(rawCode, user.twoFactorSecret);
    }

    // 2. Nếu không phải TOTP hoặc TOTP sai, kiểm tra xem có khớp Recovery Code chưa dùng không
    if (!isValid && user.recoveryCodes && user.recoveryCodes.length > 0) {
      const unusedCodes = user.recoveryCodes.filter(rc => !rc.usedAt);
      for (const rc of unusedCodes) {
        if (verifyRecoveryCode(rawCode, rc.codeHash)) {
          isValid = true;
          usedRecoveryCodeId = rc.id;
          break;
        }
      }
    }

    // HỢP LỆ:
    if (isValid) {
      // Nếu là recovery code, đánh dấu usedAt ngay lập tức (Single-use)
      if (usedRecoveryCodeId) {
        await prisma.recoveryCode.update({
          where: { id: usedRecoveryCodeId },
          data: { usedAt: new Date() }
        });
      }

      // Xóa bộ đếm login-email
      const { resetRateLimitKey } = require('../services/rate-limit.service');
      await resetRateLimitKey(`login-email:${user.emailNormalized}`);

      const target = pending.nextPath || '/dishes';
      delete req.session.mfaPending;

      // Cấp session đăng nhập chính thức
      return req.session.regenerate((err) => {
        if (err) return next(err);
        req.session.userId = user.id;
        req.session.csrfToken = crypto.randomBytes(32).toString('hex');

        req.session.save((saveErr) => {
          if (saveErr) return next(saveErr);
          return res.redirect(303, target);
        });
      });
    }

    // KHÔNG HỢP LỆ:
    pending.attempts = (pending.attempts || 0) + 1;
    const emailKey = `login-email:${user.emailNormalized}`;
    const ipKey = `login-ip:${req.ip}`;
    const { incrementRateLimit, setRateLimitLock } = require('../services/rate-limit.service');
    await incrementRateLimit(emailKey, 15 * 60 * 1000);
    await incrementRateLimit(ipKey, 15 * 60 * 1000);

    // Nếu nhập sai từ 5 lần trở lên: KHÓA TẠM 15 PHÚT, HỦY mfaPending, trả 429
    if (pending.attempts >= 5) {
      const lockUntil = new Date(Date.now() + 15 * 60 * 1000);
      await setRateLimitLock(emailKey, lockUntil);
      await setRateLimitLock(ipKey, lockUntil);
      delete req.session.mfaPending;

      return res.status(429).render('errors/429', {
        pageTitle: 'Tài Khoản Tạm Khóa',
        title: 'Xác Thực 2 Bước Thất Bại Quá 5 Lần',
        message: 'Bạn đã nhập sai mã xác thực quá 5 lần. Để bảo vệ tài khoản, hệ thống tạm khóa đăng nhập trong 15 phút. Khi quay lại đăng nhập, bạn sẽ cần giải mã reCAPTCHA.'
      });
    }

    const remaining = 5 - pending.attempts;
    return res.status(200).render('auth/mfa', {
      pageTitle: 'Xác Thực 2 Bước (2FA)',
      currentPath: req.path,
      csrfToken: resLocalsCsrf(req),
      email: pending.email || '',
      errors: { code: 'Mã xác thực không chính xác.' },
      errorMessage: `Mã xác thực không chính xác. Bạn còn ${remaining} lần thử trước khi tài khoản bị khóa tạm thời.`,
      remainingAttempts: remaining
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  renderRegisterPage,
  register,
  renderActivatePage,
  activate,
  resendActivation,
  renderLoginPage,
  login,
  renderMfaPage,
  verifyMfa,
  logout,
  renderForgotPage,
  forgotPassword,
  renderResetPage,
  resetPassword
};
