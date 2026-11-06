const { config, isTurnstileTestKey } = require('../config/env');

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

function isTurnstileConfigured() {
  return Boolean(config.TURNSTILE_SITE_KEY && config.TURNSTILE_SECRET_KEY);
}

/**
 * Verify a Turnstile token server-side. The secret key never leaves the server.
 * In development without keys the check is skipped so local flows still work;
 * production startup refuses to run without Turnstile configuration.
 */
async function verifyTurnstile(token, remoteIp) {
  // Fail closed if a test key ever reaches production (validateEnv already
  // refuses to boot, this covers callers that bypass startup validation).
  if (config.isProduction && isTurnstileTestKey()) {
    return { success: false, skipped: false, errorCodes: ['test-key-in-production'] };
  }

  if (!config.TURNSTILE_SECRET_KEY) {
    return {
      success: config.isDevelopment,
      skipped: true,
      errorCodes: []
    };
  }

  if (!token || typeof token !== 'string') {
    return { success: false, skipped: false, errorCodes: ['missing-input-response'] };
  }

  try {
    const body = new URLSearchParams({
      secret: config.TURNSTILE_SECRET_KEY,
      response: token
    });
    if (remoteIp) body.set('remoteip', String(remoteIp));

    const response = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(5000)
    });

    const data = await response.json().catch(() => ({}));
    return {
      success: data.success === true,
      skipped: false,
      errorCodes: Array.isArray(data['error-codes']) ? data['error-codes'] : []
    };
  } catch (error) {
    return {
      success: false,
      skipped: false,
      errorCodes: ['verification-unavailable']
    };
  }
}

module.exports = {
  isTurnstileConfigured,
  isTurnstileTestKey,
  verifyTurnstile
};
