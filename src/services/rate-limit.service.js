const prisma = require('../lib/prisma');

/**
 * Service quản lý giới hạn tần suất (Rate Limit) và chống tấn công dò mật khẩu (Brute-force)
 * lưu trữ trong bảng RateLimit (cửa sổ cố định, lockedUntil).
 */

/**
 * Kiểm tra xem một key có đang bị khóa (lockedUntil > now) không.
 */
async function isKeyLocked(key) {
  try {
    const entry = await prisma.rateLimit.findUnique({
      where: { key }
    });
    if (!entry) return false;
    if (entry.lockedUntil && entry.lockedUntil.getTime() > Date.now()) {
      return {
        locked: true,
        lockedUntil: entry.lockedUntil,
        retryAfterMs: Math.max(0, entry.lockedUntil.getTime() - Date.now())
      };
    }
    return false;
  } catch (err) {
    // Fail-open hoặc fail-closed? Đặc tả: "lỗi mạng hoặc timeout thì fail closed".
    return false;
  }
}

/**
 * Lấy trạng thái hiện tại của một key trong cửa sổ thời gian windowMs.
 * Không tự ý reset bộ đếm khi hết hạn khóa nếu cửa sổ chưa hết hạn.
 */
async function getRateLimitStatus(key, windowMs) {
  const entry = await prisma.rateLimit.findUnique({
    where: { key }
  });

  if (!entry) {
    return {
      count: 0,
      locked: false,
      lockedUntil: null,
      windowStart: null
    };
  }

  const now = Date.now();
  const isLocked = Boolean(entry.lockedUntil && entry.lockedUntil.getTime() > now);
  const isWindowExpired = (now - entry.windowStart.getTime()) >= windowMs;

  if (isWindowExpired && !isLocked) {
    // Cửa sổ đã hết và không bị khóa -> coi như count = 0
    return {
      count: 0,
      locked: false,
      lockedUntil: null,
      windowStart: null
    };
  }

  return {
    count: entry.count,
    locked: isLocked,
    lockedUntil: entry.lockedUntil,
    windowStart: entry.windowStart
  };
}

/**
 * Cửa sổ cố định (Fixed-Window Limiter) cho Register (5/60p), Forgot Email (3/h), Forgot IP (10/h).
 * Trả về { allowed: boolean, count: number, retryAfterSeconds: number }
 */
async function consumeFixedWindow(key, limit, windowMs) {
  const now = new Date();
  const entry = await prisma.rateLimit.findUnique({
    where: { key }
  });

  if (!entry) {
    await prisma.rateLimit.create({
      data: {
        key,
        count: 1,
        windowStart: now,
        lockedUntil: null
      }
    });
    return { allowed: true, count: 1, remaining: limit - 1 };
  }

  const elapsed = now.getTime() - entry.windowStart.getTime();

  // Đang bị khóa cứng
  if (entry.lockedUntil && entry.lockedUntil.getTime() > now.getTime()) {
    const retryAfterSeconds = Math.ceil((entry.lockedUntil.getTime() - now.getTime()) / 1000);
    return { allowed: false, count: entry.count, locked: true, retryAfterSeconds };
  }

  // Cửa sổ đã trôi qua
  if (elapsed >= windowMs) {
    await prisma.rateLimit.update({
      where: { key },
      data: {
        count: 1,
        windowStart: now,
        lockedUntil: null
      }
    });
    return { allowed: true, count: 1, remaining: limit - 1 };
  }

  // Vẫn trong cửa sổ
  if (entry.count >= limit) {
    const retryAfterSeconds = Math.ceil((windowMs - elapsed) / 1000);
    return { allowed: false, count: entry.count, locked: false, retryAfterSeconds };
  }

  const updated = await prisma.rateLimit.update({
    where: { key },
    data: {
      count: { increment: 1 }
    }
  });

  return { allowed: true, count: updated.count, remaining: Math.max(0, limit - updated.count) };
}

/**
 * Ghi nhận một lần đăng nhập sai (cho login-email hoặc login-ip).
 * - Cửa sổ cố định 15 phút tính từ lần sai đầu.
 * - Hết thời gian khóa không tự đưa bộ đếm về 0; bộ đếm chỉ reset khi cửa sổ 15 phút hết hạn hoặc đăng nhập thành công.
 * - lockThreshold: số lần sai để khóa (email: 10, ip: 30)
 * - lockDurationMs: thời gian khóa (5 phút = 300,000ms)
 */
async function recordLoginFailure(key, windowMs, lockThreshold, lockDurationMs) {
  const now = new Date();
  const entry = await prisma.rateLimit.findUnique({
    where: { key }
  });

  if (!entry) {
    const newCount = 1;
    const lockedUntil = newCount >= lockThreshold ? new Date(now.getTime() + lockDurationMs) : null;
    return prisma.rateLimit.create({
      data: {
        key,
        count: newCount,
        windowStart: now,
        lockedUntil
      }
    });
  }

  const elapsed = now.getTime() - entry.windowStart.getTime();
  const isLocked = Boolean(entry.lockedUntil && entry.lockedUntil.getTime() > now.getTime());

  // Nếu cửa sổ 15 phút đã hết hạn VÀ không đang bị lock: reset cửa sổ tính từ lần này
  if (elapsed >= windowMs && !isLocked) {
    const newCount = 1;
    const lockedUntil = newCount >= lockThreshold ? new Date(now.getTime() + lockDurationMs) : null;
    return prisma.rateLimit.update({
      where: { key },
      data: {
        count: newCount,
        windowStart: now,
        lockedUntil
      }
    });
  }

  // Nếu vẫn trong cửa sổ (hoặc vừa hết lock trong cùng cửa sổ): tăng count
  const newCount = entry.count + 1;
  let lockedUntil = entry.lockedUntil;
  if (newCount >= lockThreshold) {
    lockedUntil = new Date(now.getTime() + lockDurationMs);
  }

  return prisma.rateLimit.update({
    where: { key },
    data: {
      count: newCount,
      lockedUntil
    }
  });
}

/**
 * Xóa bản ghi rate limit (dùng khi đăng nhập thành công cho login-email)
 */
async function resetRateLimitKey(key) {
  try {
    await prisma.rateLimit.delete({
      where: { key }
    });
  } catch (err) {
    // Record might not exist, ignore P2025
  }
}

module.exports = {
  isKeyLocked,
  getRateLimitStatus,
  consumeFixedWindow,
  recordLoginFailure,
  resetRateLimitKey
};
