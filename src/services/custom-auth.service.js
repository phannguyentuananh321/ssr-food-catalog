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

module.exports = {
  INVALID_OTP_MESSAGE,
  GENERIC_REGISTER_NOTICE,
  GENERIC_LOGIN_ERROR,
  registerUser,
  activateUser,
  resendActivationOtp,
  loginUser
};
