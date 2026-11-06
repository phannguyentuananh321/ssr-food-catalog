const { config } = require('../config/env');
const { safeNextPath } = require('../middleware/auth');
const { verifyRecaptcha } = require('../lib/recaptcha');
const { normalizeEmail } = require('../lib/tokens');
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
  loginUser
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

    // Đăng nhập thành công:
    // 6. regenerate session (sid mới), gán userId, xóa bộ đếm login-email, 303 tới next an toàn hoặc /dishes
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

async function logout(req, res, next) {
  // Sẽ triển khai chi tiết ở BƯỚC 6
  return res.redirect(303, '/login');
}

async function renderForgotPage(req, res) {
  // Sẽ triển khai chi tiết ở BƯỚC 7
  return res.render('auth/forgot-password', {
    pageTitle: 'Quên Mật Khẩu',
    currentPath: req.path,
    csrfToken: resLocalsCsrf(req),
    email: '',
    errors: {},
    errorMessage: null,
    notice: null
  });
}

async function forgotPassword(req, res, next) {
  // Sẽ triển khai chi tiết ở BƯỚC 7
  return res.redirect(303, '/login');
}

async function renderResetPage(req, res) {
  // Sẽ triển khai chi tiết ở BƯỚC 7
  return res.render('auth/reset-password', {
    pageTitle: 'Đặt Lại Mật Khẩu',
    currentPath: req.path,
    csrfToken: resLocalsCsrf(req),
    token: req.query.token || '',
    errors: {},
    errorMessage: null,
    notice: null
  });
}

async function resetPassword(req, res, next) {
  // Sẽ triển khai chi tiết ở BƯỚC 7
  return res.redirect(303, '/login');
}

module.exports = {
  renderRegisterPage,
  register,
  renderActivatePage,
  activate,
  resendActivation,
  renderLoginPage,
  login,
  logout,
  renderForgotPage,
  forgotPassword,
  renderResetPage,
  resetPassword
};
