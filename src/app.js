const path = require('path');
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const methodOverride = require('method-override');
const session = require('express-session');

const { config, validateEnv } = require('./config/env');
const { PrismaSessionStore } = require('./lib/session-store');
const { csrfMiddleware } = require('./middleware/csrf');
const { attachUser, requireAuth } = require('./middleware/auth');
const { notFoundHandler, globalErrorHandler } = require('./middleware/error-handler');

const dishRoutes = require('./routes/dish.routes');
const chefRoutes = require('./routes/chef.routes');
const ingredientRoutes = require('./routes/ingredient.routes');
const bookmarkRoutes = require('./routes/bookmark.routes');
const apiRoutes = require('./routes/api.routes');
const adminRoutes = require('./routes/admin.routes');
const authRoutes = require('./routes/auth.routes');

// Validate environment variables on startup
validateEnv(false);

const app = express();

// Trust proxy for secure cookies and accurate IP rate limiting behind reverse proxies
app.set('trust proxy', 1);

// View Engine & Layout Configuration
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);

// Body Parsers for standard HTML Form submits and JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Method Override for supporting PATCH and DELETE from HTML forms via ?_method= or body
app.use(methodOverride(function (req, res) {
  if (req.body && typeof req.body === 'object' && '_method' in req.body) {
    const method = req.body._method;
    delete req.body._method;
    return method;
  }
  if (req.query && '_method' in req.query) {
    return req.query._method;
  }
}));

// Static Assets
app.use(express.static(path.join(process.cwd(), 'public')));

// Session configuration
app.use(session({
  name: 'sid',
  secret: config.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  rolling: true,
  store: new PrismaSessionStore(),
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction,
    path: '/',
    maxAge: 24 * 60 * 60 * 1000 // 24 giờ cho phiên đăng nhập, phiên ẩn danh sẽ được chỉnh ở attachUser
  }
}));

// CSRF Protection (đọc từ body, query ?_csrf= hoặc header)
app.use(csrfMiddleware);

// Attach user from session
app.use(attachUser);

// Cung cấp biến tiện ích cho templates
app.use((req, res, next) => {
  res.locals.loggedIn = Boolean(req.user);
  res.locals.currentPath = req.path;
  res.locals.recaptchaSiteKey = config.RECAPTCHA_SITE_KEY;
  next();
});

// Referrer-Policy: no-referrer cho /reset
app.use((req, res, next) => {
  if (req.path === '/reset' || req.path === '/auth/reset') {
    res.setHeader('Referrer-Policy', 'no-referrer');
  }
  next();
});

// Public Authentication Routes (không yêu cầu đăng nhập)
app.use('/', authRoutes);
app.use('/auth', authRoutes); // Tương thích đường dẫn /auth/*

// Everything below requires an authenticated active session.
// API requests receive 401 JSON; browser requests are redirected to /login?next=...
app.use(requireAuth);

// Root Redirect to default Public Catalog
app.get('/', (req, res) => {
  res.redirect(303, '/dishes');
});

// Business Entity Public Routes
app.use('/dishes', dishRoutes);
app.use('/chefs', chefRoutes);
app.use('/ingredients', ingredientRoutes);

// Saved items (IDs live in the browser; data is resolved from PostgreSQL)
app.use('/bookmarks', bookmarkRoutes);

// JSON fragments for Load More / Infinite Scroll and bookmark resolution
app.use('/api', apiRoutes);

// Admin Portal Routes (chỉ yêu cầu đăng nhập, không chặn theo role)
app.use('/admin', adminRoutes);

// 404 & Global Error Handling Middleware
app.use(notFoundHandler);
app.use(globalErrorHandler);

// Start server if run directly
if (require.main === module) {
  const PORT = config.PORT;
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(` Ấm Vị — Food Catalog SSR Application`);
    console.log(` Environment : ${config.NODE_ENV}`);
    console.log(` Server URL  : http://localhost:${PORT}`);
    console.log(` Public Menu : http://localhost:${PORT}/dishes`);
    console.log(` Admin Menu  : http://localhost:${PORT}/admin/dishes`);
    console.log(`=======================================================`);
  });
}

module.exports = app;
