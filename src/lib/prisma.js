const { PrismaClient } = require('@prisma/client');
const { config } = require('../config/env');

let prisma;

/**
 * Tự động tối ưu hóa URL kết nối cho Supabase và Prisma:
 * - Nếu dùng Supabase Pooler cổng 5432 (Session mode - giới hạn 15 kết nối),
 *   tự động chuyển sang cổng 6543 (Transaction mode) kèm pgbouncer=true.
 * - Tự động thiết lập connection_limit=3 trên mỗi client Node.js
 *   để nhiều thành viên test cùng lúc không làm cạn kiệt connection pool.
 */
function getOptimizedDatabaseUrl() {
  const url = config.DATABASE_URL;
  if (!url) return url;
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has('connection_limit')) {
      parsed.searchParams.set('connection_limit', '3');
    }
    if (parsed.host && parsed.host.includes('pooler.supabase.com') && parsed.port === '5432') {
      parsed.port = '6543';
      parsed.searchParams.set('pgbouncer', 'true');
    }
    return parsed.toString();
  } catch (e) {
    return url;
  }
}

try {
  const clientOptions = {
    log: ['error', 'warn'],
    datasources: {
      db: {
        url: getOptimizedDatabaseUrl()
      }
    }
  };

  if (process.env.NODE_ENV === 'production') {
    prisma = new PrismaClient(clientOptions);
  } else {
    if (!global.__prisma) {
      global.__prisma = new PrismaClient(clientOptions);
    }
    prisma = global.__prisma;
  }
} catch (err) {
  console.error('[PRISMA INIT ERROR]:', err.message);
}

module.exports = prisma;
