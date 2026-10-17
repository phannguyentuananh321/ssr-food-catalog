/**
 * 404 Not Found Middleware
 */
function notFoundHandler(req, res, next) {
  res.status(404).render('errors/404', {
    pageTitle: 'Không Tìm Thấy Trang (404)',
    currentPath: req.path
  });
}

/**
 * Global Error Handler Middleware
 */
function globalErrorHandler(err, req, res, next) {
  console.error('[UNHANDLED SERVER ERROR]:', err);

  const status = err.status || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  // In production, never expose stack traces or raw database messages to users
  const message = isProduction
    ? 'Hệ thống đang gặp sự cố tạm thời. Vui lòng quay lại sau ít phút.'
    : err.message || 'Đã xảy ra lỗi không xác định.';

  res.status(status).render('errors/500', {
    pageTitle: 'Lỗi Máy Chủ (500)',
    currentPath: req.path,
    message
  });
}

module.exports = {
  notFoundHandler,
  globalErrorHandler
};
