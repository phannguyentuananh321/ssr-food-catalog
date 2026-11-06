const { config, isRecaptchaTestKey } = require('../config/env');

/**
 * Xác minh Google reCAPTCHA v2 server-side:
 * POST https://www.google.com/recaptcha/api/siteverify với secret, response, remoteip.
 * Yêu cầu:
 * - success = true
 * - hostname khớp APP_BASE_URL (trừ trường hợp dùng Google test keys)
 * Lỗi mạng hoặc timeout thì fail closed (trả về false).
 */
async function verifyRecaptcha(token, remoteIp = '') {
  if (!token || typeof token !== 'string') {
    return false;
  }

  const secret = config.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    // Fail closed if not configured
    return false;
  }

  try {
    const params = new URLSearchParams();
    params.append('secret', secret);
    params.append('response', token);
    if (remoteIp) {
      params.append('remoteip', remoteIp);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString(),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    if (!data || data.success !== true) {
      return false;
    }

    // Kiểm tra hostname nếu không dùng Google test keys
    if (!isRecaptchaTestKey(config.RECAPTCHA_SITE_KEY, secret)) {
      try {
        const expectedHost = new URL(config.APP_BASE_URL).hostname.toLowerCase();
        const returnedHost = (data.hostname || '').toLowerCase();
        if (returnedHost !== expectedHost) {
          return false;
        }
      } catch (err) {
        return false;
      }
    }

    return true;
  } catch (err) {
    // Fail closed on network error, DNS failure or timeout
    return false;
  }
}

module.exports = {
  verifyRecaptcha
};
