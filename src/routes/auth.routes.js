const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { redirectIfAuthenticated } = require('../middleware/auth');

// ==========================================
// ĐĂNG KÝ VÀ KÍCH HOẠT (BƯỚC 4)
// ==========================================
router.get('/register', redirectIfAuthenticated, authController.renderRegisterPage);
router.post('/register', authController.register);

router.get('/activate', authController.renderActivatePage);
router.post('/activate', authController.activate);
router.post('/activate/resend', authController.resendActivation);

// Alias tương thích cũ cho verify
router.get('/verify', (req, res) => res.redirect(303, '/activate'));
router.post('/verify', authController.activate);
router.post('/resend-verification', authController.resendActivation);

// ==========================================
// ĐĂNG NHẬP & ĐĂNG XUẤT (BƯỚC 5 & 6)
// ==========================================
router.get('/login', redirectIfAuthenticated, authController.renderLoginPage);
router.post('/login', authController.login);
router.post('/logout', authController.logout);

// ==========================================
// QUÊN MẬT KHẨU & ĐẶT LẠI MẬT KHẨU (BƯỚC 7)
// ==========================================
router.get('/forgot', redirectIfAuthenticated, authController.renderForgotPage);
router.post('/forgot', authController.forgotPassword);
router.get('/forgot-password', (req, res) => res.redirect(303, '/forgot'));
router.post('/forgot-password', authController.forgotPassword);

router.get('/reset', authController.renderResetPage);
router.post('/reset', authController.resetPassword);
router.get('/reset-password', (req, res) => res.redirect(303, req.originalUrl.replace('/reset-password', '/reset')));
router.post('/reset-password', authController.resetPassword);

module.exports = router;
