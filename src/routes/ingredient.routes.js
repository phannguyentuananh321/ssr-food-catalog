const express = require('express');
const router = express.Router();
const ingredientController = require('../controllers/ingredient.controller');

// Public routes for Ingredient
router.get('/', ingredientController.renderPublicList);
router.get('/:id', ingredientController.renderPublicDetail);

module.exports = router;
