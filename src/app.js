const path = require('path');
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const methodOverride = require('method-override');

const { config, validateEnv } = require('./config/env');
const dishRoutes = require('./routes/dish.routes');
const chefRoutes = require('./routes/chef.routes');
const ingredientRoutes = require('./routes/ingredient.routes');
const adminRoutes = require('./routes/admin.routes');
const { notFoundHandler, globalErrorHandler } = require('./middleware/error-handler');

// Validate environment variables on startup
validateEnv(false);

const app = express();

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

// Root Redirect to default Public Catalog
app.get('/', (req, res) => {
  res.redirect(303, '/dishes');
});

// Business Entity Public Routes
app.use('/dishes', dishRoutes);
app.use('/chefs', chefRoutes);
app.use('/ingredients', ingredientRoutes);

// Admin Portal Routes
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
