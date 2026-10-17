const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');

const dishController = require('../controllers/dish.controller');
const chefController = require('../controllers/chef.controller');
const ingredientController = require('../controllers/ingredient.controller');

// ==========================================
// 1. ADMIN DISHES ROUTES
// ==========================================
router.get('/dishes', dishController.renderAdminList);
router.get('/dishes/new', dishController.renderCreateForm);
router.post('/dishes', upload.single('image'), dishController.create);
router.get('/dishes/:id/edit', dishController.renderEditForm);
router.patch('/dishes/:id', upload.single('image'), dishController.update);
router.delete('/dishes/:id', dishController.remove);

// ==========================================
// 2. ADMIN CHEFS ROUTES
// ==========================================
router.get('/chefs', chefController.renderAdminList);
router.get('/chefs/new', chefController.renderCreateForm);
router.post('/chefs', upload.single('image'), chefController.create);
router.get('/chefs/:id/edit', chefController.renderEditForm);
router.patch('/chefs/:id', upload.single('image'), chefController.update);
router.delete('/chefs/:id', chefController.remove);

// ==========================================
// 3. ADMIN INGREDIENTS ROUTES
// ==========================================
router.get('/ingredients', ingredientController.renderAdminList);
router.get('/ingredients/new', ingredientController.renderCreateForm);
router.post('/ingredients', upload.single('image'), ingredientController.create);
router.get('/ingredients/:id/edit', ingredientController.renderEditForm);
router.patch('/ingredients/:id', upload.single('image'), ingredientController.update);
router.delete('/ingredients/:id', ingredientController.remove);

module.exports = router;
