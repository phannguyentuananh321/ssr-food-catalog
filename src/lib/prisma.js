const { PrismaClient } = require('@prisma/client');
const { config } = require('../config/env');

let prisma;

try {
  // Prevent multiple instances in development reload
  if (process.env.NODE_ENV === 'production') {
    prisma = new PrismaClient({
      log: ['error', 'warn']
    });
  } else {
    if (!global.__prisma) {
      global.__prisma = new PrismaClient({
        log: ['error', 'warn']
      });
    }
    prisma = global.__prisma;
  }
} catch (err) {
  console.error('[PRISMA INIT ERROR]:', err.message);
}

module.exports = prisma;
