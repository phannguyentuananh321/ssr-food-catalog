const express = require('express');
const router = express.Router();
const apiController = require('../controllers/api.controller');

router.get('/dishes', apiController.listDishes);
router.get('/chefs', apiController.listChefs);
router.get('/ingredients', apiController.listIngredients);
router.get('/bookmarks', apiController.resolveBookmarks);

module.exports = router;
