const { config } = require('../config/env');
const { createSupabaseServerClient } = require('../lib/supabase-server');

function isEmailVerified(user) {
  return Boolean(user && (user.email_confirmed_at || user.confirmed_at));
}

/**
 * The single admin is the verified Supabase user whose email equals the
 * server-only ADMIN_EMAIL value. Never trust a role/flag from the client.
 */
function isAdminUser(user) {
  if (!user || !user.email || !config.ADMIN_EMAIL || !isEmailVerified(user)) {
    return false;
  }
  return user.email.trim().toLowerCase() === config.ADMIN_EMAIL;
}

function safeNextPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return null;
  }
  // Reject backslash variants that browsers may normalize into a host.
  if (value.includes('\\')) {
    return null;
  }
  return value;
}

function wantsJson(req) {
  return req.originalUrl.startsWith('/api/')
    || req.originalUrl.startsWith('/admin/api/')
    || req.accepts(['html', 'json']) === 'json';
}

/**
 * Creates the request-scoped Supabase client and verifies the access token
 * against Supabase Auth. The user object is always derived server-side.
 */
async function attachAuth(req, res, next) {
  req.supabase = null;
  req.user = null;
  res.locals.currentUser = null;
  res.locals.isAdmin = false;
  res.locals.turnstileSiteKey = config.TURNSTILE_SITE_KEY;

  if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
    res.locals.authConfigured = false;
    return next();
  }

  res.locals.authConfigured = true;
  req.supabase = createSupabaseServerClient(req, res);

  try {
    const { data, error } = await req.supabase.auth.getUser();
    if (!error && data && data.user) {
      req.user = data.user;
      const username = data.user.user_metadata && data.user.user_metadata.username;
      res.locals.currentUser = {
        id: data.user.id,
        email: data.user.email,
        username: username || null,
        emailVerified: isEmailVerified(data.user)
      };
      res.locals.isAdmin = isAdminUser(data.user);
    }
  } catch (error) {
    console.error('[AUTH ATTACH ERROR]:', error.message);
  }

  return next();
}

function requireAuth(req, res, next) {
  if (req.user) return next();

  if (wantsJson(req)) {
    return res.status(401).json({
      error: 'UNAUTHENTICATED',
      message: 'Vui lòng đăng nhập để tiếp tục.'
    });
  }

  const nextPath = safeNextPath(req.originalUrl);
  const suffix = nextPath ? `?next=${encodeURIComponent(nextPath)}` : '';
  return res.redirect(303, `/auth/login${suffix}`);
}

function requireAdmin(req, res, next) {
  if (!req.user) return requireAuth(req, res, next);

  if (isAdminUser(req.user)) return next();

  if (wantsJson(req)) {
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Bạn không có quyền truy cập khu vực quản trị.'
    });
  }

  return res.status(403).render('errors/403', {
    pageTitle: 'Không Có Quyền Truy Cập',
    currentPath: req.path
  });
}

function redirectIfAuthenticated(req, res, next) {
  if (!req.user) return next();
  return res.redirect(303, '/dishes');
}

module.exports = {
  attachAuth,
  requireAuth,
  requireAdmin,
  redirectIfAuthenticated,
  isAdminUser,
  isEmailVerified,
  safeNextPath
};
