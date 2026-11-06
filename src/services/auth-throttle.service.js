const crypto = require('crypto');
const prisma = require('../lib/prisma');
const { config } = require('../config/env');

// Delays are applied when the corresponding failure count is reached.
const LOCK_STEPS = [
  { minFailures: 5, seconds: 30 * 60 },
  { minFailures: 4, seconds: 5 * 60 },
  { minFailures: 3, seconds: 30 }
];

function lockSecondsForFailureCount(failureCount) {
  const step = LOCK_STEPS.find((entry) => failureCount >= entry.minFailures);
  return step ? step.seconds : 0;
}

function normalizeIp(ip) {
  return String(ip || 'unknown').trim();
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function buildLoginIdentifier(ip, email) {
  return hash(`login|${normalizeIp(ip)}|${normalizeEmail(email)}`);
}

function buildRegistrationIdentifier(ip) {
  return hash(`register|${normalizeIp(ip)}`);
}

function toStatus(row, now = Date.now()) {
  if (!row) {
    return {
      failureCount: 0,
      locked: false,
      retryAfterSeconds: 0,
      captchaRequired: false
    };
  }

  const retryAfterSeconds = row.lockedUntil
    ? Math.max(0, Math.ceil((row.lockedUntil.getTime() - now) / 1000))
    : 0;

  return {
    failureCount: row.failureCount,
    locked: retryAfterSeconds > 0,
    retryAfterSeconds,
    captchaRequired: row.failureCount >= 3
  };
}

async function getLoginStatus(identifier) {
  const row = await prisma.loginThrottle.findUnique({ where: { identifier } });
  return toStatus(row);
}

async function recordLoginFailure(identifier) {
  const row = await prisma.loginThrottle.upsert({
    where: { identifier },
    create: {
      identifier,
      failureCount: 1,
      lastFailureAt: new Date()
    },
    update: {
      failureCount: { increment: 1 },
      lastFailureAt: new Date()
    }
  });

  const lockSeconds = lockSecondsForFailureCount(row.failureCount);
  if (lockSeconds > 0) {
    const lockedUntil = new Date(Date.now() + lockSeconds * 1000);
    const updated = await prisma.loginThrottle.update({
      where: { identifier },
      data: { lockedUntil }
    });
    return toStatus(updated);
  }

  return toStatus(row);
}

async function resetLoginFailures(identifier) {
  await prisma.loginThrottle.deleteMany({ where: { identifier } });
}

async function consumeRegistrationAttempt(ip) {
  const identifier = buildRegistrationIdentifier(ip);
  const now = new Date();
  const windowMs = config.REGISTRATION_WINDOW_MINUTES * 60 * 1000;
  const limit = config.REGISTRATION_LIMIT;

  const row = await prisma.registrationThrottle.findUnique({ where: { identifier } });

  if (!row || now.getTime() - row.windowStart.getTime() >= windowMs) {
    await prisma.registrationThrottle.upsert({
      where: { identifier },
      create: { identifier, count: 1, windowStart: now },
      update: { count: 1, windowStart: now }
    });
    return { allowed: true, remaining: Math.max(0, limit - 1) };
  }

  if (row.count >= limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((row.windowStart.getTime() + windowMs - now.getTime()) / 1000)
    );
    return { allowed: false, retryAfterSeconds, remaining: 0 };
  }

  const updated = await prisma.registrationThrottle.update({
    where: { identifier },
    data: { count: { increment: 1 } }
  });

  return { allowed: true, remaining: Math.max(0, limit - updated.count) };
}

module.exports = {
  lockSecondsForFailureCount,
  buildLoginIdentifier,
  buildRegistrationIdentifier,
  getLoginStatus,
  recordLoginFailure,
  resetLoginFailures,
  consumeRegistrationAttempt
};
