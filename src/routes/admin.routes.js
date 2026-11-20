const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');

const dishController = require('../controllers/dish.controller');
const chefController = require('../controllers/chef.controller');
const ingredientController = require('../controllers/ingredient.controller');
const adminSearchController = require('../controllers/admin-search.controller');
const { requireAuth, requireRole } = require('../middleware/auth');

// RBAC Gate: Toàn bộ khu vực quản trị yêu cầu quyền 'admin' hoặc 'editor'
// Role 'viewer' khi cố truy cập sẽ nhận mã lỗi HTTP 403 Forbidden
router.use(requireRole(['admin', 'editor']));

router.get('/', (req, res) => {
  res.redirect(303, '/admin/dishes');
});

// ==========================================
// 0. ADMIN RELATION SEARCH (Dish form)
// ==========================================
router.get('/api/chefs', adminSearchController.searchChefs);
router.get('/api/ingredients', adminSearchController.searchIngredients);

// ==========================================
// 1. ADMIN DISHES ROUTES
// ==========================================
router.get('/dishes', dishController.renderAdminList);
router.get('/dishes/new', dishController.renderCreateForm);
router.post('/dishes', upload.single('image'), dishController.create);
router.get('/dishes/:id/edit', dishController.renderEditForm);
router.patch('/dishes/:id', upload.single('image'), dishController.update);
// Duy nhất 'admin' mới có quyền XÓA (DELETE) món ăn; 'editor' gửi DELETE nhận 403
router.delete('/dishes/:id', requireRole(['admin']), dishController.remove);

// ==========================================
// 2. ADMIN CHEFS ROUTES
// ==========================================
router.get('/chefs', chefController.renderAdminList);
router.get('/chefs/new', chefController.renderCreateForm);
router.post('/chefs', upload.single('image'), chefController.create);
router.get('/chefs/:id/edit', chefController.renderEditForm);
router.patch('/chefs/:id', upload.single('image'), chefController.update);
// Duy nhất 'admin' mới có quyền XÓA (DELETE) đầu bếp; 'editor' gửi DELETE nhận 403
router.delete('/chefs/:id', requireRole(['admin']), chefController.remove);

// ==========================================
// 3. ADMIN INGREDIENTS ROUTES
// ==========================================
router.get('/ingredients', ingredientController.renderAdminList);
router.get('/ingredients/new', ingredientController.renderCreateForm);
router.post('/ingredients', upload.single('image'), ingredientController.create);
router.get('/ingredients/:id/edit', ingredientController.renderEditForm);
router.patch('/ingredients/:id', upload.single('image'), ingredientController.update);
// Duy nhất 'admin' mới có quyền XÓA (DELETE) nguyên liệu; 'editor' gửi DELETE nhận 403
router.delete('/ingredients/:id', requireRole(['admin']), ingredientController.remove);

module.exports = router;
