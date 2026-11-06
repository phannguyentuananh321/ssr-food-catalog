const session = require('express-session');
const prisma = require('./prisma');

class PrismaSessionStore extends session.Store {
  constructor() {
    super();
    // Dọn session hết hạn định kỳ mỗi 10 phút
    this.cleanupInterval = setInterval(async () => {
      try {
        await prisma.session.deleteMany({
          where: {
            expiresAt: {
              lte: new Date()
            }
          }
        });
      } catch (err) {
        // Silently catch to avoid crashing
      }
    }, 10 * 60 * 1000);

    // Không giữ process Node.js chạy vô hạn khi chạy test
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  async get(sid, callback) {
    try {
      const record = await prisma.session.findUnique({
        where: { sid }
      });

      if (!record) {
        return callback(null, null);
      }

      if (record.expiresAt && record.expiresAt.getTime() <= Date.now()) {
        // Hết hạn: xóa và trả về null
        await prisma.session.delete({ where: { sid } }).catch(() => {});
        return callback(null, null);
      }

      const sessionData = JSON.parse(record.data);
      return callback(null, sessionData);
    } catch (err) {
      return callback(err);
    }
  }

  async set(sid, sessionData, callback) {
    try {
      let expiresAt;
      if (sessionData.cookie && sessionData.cookie.expires) {
        expiresAt = new Date(sessionData.cookie.expires);
      } else {
        const maxAge = (sessionData.cookie && sessionData.cookie.maxAge) || 24 * 60 * 60 * 1000;
        expiresAt = new Date(Date.now() + maxAge);
      }

      // Copy session.userId vào cột userId
      const userId = sessionData.userId || null;
      const data = JSON.stringify(sessionData);

      await prisma.session.upsert({
        where: { sid },
        update: {
          userId,
          data,
          expiresAt
        },
        create: {
          sid,
          userId,
          data,
          expiresAt
        }
      });

      return callback(null);
    } catch (err) {
      return callback(err);
    }
  }

  async destroy(sid, callback) {
    try {
      await prisma.session.delete({
        where: { sid }
      }).catch((err) => {
        // Record might not exist (P2025)
        if (err.code !== 'P2025') throw err;
      });
      return callback(null);
    } catch (err) {
      return callback(err);
    }
  }

  async touch(sid, sessionData, callback) {
    try {
      let expiresAt;
      if (sessionData.cookie && sessionData.cookie.expires) {
        expiresAt = new Date(sessionData.cookie.expires);
      } else {
        const maxAge = (sessionData.cookie && sessionData.cookie.maxAge) || 24 * 60 * 60 * 1000;
        expiresAt = new Date(Date.now() + maxAge);
      }

      await prisma.session.update({
        where: { sid },
        data: { expiresAt }
      }).catch((err) => {
        if (err.code !== 'P2025') throw err;
      });

      return callback(null);
    } catch (err) {
      return callback(err);
    }
  }
}

module.exports = {
  PrismaSessionStore
};
