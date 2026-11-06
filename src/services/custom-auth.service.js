const crypto = require('crypto');
const prisma = require('../lib/prisma');
const { config } = require('../config/env');
const { hashPassword, verifyPassword, verifyDummy } = require('../lib/password');
const {
  normalizeEmail,
  generateOtp,
  hashOtp,
  verifyOtp,
  generateResetToken,
  hashResetToken,
  verifyResetToken
} = require('../lib/tokens');
const {
  consumeFixedWindow,
  recordLoginFailure,
  resetRateLimitKey,
  getRateLimitStatus,
  isKeyLocked
} = require('./rate-limit.service');
const {
  sendActivationOtp,
  sendPasswordResetLink,
  sendPasswordChangedNotice
} = require('./mailer.service');

const INVALID_OTP_MESSAGE = 'Mã xác thực không hợp lệ hoặc đã hết hạn.';
const GENERIC_REGISTER_NOTICE = 'Mã kích hoạt đã được gửi đến email của bạn nếu thông tin hợp lệ.';

/**
 * BƯỚC 4: Đăng ký tài khoản mới
 */
async function registerUser({ email, displayName, password, ip }) {
  const normalizedEmail = normalizeEmail(email);

  // Tra cứu tài khoản theo email chuẩn hóa
  const existingUser = await prisma.user.findUnique({
    where: { emailNormalized: normalizedEmail }
  });

  if (existingUser) {
    // Email đã có tài khoản: không tạo bản ghi thứ hai, không gửi gì,
    // vẫn băm một password giả để cân bằng thời gian CPU (mitigate timing attacks)
    await verifyDummy(password);
    return {
      success: true,
      email: normalizedEmail,
      notice: GENERIC_REGISTER_NOTICE
    };
  }

  // Email mới: băm password thật bằng Argon2id
  const passwordHash = await hashPassword(password);
  const otp = generateOtp();
  const userId = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // Hạn 10 phút
  const otpHash = hashOtp(userId, 'activation', otp);

  // Tạo User pending và ActivationChallenge trong transaction
  await prisma.$transaction(async (tx) => {
    await tx.user.create({
      data: {
        id: userId,
        email, // email nhập gốc
        emailNormalized: normalizedEmail,
        displayName: displayName || null,
        passwordHash,
        role: 'viewer', // mọi trường role từ client bị bỏ qua
        status: 'pending',
        activationChallenge: {
          create: {
            purpose: 'activation',
            otpHash,
            expiresAt,
            attempts: 0,
            lastSentAt: now,
            sendCount: 1,
            sendWindowStart: now
          }
        }
      }
    });
  });

  // Gửi OTP qua email đồng bộ; nếu lỗi sẽ ném Exception (500), user vẫn pending trong DB
  await sendActivationOtp(email, otp);

  return {
    success: true,
    email: normalizedEmail,
    notice: GENERIC_REGISTER_NOTICE
  };
}

/**
 * BƯỚC 4: Kích hoạt tài khoản bằng OTP
 */
async function activateUser({ email, otp }) {
  const normalizedEmail = normalizeEmail(email);
  const now = new Date();

  const user = await prisma.user.findUnique({
    where: { emailNormalized: normalizedEmail },
    include: { activationChallenge: true }
  });

  // User không tồn tại hoặc không ở trạng thái pending
  if (!user || user.status !== 'pending' || !user.activationChallenge) {
    return { success: false, error: 'INVALID_OTP', message: INVALID_OTP_MESSAGE };
  }

  const challenge = user.activationChallenge;

  // Đang bị khóa (attempts >= 5 đã khóa trước đó)
  if (challenge.lockedUntil && challenge.lockedUntil.getTime() > now.getTime()) {
    const retryAfter = Math.ceil((challenge.lockedUntil.getTime() - now.getTime()) / 1000);
    return {
      success: false,
      error: 'LOCKED',
      status: 429,
      message: `Tài khoản tạm thời bị khóa do nhập sai mã nhiều lần. Vui lòng thử lại sau ${retryAfter} giây.`,
      retryAfter
    };
  }

  // Kiểm tra điều kiện: purpose === 'activation', chưa hết hạn, usedAt rỗng, attempts < 5
  const isPurposeValid = challenge.purpose === 'activation';
  const isNotExpired = challenge.expiresAt.getTime() > now.getTime();
  const isNotUsed = challenge.usedAt === null;
  const isAttemptsValid = challenge.attempts < 5;
  const isHashMatch = verifyOtp(challenge.otpHash, user.id, 'activation', otp);

  const isValid = isPurposeValid && isNotExpired && isNotUsed && isAttemptsValid && isHashMatch;

  if (!isValid) {
    // Sai vì bất kỳ lý do nào: tăng attempts, kiểm tra ngưỡng 5
    const nextAttempts = challenge.attempts + 1;
    let lockedUntil = challenge.lockedUntil;
    let isNowLocked = false;

    if (nextAttempts >= 5) {
      lockedUntil = new Date(now.getTime() + 15 * 60 * 1000); // Khóa 15 phút
      isNowLocked = true;
    }

    await prisma.activationChallenge.update({
      where: { id: challenge.id },
      data: {
        attempts: nextAttempts,
        lockedUntil
      }
    });

    if (isNowLocked) {
      return {
        success: false,
        error: 'LOCKED',
        status: 429,
        message: 'Bạn đã nhập sai mã OTP 5 lần. Vui lòng thử lại sau 15 phút.',
        retryAfter: 15 * 60
      };
    }

    return { success: false, error: 'INVALID_OTP', message: INVALID_OTP_MESSAGE };
  }

  // Hợp lệ: Chạy transaction với cập nhật có điều kiện (usedAt: null) để chống race condition
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.activationChallenge.updateMany({
      where: {
        id: challenge.id,
        usedAt: null
      },
      data: {
        usedAt: now
      }
    });

    if (updated.count === 0) {
      // Bị request đồng thời khác sử dụng trước
      return null;
    }

    // Kích hoạt user
    await tx.user.update({
      where: { id: user.id },
      data: {
        status: 'active',
        emailVerifiedAt: now
      }
    });

    return true;
  });

  if (!result) {
    return { success: false, error: 'INVALID_OTP', message: INVALID_OTP_MESSAGE };
  }

  return { success: true };
}

/**
 * BƯỚC 4: Gửi lại mã kích hoạt
 */
async function resendActivationOtp({ email }) {
  const normalizedEmail = normalizeEmail(email);
  const now = new Date();

  const user = await prisma.user.findUnique({
    where: { emailNormalized: normalizedEmail },
    include: { activationChallenge: true }
  });

  // Phản hồi giống nhau dù email có hay không
  if (!user || user.status !== 'pending' || !user.activationChallenge) {
    return {
      success: true,
      email: normalizedEmail,
      notice: 'Nếu email tồn tại và chưa kích hoạt, mã xác thực mới đã được gửi.'
    };
  }

  const challenge = user.activationChallenge;

  // Đang bị khóa thì không gửi lại được, trả 429
  if (challenge.lockedUntil && challenge.lockedUntil.getTime() > now.getTime()) {
    const retryAfter = Math.ceil((challenge.lockedUntil.getTime() - now.getTime()) / 1000);
    return {
      success: false,
      status: 429,
      error: 'LOCKED',
      message: `Tài khoản đang tạm khóa thử lại. Vui lòng chờ ${retryAfter} giây.`,
      retryAfter
    };
  }

  // Cách lần gửi trước ít nhất 60 giây
  const secondsSinceLastSent = (now.getTime() - challenge.lastSentAt.getTime()) / 1000;
  if (secondsSinceLastSent < 60) {
    const waitSeconds = Math.ceil(60 - secondsSinceLastSent);
    return {
      success: false,
      status: 429,
      error: 'TOO_FREQUENT',
      message: `Vui lòng chờ ít nhất ${waitSeconds} giây trước khi yêu cầu mã mới.`,
      retryAfter: waitSeconds
    };
  }

  // Tối đa 5 lần/giờ
  const windowElapsed = now.getTime() - challenge.sendWindowStart.getTime();
  let nextSendCount = challenge.sendCount;
  let nextWindowStart = challenge.sendWindowStart;

  if (windowElapsed >= 60 * 60 * 1000) {
    // Cửa sổ 1 giờ mới
    nextSendCount = 1;
    nextWindowStart = now;
  } else {
    if (nextSendCount >= 5) {
      const waitMinutes = Math.ceil((60 * 60 * 1000 - windowElapsed) / 60000);
      return {
        success: false,
        status: 429,
        error: 'LIMIT_EXCEEDED',
        message: `Bạn đã vượt quá giới hạn 5 lần gửi mã trong 1 giờ. Vui lòng thử lại sau ${waitMinutes} phút.`,
        retryAfter: waitMinutes * 60
      };
    }
    nextSendCount += 1;
  }

  // Sinh OTP mới ghi đè otpHash, hạn mới 10 phút; attempts KHÔNG về 0, lockedUntil giữ nguyên
  const newOtp = generateOtp();
  const newExpiresAt = new Date(now.getTime() + 10 * 60 * 1000);
  const newOtpHash = hashOtp(user.id, 'activation', newOtp);

  await prisma.activationChallenge.update({
    where: { id: challenge.id },
    data: {
      otpHash: newOtpHash,
      expiresAt: newExpiresAt,
      usedAt: null,
      lastSentAt: now,
      sendCount: nextSendCount,
      sendWindowStart: nextWindowStart
    }
  });

  // Gửi OTP đồng bộ
  await sendActivationOtp(user.email, newOtp);

  return {
    success: true,
    email: normalizedEmail,
    notice: 'Mã xác thực mới đã được gửi tới email của bạn.'
  };
}

const GENERIC_LOGIN_ERROR = 'Email hoặc mật khẩu không chính xác.';
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 phút
const LOGIN_LOCK_DURATION_MS = 5 * 60 * 1000; // 5 phút

/**
 * BƯỚC 5: Xử lý đăng nhập và chống Brute Force
 */
async function loginUser({ email, password, ip, captchaToken }) {
  const normalizedEmail = normalizeEmail(email);
  const emailKey = `login-email:${normalizedEmail}`;
  const ipKey = `login-ip:${ip}`;

  // 1. Kiểm tra khóa: Nếu login-ip hoặc login-email đang lockedUntil thì 429
  // (kể cả CAPTCHA đúng, KHÔNG kiểm tra password)
  const emailStatus = await getRateLimitStatus(emailKey, LOGIN_WINDOW_MS);
  const ipStatus = await getRateLimitStatus(ipKey, LOGIN_WINDOW_MS);

  if (emailStatus.locked || ipStatus.locked) {
    const lockedUntil = (emailStatus.locked && emailStatus.lockedUntil) || ipStatus.lockedUntil;
    const retryAfter = lockedUntil ? Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 1000)) : 300;
    return {
      status: 429,
      error: 'LOCKED',
      message: `Tài khoản hoặc địa chỉ IP đang tạm khóa do nhiều lần đăng nhập không thành công. Vui lòng thử lại sau ${retryAfter} giây.`,
      retryAfterSeconds: retryAfter
    };
  }

  // 2. Nếu số lần sai của email từ 3 trở lên thì bắt buộc reCAPTCHA hợp lệ
  const captchaRequired = emailStatus.count >= 3;
  if (captchaRequired) {
    const { verifyRecaptcha } = require('../lib/recaptcha');
    const isCaptchaOk = await verifyRecaptcha(captchaToken, ip);
    if (!isCaptchaOk) {
      // Thiếu hoặc sai thì hiện lại form kèm widget mới, giữ email, bỏ password, KHÔNG kiểm tra password
      return {
        status: 200,
        error: 'CAPTCHA_REQUIRED',
        captchaRequired: true,
        message: 'Vui lòng xác minh mã reCAPTCHA.',
        email: normalizedEmail
      };
    }
  }

  // 3. Tra user theo email chuẩn hóa, verify Argon2id (user không tồn tại thì verify với hash giả)
  const user = await prisma.user.findUnique({
    where: { emailNormalized: normalizedEmail }
  });

  let isPasswordValid = false;
  if (user) {
    isPasswordValid = await verifyPassword(user.passwordHash, password);
  } else {
    isPasswordValid = await verifyDummy(password);
  }

  // 4. Sai (kể cả email không tồn tại)
  if (!isPasswordValid) {
    // Tăng bộ đếm email (ngưỡng 10 khóa 5 phút)
    const updatedEmailThrottle = await recordLoginFailure(emailKey, LOGIN_WINDOW_MS, 10, LOGIN_LOCK_DURATION_MS);
    // Tăng bộ đếm IP (ngưỡng 30 khóa 5 phút)
    const updatedIpThrottle = await recordLoginFailure(ipKey, LOGIN_WINDOW_MS, 30, LOGIN_LOCK_DURATION_MS);

    // Kiểm tra xem có bị khóa ngay sau lần này không
    const isNowLocked = Boolean(
      (updatedEmailThrottle.lockedUntil && updatedEmailThrottle.lockedUntil.getTime() > Date.now()) ||
      (updatedIpThrottle.lockedUntil && updatedIpThrottle.lockedUntil.getTime() > Date.now())
    );

    if (isNowLocked) {
      const lockedUntil = (updatedEmailThrottle.lockedUntil && updatedEmailThrottle.lockedUntil.getTime() > Date.now())
        ? updatedEmailThrottle.lockedUntil
        : updatedIpThrottle.lockedUntil;
      const retryAfter = Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 1000));
      return {
        status: 429,
        error: 'LOCKED',
        message: `Bạn đã nhập sai quá số lần cho phép. Tạm khóa trong ${retryAfter} giây.`,
        retryAfterSeconds: retryAfter
      };
    }

    const nextCaptchaRequired = updatedEmailThrottle.count >= 3;
    return {
      status: 200,
      error: 'INVALID_CREDENTIALS',
      message: GENERIC_LOGIN_ERROR,
      captchaRequired: nextCaptchaRequired,
      email: normalizedEmail
    };
  }

  // 5. Password đúng nhưng tài khoản pending: không tạo session, không tính là một lần sai,
  // báo cần kích hoạt kèm link tới /activate
  if (user.status === 'pending') {
    return {
      status: 200,
      error: 'ACCOUNT_PENDING',
      isPendingUser: true,
      message: 'Tài khoản của bạn chưa được kích hoạt. Vui lòng nhập mã OTP để kích hoạt.',
      email: normalizedEmail
    };
  }

  // 6. Thành công: xóa bộ đếm login-email (không xóa login-ip)
  await resetRateLimitKey(emailKey);

  return {
    success: true,
    user
  };
}

const GENERIC_FORGOT_NOTICE = 'Nếu email đã đăng ký, hướng dẫn đã được gửi.';

/**
 * BƯỚC 7: Yêu cầu đặt lại mật khẩu
 */
async function requestPasswordReset({ email, ip }) {
  const normalizedEmail = normalizeEmail(email);
  const emailKey = `forgot-email:${normalizedEmail}`;
  const ipKey = `forgot-ip:${ip}`;

  // Rate limit: forgot-email 3/giờ và forgot-ip 10/giờ, vượt thì 429
  const emailRate = await consumeFixedWindow(emailKey, 3, 60 * 60 * 1000);
  if (!emailRate.allowed) {
    return {
      status: 429,
      error: 'RATE_LIMITED',
      message: `Quá nhiều yêu cầu đặt lại mật khẩu cho email này. Thử lại sau ${emailRate.retryAfterSeconds} giây.`
    };
  }

  const ipRate = await consumeFixedWindow(ipKey, 10, 60 * 60 * 1000);
  if (!ipRate.allowed) {
    return {
      status: 429,
      error: 'RATE_LIMITED',
      message: `Quá nhiều yêu cầu từ địa chỉ IP này. Thử lại sau ${ipRate.retryAfterSeconds} giây.`
    };
  }

  // Tra cứu User
  const user = await prisma.user.findUnique({
    where: { emailNormalized: normalizedEmail }
  });

  // User pending hoặc không tồn tại: không gửi gì
  if (user && user.status === 'active') {
    const now = new Date();

    // Vô hiệu token chưa dùng cũ
    await prisma.passwordReset.updateMany({
      where: {
        userId: user.id,
        usedAt: null
      },
      data: {
        usedAt: now
      }
    });

    // Tạo token mới hạn 15 phút
    const rawToken = generateResetToken();
    const tokenHash = hashResetToken(rawToken);
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);

    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt
      }
    });

    const resetUrl = `${config.APP_BASE_URL}/reset?token=${encodeURIComponent(rawToken)}`;

    // Gửi email không đồng bộ (không await, bắt lỗi, log không kèm bí mật)
    sendPasswordResetLink(user.email, resetUrl).catch((err) => {
      console.error('[PASSWORD RESET MAIL ERROR]: Failed to send reset email');
    });
  }

  // Luôn trả cùng một thông báo chung và cùng status
  return {
    success: true,
    notice: GENERIC_FORGOT_NOTICE
  };
}

/**
 * BƯỚC 7: Kiểm tra token reset có hợp lệ không (dùng cho GET /reset)
 * GET KHÔNG BAO GIỜ đổi dữ liệu hay đặt usedAt!
 */
async function checkResetTokenValid(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') {
    return { valid: false, message: 'Thiếu mã xác thực đặt lại mật khẩu.' };
  }

  try {
    const tokenHash = hashResetToken(rawToken);
    const record = await prisma.passwordReset.findUnique({
      where: { tokenHash },
      include: { user: true }
    });

    if (!record) {
      return { valid: false, message: 'Liên kết không tồn tại hoặc không hợp lệ.' };
    }

    if (record.usedAt !== null) {
      return { valid: false, message: 'Liên kết đặt lại mật khẩu này đã được sử dụng.' };
    }

    if (record.expiresAt.getTime() <= Date.now()) {
      return { valid: false, message: 'Liên kết đặt lại mật khẩu đã hết hạn (chỉ có hiệu lực trong 15 phút).' };
    }

    if (!record.user || record.user.status !== 'active') {
      return { valid: false, message: 'Tài khoản liên kết không hợp lệ hoặc chưa được kích hoạt.' };
    }

    return { valid: true, record };
  } catch (err) {
    return { valid: false, message: 'Mã xác thực không hợp lệ.' };
  }
}

/**
 * BƯỚC 7: Thực hiện đổi mật khẩu bằng reset token (POST /reset)
 */
async function executePasswordReset({ token, newPassword }) {
  if (!token || typeof token !== 'string') {
    return { success: false, error: 'INVALID_TOKEN', message: 'Token không hợp lệ.' };
  }

  const tokenHash = hashResetToken(token);
  const now = new Date();

  // Kiểm tra token trước khi băm
  const resetRecord = await prisma.passwordReset.findUnique({
    where: { tokenHash },
    include: { user: true }
  });

  if (!resetRecord || resetRecord.usedAt !== null || resetRecord.expiresAt.getTime() <= now.getTime()) {
    return {
      success: false,
      error: 'INVALID_TOKEN',
      message: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.'
    };
  }

  const user = resetRecord.user;
  if (!user || user.status !== 'active') {
    return {
      success: false,
      error: 'INVALID_USER',
      message: 'Tài khoản không ở trạng thái hợp lệ.'
    };
  }

  // Băm mật khẩu mới
  const passwordHash = await hashPassword(newPassword);

  // Thực hiện trong một transaction
  const txSuccess = await prisma.$transaction(async (tx) => {
    // Cập nhật usedAt có điều kiện
    const updatedReset = await tx.passwordReset.updateMany({
      where: {
        id: resetRecord.id,
        usedAt: null
      },
      data: {
        usedAt: now
      }
    });

    if (updatedReset.count === 0) {
      return false;
    }

    // Vô hiệu mọi token chưa dùng khác của user
    await tx.passwordReset.updateMany({
      where: {
        userId: user.id,
        usedAt: null
      },
      data: {
        usedAt: now
      }
    });

    // Cập nhật mật khẩu user
    await tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash
      }
    });

    // XÓA mọi Session có userId đó (buộc đăng xuất mọi thiết bị)
    await tx.session.deleteMany({
      where: {
        userId: user.id
      }
    });

    return true;
  });

  if (!txSuccess) {
    return {
      success: false,
      error: 'INVALID_TOKEN',
      message: 'Liên kết đặt lại mật khẩu đã được sử dụng trước đó.'
    };
  }

  // Gửi email báo đã đổi mật khẩu (không chứa password)
  sendPasswordChangedNotice(user.email).catch((err) => {
    console.error('[PASSWORD CHANGED NOTICE ERROR]: Failed to send notification');
  });

  return { success: true };
}

module.exports = {
  INVALID_OTP_MESSAGE,
  GENERIC_REGISTER_NOTICE,
  GENERIC_LOGIN_ERROR,
  GENERIC_FORGOT_NOTICE,
  registerUser,
  activateUser,
  resendActivationOtp,
  loginUser,
  requestPasswordReset,
  checkResetTokenValid,
  executePasswordReset
};
