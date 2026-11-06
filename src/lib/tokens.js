const crypto = require('crypto');
const { config } = require('../config/env');

/**
 * Chuẩn hóa email: trim và lowercase, không xử lý riêng cho Gmail.
 */
function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

/**
 * Sinh mã OTP 6 chữ số ngẫu nhiên an toàn bằng crypto.randomInt
 */
function generateOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * otpHash = HMAC-SHA256(OTP_PEPPER, userId:purpose:otp)
 */
function hashOtp(userId, purpose, otp) {
  const pepper = config.OTP_PEPPER;
  if (!pepper) {
    throw new Error('OTP_PEPPER is not configured');
  }
  const payload = `${userId}:${purpose}:${otp}`;
  return crypto.createHmac('sha256', pepper).update(payload).digest('hex');
}

/**
 * So sánh OTP hash bằng crypto.timingSafeEqual
 */
function verifyOtp(storedHash, userId, purpose, inputOtp) {
  if (!storedHash || !userId || !purpose || !inputOtp) {
    return false;
  }
  const computedHash = hashOtp(userId, purpose, inputOtp);
  const bufA = Buffer.from(storedHash, 'utf8');
  const bufB = Buffer.from(computedHash, 'utf8');

  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Sinh reset token: crypto.randomBytes(32).toString('base64url')
 */
function generateResetToken() {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * tokenHash = SHA-256(token)
 */
function hashResetToken(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Token must be a non-empty string');
  }
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * So sánh tokenHash bằng crypto.timingSafeEqual
 */
function verifyResetToken(storedHash, rawToken) {
  if (!storedHash || !rawToken) {
    return false;
  }
  const computedHash = hashResetToken(rawToken);
  const bufA = Buffer.from(storedHash, 'utf8');
  const bufB = Buffer.from(computedHash, 'utf8');

  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = {
  normalizeEmail,
  generateOtp,
  hashOtp,
  verifyOtp,
  generateResetToken,
  hashResetToken,
  verifyResetToken
};
