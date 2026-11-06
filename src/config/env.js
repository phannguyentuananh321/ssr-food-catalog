const path = require('path');
const dotenv = require('dotenv');

// Load .env from project root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const GOOGLE_RECAPTCHA_TEST_SITE_KEY = '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';
const GOOGLE_RECAPTCHA_TEST_SECRET_KEY = '6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe';

const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 3000,
  APP_BASE_URL: (process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/+$/, ''),

  // Database connection
  DATABASE_URL: process.env.DATABASE_URL || '',
  DIRECT_URL: process.env.DIRECT_URL || '',

  // Supabase Storage (only for media files)
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  SUPABASE_STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET || 'dish-images',

  // Session Secret (minimum 32 characters)
  SESSION_SECRET: process.env.SESSION_SECRET || '',

  // OTP Pepper (minimum 32 characters)
  OTP_PEPPER: process.env.OTP_PEPPER || '',

  // Google reCAPTCHA v2 (server-side verification)
  RECAPTCHA_SITE_KEY: process.env.RECAPTCHA_SITE_KEY || '',
  RECAPTCHA_SECRET_KEY: process.env.RECAPTCHA_SECRET_KEY || '',

  // SMTP Configuration
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: parseInt(process.env.SMTP_PORT, 10) || 587,
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  MAIL_FROM: process.env.MAIL_FROM || 'no-reply@amvi.local',

  // Registration rate limit (per IP, fixed window)
  REGISTRATION_LIMIT: parseInt(process.env.REGISTRATION_LIMIT, 10) || 5,
  REGISTRATION_WINDOW_MINUTES: parseInt(process.env.REGISTRATION_WINDOW_MINUTES, 10) || 60,

  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV !== 'production'
};

function isRecaptchaTestKey(
  siteKey = config.RECAPTCHA_SITE_KEY,
  secretKey = config.RECAPTCHA_SECRET_KEY
) {
  return siteKey === GOOGLE_RECAPTCHA_TEST_SITE_KEY || secretKey === GOOGLE_RECAPTCHA_TEST_SECRET_KEY;
}

/**
 * Validate presence of required environment variables
 * @param {boolean} strict If true, will throw when required variables are missing
 */
function validateEnv(strict = false) {
  const missing = [];

  if (!config.DATABASE_URL) {
    missing.push('DATABASE_URL');
  }

  // Session & OTP secrets length checks
  if (!config.SESSION_SECRET) {
    missing.push('SESSION_SECRET');
  } else if (config.SESSION_SECRET.length < 32) {
    throw new Error('[CONFIG ERROR] SESSION_SECRET must be at least 32 characters long.');
  }

  if (!config.OTP_PEPPER) {
    missing.push('OTP_PEPPER');
  } else if (config.OTP_PEPPER.length < 32) {
    throw new Error('[CONFIG ERROR] OTP_PEPPER must be at least 32 characters long.');
  }

  // Required in production
  if (config.isProduction) {
    if (!config.SUPABASE_URL) missing.push('SUPABASE_URL');
    if (!config.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    if (!config.RECAPTCHA_SITE_KEY) missing.push('RECAPTCHA_SITE_KEY');
    if (!config.RECAPTCHA_SECRET_KEY) missing.push('RECAPTCHA_SECRET_KEY');
    if (!config.SMTP_HOST) missing.push('SMTP_HOST');
    if (!config.SMTP_PORT) missing.push('SMTP_PORT');
    if (!config.SMTP_USER) missing.push('SMTP_USER');
    if (!config.SMTP_PASS) missing.push('SMTP_PASS');
    if (!config.MAIL_FROM) missing.push('MAIL_FROM');
    if (!config.APP_BASE_URL) missing.push('APP_BASE_URL');
  }

  if (config.isProduction && isRecaptchaTestKey()) {
    throw new Error(
      '[CONFIG ERROR] Google reCAPTCHA test keys are not allowed in production.\n' +
      'Set real RECAPTCHA_SITE_KEY and RECAPTCHA_SECRET_KEY in .env.'
    );
  }

  if (missing.length > 0) {
    const errorMsg = `[CONFIG WARNING] Missing required environment variable(s): ${missing.join(', ')}.\n` +
      `Please check your root .env file. See .env.example for guidance.`;

    if (strict || config.isProduction) {
      throw new Error(errorMsg);
    } else {
      console.warn(errorMsg);
    }
  }

  return { isValid: missing.length === 0, missing };
}

module.exports = {
  config,
  validateEnv,
  isRecaptchaTestKey
};
