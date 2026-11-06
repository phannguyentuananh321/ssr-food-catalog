const crypto = require('crypto');

function wantsJson(req) {
  return req.originalUrl.startsWith('/api/')
    || req.originalUrl.startsWith('/admin/api/')
    || req.accepts(['html', 'json']) === 'json';
}

function verifyCsrfToken(submitted, expected) {
  if (!submitted || !expected || typeof submitted !== 'string' || typeof expected !== 'string') {
    return false;
  }
  const bufA = Buffer.from(submitted, 'utf8');
  const bufB = Buffer.from(expected, 'utf8');
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function csrfMiddleware(req, res, next) {
  if (!req.session) {
    return next(new Error('Session middleware must be mounted before CSRF middleware'));
  }

  // Khởi tạo csrfToken trong session nếu chưa có
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }

  // Đưa csrfToken vào res.locals để mọi template EJS dùng được
  res.locals.csrfToken = req.session.csrfToken;

  // Chỉ kiểm tra CSRF với các phương thức thay đổi trạng thái
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method.toUpperCase())) {
    return next();
  }

  // Đọc token từ body, query (_csrf) hoặc header x-csrf-token
  const submittedToken = (req.body && req.body._csrf)
    || (req.query && req.query._csrf)
    || req.headers['x-csrf-token'];

  if (!verifyCsrfToken(submittedToken, req.session.csrfToken)) {
    if (wantsJson(req)) {
      return res.status(403).json({
        error: 'CSRF_ERROR',
        message: 'Mã CSRF không hợp lệ hoặc đã hết hạn.'
      });
    }

    return res.status(403).render('errors/403', {
      pageTitle: 'Từ Chối Truy Cập',
      currentPath: req.path,
      message: 'Mã bảo mật CSRF không hợp lệ hoặc đã hết hạn. Vui lòng tải lại trang và thử lại.'
    });
  }

  return next();
}

module.exports = {
  csrfMiddleware,
  verifyCsrfToken
};
