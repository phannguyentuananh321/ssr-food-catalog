const { createClient } = require('@supabase/supabase-js');
const { config } = require('../config/env');

let supabase = null;

if (config.SUPABASE_URL && config.SUPABASE_SERVICE_ROLE_KEY) {
  try {
    supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  } catch (error) {
    console.error('[SUPABASE CLIENT ERROR]:', error.message);
  }
} else {
  // In development, allow app to run even if Supabase credentials are yet to be configured
  console.warn('[STORAGE NOTICE] Supabase credentials not provided in .env. Image uploads will use local fallback or placeholder.');
}

const BUCKET_NAME = config.SUPABASE_STORAGE_BUCKET || 'dish-images';

module.exports = {
  supabase,
  BUCKET_NAME
};
