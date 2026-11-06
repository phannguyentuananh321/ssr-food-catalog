const express = require('express');
const router = express.Router();
const bookmarkController = require('../controllers/bookmark.controller');

router.get('/', bookmarkController.renderBookmarksPage);

module.exports = router;
