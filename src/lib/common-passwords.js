/**
 * Danh sách ~50 mật khẩu phổ biến nhất cần chặn.
 */
const COMMON_PASSWORDS = new Set([
  '123456',
  '12345678',
  '123456789',
  '1234567890',
  'password',
  'password123',
  'admin123',
  'qwerty',
  'qwerty123',
  '111111',
  '123123',
  '1234567',
  'google',
  'welcome',
  'welcome123',
  'iloveyou',
  'sunshine',
  'princess',
  'dragon',
  'football',
  'monkey',
  'shadow',
  'master',
  'michael',
  'jordan',
  'superman',
  'harley',
  'charlie',
  'batman',
  'andrew',
  'daniel',
  'hockey',
  'killer',
  'trustno1',
  'mustang',
  'starwars',
  'whatever',
  'cheating',
  'nothing',
  'matrix',
  'baseball',
  'hunter2',
  'secret',
  'letmein',
  'access',
  'pass1234',
  'changeme',
  'test1234',
  'temp1234',
  'admin'
]);

function isCommonPassword(password) {
  if (!password || typeof password !== 'string') return false;
  return COMMON_PASSWORDS.has(password.trim().toLowerCase());
}

module.exports = {
  COMMON_PASSWORDS,
  isCommonPassword
};
