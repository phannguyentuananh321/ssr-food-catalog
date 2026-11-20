const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settings.controller');
const { requireAuth } = require('../middleware/auth');

// Toàn bộ các route trong Cài đặt đều yêu cầu phải có phiên đăng nhập hợp lệ
router.use(requireAuth);

router.get('/security', settingsController.renderSecuritySettings);
router.post('/2fa/setup', settingsController.start2faSetup);
router.post('/2fa/cancel', settingsController.cancel2faSetup);
router.post('/2fa/confirm', settingsController.confirm2fa);
router.post('/2fa/disable', settingsController.disable2fa);
router.post('/2fa/regenerate-recovery-codes', settingsController.regenerateRecoveryCodes);

module.exports = router;
