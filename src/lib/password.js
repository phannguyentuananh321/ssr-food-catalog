const argon2 = require('argon2');

/**
 * OWASP recommended parameters for Argon2id:
 * Type: Argon2id
 * Memory: 19456 KiB (19 MiB)
 * Iterations (timeCost): 2
 * Parallelism: 1
 */
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1
};

// Chuẩn bị một dummy hash hợp lệ khi khởi động để verify giả lập thời gian cho user không tồn tại
let dummyHash = '$argon2id$v=19$m=19456,t=2,p=1$w2N8b4Ff8u3F5R9qJ7k1LA$m5bK6aZ7i9X8y4W3v2U1t0S9r8Q7p6O5n4M3l2K1j0I';

(async () => {
  try {
    dummyHash = await argon2.hash('dummy_initialization_password_not_real', ARGON2_OPTIONS);
  } catch (err) {
    // Keep fallback dummy hash
  }
})();

async function hashPassword(plainPassword) {
  if (typeof plainPassword !== 'string' || !plainPassword) {
    throw new Error('Password must be a non-empty string');
  }
  return argon2.hash(plainPassword, ARGON2_OPTIONS);
}

async function verifyPassword(storedHash, plainPassword) {
  if (!storedHash || !plainPassword) {
    return false;
  }
  try {
    return await argon2.verify(storedHash, plainPassword);
  } catch (err) {
    return false;
  }
}

/**
 * Chạy verify với dummy hash để cân bằng thời gian (mitigate timing attacks)
 * khi user không tồn tại. Luôn trả về false.
 */
async function verifyDummy(plainPassword) {
  try {
    await argon2.verify(dummyHash, plainPassword || 'invalid_password');
  } catch (err) {
    // Ignore error
  }
  return false;
}

module.exports = {
  ARGON2_OPTIONS,
  hashPassword,
  verifyPassword,
  verifyDummy
};
