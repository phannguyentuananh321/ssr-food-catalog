const path = require('path');
const dotenv = require('dotenv');

// Load .env from project root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

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
  SUPABASE_STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET || 'dish-images',

  // Session secret
  SESSION_SECRET: process.env.SESSION_SECRET || 'dev_secret_key_change_in_production_min32chars',

  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV !== 'production'
};

/**
 * Validate presence of required environment variables
 * @param {boolean} strict If true, will throw when required variables are missing
 */
function validateEnv(strict = false) {
  const missing = [];

  if (!config.DATABASE_URL) {
    missing.push('DATABASE_URL');
  }

  // If in production, supabase storage and session secret are strictly required
  if (config.isProduction) {
    if (!config.SUPABASE_URL) missing.push('SUPABASE_URL');
    if (!config.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    if (!process.env.SESSION_SECRET) missing.push('SESSION_SECRET');
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
  validateEnv
};
