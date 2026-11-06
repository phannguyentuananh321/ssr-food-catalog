const prisma = require('../lib/prisma');
const { config } = require('../config/env');
const { isAdminUser, isEmailVerified, safeNextPath } = require('../middleware/auth');
const {
  validateRegister,
  validateLogin,
  validatePasswordReset,
  validateOtp
} = require('../validators/auth.validator');
const {
  buildLoginIdentifier,
  getLoginStatus,
  recordLoginFailure,
  resetLoginFailures,
  consumeRegistrationAttempt
} = require('../services/auth-throttle.service');
const {
  isTurnstileConfigured,
  verifyTurnstile
} = require('../services/turnstile.service');

const GENERIC_LOGIN_ERROR = 'Email hoặc mật khẩu không đúng.';
const GENERIC_RESET_NOTICE = 'Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi.';

function formatRetry(seconds) {
  const value = Math.max(0, Number(seconds) || 0);
  if (value < 60) return `${value} giây`;
  const minutes = Math.ceil(value / 60);
  return `${minutes} phút`;
}

function authLocals(req, extra = {}) {
  return {
    currentPath: req.path,
    turnstileSiteKey: config.TURNSTILE_SITE_KEY,
    turnstileConfigured: isTurnstileConfigured(),
    authConfigured: Boolean(req.supabase),
    ...extra
  };
}

function renderLogin(req, res, status, extra = {}) {
  return res.status(status).render('auth/login', authLocals(req, {
    pageTitle: 'Đăng Nhập',
    email: '',
    errors: {},
    errorMessage: null,
    notice: null,
    captchaRequired: false,
    retryAfterSeconds: 0,
    next: safeNextPath(req.query.next) || safeNextPath(req.body && req.body.next) || '',
    ...extra
  }));
}

function renderRegister(req, res, status, extra = {}) {
  return res.status(status).render('auth/register', authLocals(req, {
    pageTitle: 'Đăng Ký',
    values: { username: '', email: '' },
    errors: {},
    errorMessage: null,
    notice: null,
    ...extra
  }));
}

function renderVerify(req, res, status, extra = {}) {
  return res.status(status).render('auth/verify', authLocals(req, {
    pageTitle: 'Xác Minh Email',
    email: '',
    errors: {},
    errorMessage: null,
    notice: null,
    ...extra
  }));
}

function renderForgot(req, res, status, extra = {}) {
  return res.status(status).render('auth/forgot-password', authLocals(req, {
    pageTitle: 'Quên Mật Khẩu',
    email: '',
    errors: {},
    errorMessage: null,
    notice: null,
    ...extra
  }));
}

function renderReset(req, res, status, extra = {}) {
  return res.status(status).render('auth/reset-password', authLocals(req, {
    pageTitle: 'Đặt Lại Mật Khẩu',
    errors: {},
    errorMessage: null,
    notice: null,
    canReset: Boolean(req.user),
    ...extra
  }));
}

function renderAuthConfigError(req, res) {
  return renderLogin(req, res, 503, {
    errorMessage: 'Máy chủ chưa cấu hình Supabase Auth (SUPABASE_URL / SUPABASE_ANON_KEY). Vui lòng kiểm tra .env.'
  });
}

function parseTurnstileToken(body) {
  const token = body && body['cf-turnstile-response'];
  return typeof token === 'string' ? token : '';
}

async function renderLoginPage(req, res) {
  if (!req.supabase) return renderAuthConfigError(req, res);

  return renderLogin(req, res, 200, {
    notice: req.query.registered ? 'Đăng ký thành công. Vui lòng kiểm tra email để xác minh tài khoản.'
      : req.query.verified ? 'Email đã được xác minh. Bạn có thể đăng nhập.'
        : req.query.reset ? 'Mật khẩu đã được cập nhật.'
          : null
  });
}

async function login(req, res, next) {
  if (!req.supabase) return renderAuthConfigError(req, res);

  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const nextPath = safeNextPath(req.body.next);
  const identifier = buildLoginIdentifier(req.ip, email);

  try {
    const status = await getLoginStatus(identifier);

    if (status.locked) {
      return renderLogin(req, res, 429, {
        email,
        next: nextPath || '',
        errorMessage: `Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau ${formatRetry(status.retryAfterSeconds)}.`,
        captchaRequired: true,
        retryAfterSeconds: status.retryAfterSeconds
      });
    }

    const validation = validateLogin({ email, password });
    if (!validation.success) {
      return renderLogin(req, res, 422, {
        email,
        next: nextPath || '',
        errors: validation.errors,
        errorMessage: 'Vui lòng kiểm tra lại thông tin đăng nhập.'
      });
    }

    if (status.captchaRequired) {
      const captcha = await verifyTurnstile(parseTurnstileToken(req.body), req.ip);
      if (!captcha.success) {
        return renderLogin(req, res, 400, {
          email,
          next: nextPath || '',
          errorMessage: 'Vui lòng xác minh CAPTCHA trước khi đăng nhập.',
          captchaRequired: true
        });
      }
    }

    const { data, error } = await req.supabase.auth.signInWithPassword({
      email: validation.data.email,
      password: validation.data.password
    });

    if (error) {
      // Credentials are valid but the address is not verified yet. This is not a
      // failed password attempt, so the brute-force counter is left untouched.
      if (error.code === 'email_not_confirmed') {
        return renderLogin(req, res, 403, {
          email,
          next: nextPath || '',
          errorMessage: 'Email chưa được xác minh. Vui lòng kiểm tra hộp thư hoặc gửi lại mã xác minh.'
        });
      }

      const afterFailure = await recordLoginFailure(identifier);
      return renderLogin(req, res, afterFailure.locked ? 429 : 401, {
        email,
        next: nextPath || '',
        errorMessage: GENERIC_LOGIN_ERROR,
        captchaRequired: afterFailure.captchaRequired,
        retryAfterSeconds: afterFailure.retryAfterSeconds
      });
    }

    if (!isEmailVerified(data.user)) {
      await req.supabase.auth.signOut().catch(() => {});
      return renderLogin(req, res, 403, {
        email,
        next: nextPath || '',
        errorMessage: 'Email chưa được xác minh. Vui lòng kiểm tra hộp thư hoặc gửi lại mã xác minh.'
      });
    }

    await resetLoginFailures(identifier);

    const target = nextPath || (isAdminUser(data.user) ? '/admin/dishes' : '/dishes');
    return res.redirect(303, target);
  } catch (error) {
    return next(error);
  }
}

async function renderRegisterPage(req, res) {
  if (!req.supabase) return renderAuthConfigError(req, res);
  return renderRegister(req, res, 200);
}

async function register(req, res, next) {
  if (!req.supabase) return renderAuthConfigError(req, res);

  const values = {
    username: String(req.body.username || '').trim(),
    email: String(req.body.email || '').trim().toLowerCase()
  };

  try {
    const validation = validateRegister({
      username: values.username,
      email: values.email,
      password: String(req.body.password || ''),
      confirmPassword: String(req.body.confirmPassword || '')
    });

    if (!validation.success) {
      return renderRegister(req, res, 422, {
        values,
        errors: validation.errors,
        errorMessage: 'Vui lòng kiểm tra lại các trường thông tin.'
      });
    }

    const captcha = await verifyTurnstile(parseTurnstileToken(req.body), req.ip);
    if (!captcha.success) {
      return renderRegister(req, res, 400, {
        values,
        errorMessage: 'Vui lòng xác minh CAPTCHA trước khi đăng ký.'
      });
    }

    const rate = await consumeRegistrationAttempt(req.ip);
    if (!rate.allowed) {
      return renderRegister(req, res, 429, {
        values,
        errorMessage: `Bạn đã đăng ký quá nhiều lần. Vui lòng thử lại sau ${formatRetry(rate.retryAfterSeconds)}.`
      });
    }

    const usernameLower = validation.data.username.toLowerCase();
    const existingUsername = await prisma.userProfile.findUnique({
      where: { usernameLower },
      select: { id: true }
    });

    if (existingUsername) {
      return renderRegister(req, res, 409, {
        values,
        errors: { username: 'Tên đăng nhập này đã được sử dụng.' },
        errorMessage: 'Vui lòng chọn tên đăng nhập khác.'
      });
    }

    const { data, error } = await req.supabase.auth.signUp({
      email: validation.data.email,
      password: validation.data.password,
      options: {
        data: { username: validation.data.username },
        emailRedirectTo: `${config.APP_BASE_URL}/auth/callback?next=/dishes`
      }
    });

    if (error) {
      if (error.code === 'over_email_send_rate_limit') {
        return renderRegister(req, res, 429, {
          values,
          errorMessage: 'Hệ thống gửi email xác minh đang tạm đạt giới hạn. Vui lòng thử lại sau ít phút.'
        });
      }
      return renderRegister(req, res, 400, {
        values,
        errorMessage: 'Không thể tạo tài khoản. Nếu email đã tồn tại, hãy đăng nhập hoặc dùng chức năng quên mật khẩu.'
      });
    }

    // Supabase returns an obfuscated user with no identities when the email is
    // already registered. Do not create an application profile in that case.
    if (!data.user || (Array.isArray(data.user.identities) && data.user.identities.length === 0)) {
      return renderVerify(req, res, 200, {
        email: validation.data.email,
        notice: 'Nếu email hợp lệ, hướng dẫn xác minh đã được gửi. Vui lòng kiểm tra hộp thư.'
      });
    }

    try {
      await prisma.userProfile.create({
        data: {
          id: data.user.id,
          email: validation.data.email,
          username: validation.data.username,
          usernameLower
        }
      });
    } catch (profileError) {
      if (profileError.code === 'P2002') {
        return renderRegister(req, res, 409, {
          values,
          errors: { username: 'Tên đăng nhập này đã được sử dụng.' },
          errorMessage: 'Vui lòng chọn tên đăng nhập khác.'
        });
      }
      throw profileError;
    }

    if (data.session) {
      return res.redirect(303, '/dishes');
    }

    return renderVerify(req, res, 200, {
      email: validation.data.email,
      notice: 'Đăng ký thành công. Vui lòng kiểm tra email để xác minh tài khoản.'
    });
  } catch (error) {
    return next(error);
  }
}

async function verifyEmail(req, res, next) {
  if (!req.supabase) return renderAuthConfigError(req, res);

  const email = String(req.body.email || '').trim().toLowerCase();
  try {
    const validation = validateOtp({
      email,
      token: String(req.body.token || '').trim()
    });

    if (!validation.success) {
      return renderVerify(req, res, 422, {
        email,
        errors: validation.errors,
        errorMessage: 'Vui lòng kiểm tra lại mã xác minh.'
      });
    }

    const { error } = await req.supabase.auth.verifyOtp({
      email: validation.data.email,
      token: validation.data.token,
      type: 'email'
    });

    if (error) {
      return renderVerify(req, res, 400, {
        email,
        errorMessage: 'Mã xác minh không đúng hoặc đã hết hạn.'
      });
    }

    return res.redirect(303, '/dishes');
  } catch (error) {
    return next(error);
  }
}

async function authCallback(req, res, next) {
  if (!req.supabase) return renderAuthConfigError(req, res);

  const nextPath = safeNextPath(req.query.next) || '/dishes';

  try {
    if (req.query.error) {
      return renderLogin(req, res, 400, {
        errorMessage: 'Liên kết xác minh không hợp lệ hoặc đã hết hạn.'
      });
    }

    if (req.query.code) {
      const { error } = await req.supabase.auth.exchangeCodeForSession(String(req.query.code));
      if (error) {
        return renderLogin(req, res, 400, {
          errorMessage: 'Liên kết xác minh không hợp lệ hoặc đã hết hạn.'
        });
      }
      return res.redirect(303, nextPath);
    }

    const tokenHash = req.query.token_hash;
    const type = req.query.type;
    const allowedTypes = ['email', 'recovery', 'magiclink', 'invite', 'email_change'];

    if (tokenHash && allowedTypes.includes(type)) {
      const { error } = await req.supabase.auth.verifyOtp({
        token_hash: String(tokenHash),
        type
      });
      if (error) {
        return renderLogin(req, res, 400, {
          errorMessage: 'Liên kết xác minh không hợp lệ hoặc đã hết hạn.'
        });
      }
      return res.redirect(303, nextPath);
    }

    return renderLogin(req, res, 400, {
      errorMessage: 'Thiếu thông tin xác minh trong liên kết.'
    });
  } catch (error) {
    return next(error);
  }
}

async function renderVerifyPage(req, res) {
  if (!req.supabase) return renderAuthConfigError(req, res);
  return renderVerify(req, res, 200, {
    email: String(req.query.email || '').trim().toLowerCase()
  });
}

async function resendVerification(req, res, next) {
  if (!req.supabase) return renderAuthConfigError(req, res);

  const email = String(req.body.email || '').trim().toLowerCase();
  try {
    if (email) {
      const { error } = await req.supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: `${config.APP_BASE_URL}/auth/callback?next=/dishes` }
      });

      if (error && (error.code === 'over_email_send_rate_limit' || error.status === 429)) {
        return renderVerify(req, res, 429, {
          email,
          errorMessage: 'Hệ thống gửi email xác minh đang tạm đạt giới hạn. Vui lòng thử lại sau ít phút.'
        });
      }
    }
    return renderVerify(req, res, 200, {
      email,
      notice: 'Nếu email hợp lệ và chưa xác minh, hướng dẫn mới đã được gửi.'
    });
  } catch (error) {
    return next(error);
  }
}

async function renderForgotPage(req, res) {
  if (!req.supabase) return renderAuthConfigError(req, res);
  return renderForgot(req, res, 200);
}

async function forgotPassword(req, res, next) {
  if (!req.supabase) return renderAuthConfigError(req, res);

  const email = String(req.body.email || '').trim().toLowerCase();
  try {
    const validation = validateLogin({ email, password: 'placeholder' });
    if (!validation.success && validation.errors.email) {
      return renderForgot(req, res, 422, {
        email,
        errors: { email: validation.errors.email },
        errorMessage: 'Vui lòng nhập email hợp lệ.'
      });
    }

    if (email) {
      await req.supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${config.APP_BASE_URL}/auth/callback?next=/auth/reset-password`
      });
    }

    return renderForgot(req, res, 200, {
      email,
      notice: GENERIC_RESET_NOTICE
    });
  } catch (error) {
    return next(error);
  }
}

async function renderResetPage(req, res) {
  if (!req.supabase) return renderAuthConfigError(req, res);
  return renderReset(req, res, 200);
}

async function resetPassword(req, res, next) {
  if (!req.supabase) return renderAuthConfigError(req, res);

  if (!req.user) {
    return renderReset(req, res, 401, {
      errorMessage: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu lại.'
    });
  }

  try {
    const validation = validatePasswordReset({
      password: String(req.body.password || ''),
      confirmPassword: String(req.body.confirmPassword || '')
    });

    if (!validation.success) {
      return renderReset(req, res, 422, {
        errors: validation.errors,
        errorMessage: 'Vui lòng kiểm tra lại mật khẩu.'
      });
    }

    const { error } = await req.supabase.auth.updateUser({ password: validation.data.password });
    if (error) {
      return renderReset(req, res, 400, {
        errorMessage: 'Không thể cập nhật mật khẩu. Vui lòng yêu cầu liên kết mới.'
      });
    }

    await req.supabase.auth.signOut({ scope: 'others' }).catch(() => {});

    return renderReset(req, res, 200, {
      notice: 'Mật khẩu đã được cập nhật. Bạn có thể tiếp tục sử dụng website.'
    });
  } catch (error) {
    return next(error);
  }
}

async function logout(req, res) {
  try {
    if (req.supabase) {
      await req.supabase.auth.signOut();
    }
  } catch (error) {
    console.error('[AUTH LOGOUT ERROR]:', error.message);
  }
  return res.redirect(303, '/auth/login');
}

module.exports = {
  renderLoginPage,
  login,
  renderRegisterPage,
  register,
  verifyEmail,
  renderVerifyPage,
  resendVerification,
  authCallback,
  renderForgotPage,
  forgotPassword,
  renderResetPage,
  resetPassword,
  logout
};
