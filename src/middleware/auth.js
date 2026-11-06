const prisma = require('../lib/prisma');

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
 * Middleware attachUser:
 * Nạp User theo session.userId từ database, chỉ chấp nhận status active,
 * ngược lại hủy session và xóa cookie.
 */
async function attachUser(req, res, next) {
  req.user = null;
  res.locals.currentUser = null;
  res.locals.user = null;

  if (!req.session) {
    return next();
  }

  // Quản lý thời hạn cookie: phiên ẩn danh 30 phút, phiên đăng nhập 24 giờ
  if (!req.session.userId) {
    req.session.cookie.maxAge = 30 * 60 * 1000; // 30 phút cho phiên ẩn danh
    return next();
  }

  // Người dùng đã có session userId
  req.session.cookie.maxAge = 24 * 60 * 60 * 1000; // 24 giờ cho phiên đăng nhập

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId }
    });

    if (user && user.status === 'active') {
      req.user = user;
      res.locals.currentUser = {
        id: user.id,
        email: user.email,
        displayName: user.displayName || user.email.split('@')[0],
        role: user.role,
        status: user.status
      };
      res.locals.user = res.locals.currentUser;
      return next();
    }

    // Tài khoản không tồn tại hoặc không ở trạng thái active -> hủy session
    req.session.destroy(() => {
      res.clearCookie('sid');
      req.user = null;
      res.locals.currentUser = null;
      res.locals.user = null;
      return next();
    });
  } catch (err) {
    console.error('[ATTACH USER ERROR]:', err.message);
    return next();
  }
}

/**
 * Middleware requireAuth:
 * Trang HTML thì 303 tới /login?next=... (giữ kiểm tra open redirect); /api/* thì 401 JSON.
 */
function requireAuth(req, res, next) {
  if (req.user) {
    return next();
  }

  if (wantsJson(req)) {
    return res.status(401).json({
      error: 'UNAUTHENTICATED',
      message: 'Vui lòng đăng nhập để tiếp tục.'
    });
  }

  const nextPath = safeNextPath(req.originalUrl);
  const suffix = nextPath ? `?next=${encodeURIComponent(nextPath)}` : '';
  return res.redirect(303, `/login${suffix}`);
}

/**
 * Thay thế requireAdmin:
 * Đặc tả: Mọi route (toàn bộ cụm CRUD và /admin/*) chỉ yêu cầu đăng nhập, KHÔNG chặn theo role.
 * Gỡ requireAdmin và ADMIN_EMAIL; giữ view 403 để dành cho sau.
 */
function requireAdmin(req, res, next) {
  return requireAuth(req, res, next);
}

function redirectIfAuthenticated(req, res, next) {
  if (req.user) {
    return res.redirect(303, '/dishes');
  }
  return next();
}

module.exports = {
  attachUser,
  attachAuth: attachUser, // Alias để tương thích nếu cần
  requireAuth,
  requireAdmin,
  redirectIfAuthenticated,
  safeNextPath,
  wantsJson
};
