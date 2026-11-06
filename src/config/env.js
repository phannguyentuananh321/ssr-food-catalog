const path = require('path');
const dotenv = require('dotenv');

// Load .env from project root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Cloudflare's official test keys start with 1x/2x/3x; real widget keys start with 0x.
const TURNSTILE_TEST_KEY_PATTERN = /^[123]x0{5,}/i;

const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 3000,
  APP_BASE_URL: process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3000}`,
  
  // Database connection
  DATABASE_URL: process.env.DATABASE_URL || '',
  DIRECT_URL: process.env.DIRECT_URL || '',

  // Supabase Storage
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
  SUPABASE_STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET || 'dish-images',

  // Session secret (legacy; Supabase Auth manages sessions via its own cookies)
  SESSION_SECRET: process.env.SESSION_SECRET || 'dev_secret_key_change_in_production_min32chars',

  // Authorization: the single admin account is defined by the server environment
  ADMIN_EMAIL: (process.env.ADMIN_EMAIL || '').trim().toLowerCase(),

  // Cloudflare Turnstile (server-side verification)
  TURNSTILE_SITE_KEY: process.env.TURNSTILE_SITE_KEY || '',
  TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY || '',

  // Registration rate limit (per IP, fixed window)
  REGISTRATION_LIMIT: parseInt(process.env.REGISTRATION_LIMIT, 10) || 5,
  REGISTRATION_WINDOW_MINUTES: parseInt(process.env.REGISTRATION_WINDOW_MINUTES, 10) || 60,

  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV !== 'production'
};

/**
 * Detect Cloudflare's official test keys. They always pass siteverify and
 * render a "Testing only" badge, so they must never reach production.
 */
function isTurnstileTestKey(
  siteKey = config.TURNSTILE_SITE_KEY,
  secretKey = config.TURNSTILE_SECRET_KEY
) {
  const matches = (value) => TURNSTILE_TEST_KEY_PATTERN.test(String(value || ''));
  return matches(siteKey) || matches(secretKey);
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

  // Production must have working auth, storage and CAPTCHA configuration.
  if (config.isProduction) {
    if (!config.SUPABASE_URL) missing.push('SUPABASE_URL');
    if (!config.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    if (!config.SUPABASE_ANON_KEY) missing.push('SUPABASE_ANON_KEY');
    if (!config.ADMIN_EMAIL) missing.push('ADMIN_EMAIL');
    if (!process.env.SESSION_SECRET) missing.push('SESSION_SECRET');
    if (!config.TURNSTILE_SITE_KEY) missing.push('TURNSTILE_SITE_KEY');
    if (!config.TURNSTILE_SECRET_KEY) missing.push('TURNSTILE_SECRET_KEY');
  }

  if (config.isProduction && isTurnstileTestKey()) {
    throw new Error(
      '[CONFIG ERROR] Cloudflare Turnstile test keys are not allowed in production.\n' +
      'Create a real widget at https://dash.cloudflare.com -> Turnstile and set ' +
      'TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY in .env.'
    );
  }

  if (!config.isProduction && isTurnstileTestKey()) {
    console.warn(
      '[CONFIG WARNING] Cloudflare Turnstile is using official TEST keys: the widget shows ' +
      '"Testing only" and siteverify always passes. Create a real widget before deploying.'
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
  isTurnstileTestKey
};
