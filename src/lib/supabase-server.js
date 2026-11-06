const { createServerClient } = require('@supabase/ssr');
const { parseCookie, stringifySetCookie } = require('cookie');
const { config } = require('../config/env');

function readRequestCookies(req) {
  const parsed = parseCookie(req.headers.cookie || '');
  return Object.keys(parsed).map((name) => ({ name, value: parsed[name] }));
}

/**
 * Server-side Supabase client backed by Supabase's own auth cookies.
 * A fresh client is created per request so token refreshes are written to the
 * response that triggered them.
 */
function createSupabaseServerClient(req, res) {
  if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
    return null;
  }

  return createServerClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    },
    cookieOptions: {
      path: '/',
      sameSite: 'lax',
      secure: config.isProduction,
      httpOnly: true
    },
    cookies: {
      getAll() {
        return readRequestCookies(req);
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value, options } of cookiesToSet) {
          const cookie = stringifySetCookie({
            ...options,
            name,
            value,
            path: '/',
            sameSite: 'lax',
            secure: config.isProduction,
            httpOnly: true
          });
          res.append('Set-Cookie', cookie);
        }

        for (const [header, value] of Object.entries(headers || {})) {
          res.setHeader(header, value);
        }
      }
    }
  });
}

module.exports = {
  createSupabaseServerClient
};
