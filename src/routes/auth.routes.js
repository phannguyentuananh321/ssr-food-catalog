const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { redirectIfAuthenticated } = require('../middleware/auth');

router.get('/login', redirectIfAuthenticated, authController.renderLoginPage);
router.post('/login', authController.login);

router.get('/register', redirectIfAuthenticated, authController.renderRegisterPage);
router.post('/register', authController.register);

router.get('/verify', authController.renderVerifyPage);
router.post('/verify', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerification);

router.get('/callback', authController.authCallback);

router.get('/forgot-password', redirectIfAuthenticated, authController.renderForgotPage);
router.post('/forgot-password', authController.forgotPassword);

// The recovery callback establishes a session before this page is rendered.
router.get('/reset-password', authController.renderResetPage);
router.post('/reset-password', authController.resetPassword);

// Logout must be a POST handled by Supabase's SDK, never a GET link.
router.post('/logout', authController.logout);

module.exports = router;
