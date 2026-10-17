const express = require('express');
const router = express.Router();
const dishController = require('../controllers/dish.controller');

// Public routes for Dish
router.get('/', dishController.renderPublicList);
router.get('/:id', dishController.renderPublicDetail);

module.exports = router;
