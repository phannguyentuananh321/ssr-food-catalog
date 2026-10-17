const express = require('express');
const router = express.Router();
const chefController = require('../controllers/chef.controller');

// Public routes for Chef
router.get('/', chefController.renderPublicList);
router.get('/:id', chefController.renderPublicDetail);

module.exports = router;
