const crypto = require('crypto');
const otplib = require('otplib');
const QRCode = require('qrcode');

/**
 * Sinh secret ngẫu nhiên cho Google Authenticator (Base32)
 */
function generateMfaSecret() {
  return otplib.generateSecret();
}

/**
 * Sinh URI chuẩn otpauth:// cho ứng dụng quét
 * @param {string} email 
 * @param {string} secret 
 * @param {string} issuer 
 */
function generateKeyuri(email, secret, issuer = 'Ấm Vị') {
  return otplib.generateURI({
    secret,
    label: email,
    issuer
  });
}

/**
 * Sinh mã QR dạng Base64 Data URL để hiển thị trực tiếp trong thẻ <img> EJS
 * @param {string} otpauthUrl 
 */
async function generateQrCodeDataUrl(otpauthUrl) {
  return QRCode.toDataURL(otpauthUrl, {
    width: 250,
    margin: 2,
    color: {
      dark: '#292820',
      light: '#FFFDF8'
    }
  });
}

/**
 * Kiểm tra mã 6 số từ Google Authenticator
 * @param {string} token - Mã 6 số người dùng nhập
 * @param {string} secret - Mã bí mật lưu trong DB của user
 * @returns {boolean}
 */
function verifyTotp(token, secret) {
  if (!token || !secret) return false;
  const cleanToken = String(token).replace(/\s+/g, '');
  try {
    const result = otplib.verifySync({
      token: cleanToken,
      secret,
      epochTolerance: 30 // Bù trừ lệch 1 chu kỳ 30s
    });
    return Boolean(result && result.valid);
  } catch (err) {
    return false;
  }
}

/**
 * Chuẩn hóa mã dự phòng (bỏ dấu gạch ngang, khoảng trắng, chuyển chữ hoa)
 * @param {string} code 
 */
function normalizeRecoveryCode(code) {
  if (!code) return '';
  return String(code).replace(/[-\s]/g, '').toUpperCase();
}

/**
 * Băm mã dự phòng bằng SHA-256
 * @param {string} code 
 */
function hashRecoveryCode(code) {
  const normalized = normalizeRecoveryCode(code);
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Sinh danh sách 10 mã dự phòng ngẫu nhiên định dạng XXXX-XXXX
 * @param {number} count 
 */
function generateRecoveryCodes(count = 10) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    // 8 ký tự hex ngẫu nhiên chia 2 nhóm XXXX-XXXX
    const raw = crypto.randomBytes(4).toString('hex').toUpperCase();
    const formatted = `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
    codes.push(formatted);
  }
  return codes;
}

/**
 * So sánh an toàn mã dự phòng người dùng nhập với hash trong DB
 * @param {string} inputCode 
 * @param {string} storedHash 
 */
function verifyRecoveryCode(inputCode, storedHash) {
  if (!inputCode || !storedHash) return false;
  const inputHash = hashRecoveryCode(inputCode);
  const bufA = Buffer.from(inputHash, 'hex');
  const bufB = Buffer.from(storedHash, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = {
  generateMfaSecret,
  generateKeyuri,
  generateQrCodeDataUrl,
  verifyTotp,
  normalizeRecoveryCode,
  hashRecoveryCode,
  generateRecoveryCodes,
  verifyRecoveryCode
};
