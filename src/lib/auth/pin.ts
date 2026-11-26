import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { asc, eq, sql } from 'drizzle-orm';
import { makeSignature } from 'better-auth/crypto';
import { withTransactionScopedContext } from '@/db/client';
import { users, sessions, verifications } from '@/db/schema/auth';
import { weddingSettings } from '@/db/schema/events';
import { auditLogs } from '@/db/schema/system';
import { auth } from './auth';
import { getCurrentSession, type UserSession } from './session';

export const PIN_REGEX = /^\d{6}$/;
export const PIN_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
export const PIN_MAX_IP_ATTEMPTS = 5;
export const PIN_MAX_GLOBAL_ATTEMPTS = 25;
export const PIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export const SESSION_COOKIE_NAMES = [
  'session_token',
  '__Secure-session_token',
  'better-auth.session_token',
  '__Secure-better-auth.session_token',
] as const;

export class PinAuthError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
  }
}

export interface RateLimitDecision {
  blocked: boolean;
  count: number;
  remainingAttempts: number;
  retryAfterSeconds: number;
  windowEndsAtMs: number;
}

/** Validates whether an input string strictly matches 6 numeric digits. */
export function isValidPinFormat(pin: unknown): pin is string {
  return typeof pin === 'string' && PIN_REGEX.test(pin);
}

/** Hashes a 6-digit PIN using salted scrypt for persistent storage. */
export function hashPin(pin: string): string {
  if (!isValidPinFormat(pin)) {
    throw new PinAuthError(400, 'Mã PIN phải gồm đúng 6 chữ số.');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(pin, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

/** Timing-safe verification of a 6-digit PIN against a stored scrypt hash. */
export function verifyPinHash(pin: string, storedHash: string): boolean {
  if (!isValidPinFormat(pin) || typeof storedHash !== 'string') {
    return false;
  }
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }
  const [, saltHex, hashHex] = parts;
  if (!/^[a-f0-9]{32}$/i.test(saltHex) || !/^[a-f0-9]{128}$/i.test(hashHex)) {
    return false;
  }
  try {
    const derived = crypto.scryptSync(pin, saltHex, 64);
    const expected = Buffer.from(hashHex, 'hex');
    if (derived.length !== expected.length) {
      return false;
    }
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/** Timing-safe verification of a 6-digit PIN against a plaintext env fallback. */
export function verifyPlaintextPin(pin: string, expectedPin: string): boolean {
  if (!isValidPinFormat(pin) || !isValidPinFormat(expectedPin)) {
    return false;
  }
  const actualBuf = Buffer.from(pin, 'utf8');
  const expectedBuf = Buffer.from(expectedPin, 'utf8');
  if (actualBuf.length !== expectedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

/** Pure helper evaluating a stored rate-limit JSON window at a given timestamp. */
export function evaluateRateLimitWindow(
  rawValue: string | null,
  maxAttempts: number,
  nowMs: number = Date.now(),
  windowMs: number = PIN_RATE_LIMIT_WINDOW_MS
): RateLimitDecision {
  let count = 0;
  let windowEndsAtMs = nowMs + windowMs;

  if (rawValue) {
    try {
      const parsed = JSON.parse(rawValue) as { count?: unknown; windowEndsAtMs?: unknown };
      if (
        typeof parsed.count === 'number' &&
        Number.isFinite(parsed.count) &&
        typeof parsed.windowEndsAtMs === 'number' &&
        parsed.windowEndsAtMs > nowMs
      ) {
        count = Math.max(0, Math.floor(parsed.count));
        windowEndsAtMs = parsed.windowEndsAtMs;
      }
    } catch {
      // Treat corrupted state as a fresh window.
    }
  }

  const blocked = count >= maxAttempts;
  const remainingAttempts = Math.max(0, maxAttempts - count);
  const retryAfterSeconds = blocked
    ? Math.max(1, Math.ceil((windowEndsAtMs - nowMs) / 1000))
    : 0;

  return { blocked, count, remainingAttempts, retryAfterSeconds, windowEndsAtMs };
}

/** Extracts client IP behind reverse proxy / Cloudflare Tunnel for rate limiting. */
export function getClientIp(req: Request): string {
  const cfIp = req.headers.get('cf-connecting-ip')?.trim();
  if (cfIp) return cfIp;
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwarded) return forwarded;
  const realIp = req.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  return 'local';
}

function ipBucketId(clientIp: string): string {
  const digest = crypto.createHash('sha256').update(clientIp).digest('hex').slice(0, 24);
  return `pin-rl:ip:${digest}`;
}

const GLOBAL_BUCKET_ID = 'pin-rl:global';

/** Checks per-IP and global rate-limit buckets before validating PIN attempts. */
export async function checkPinRateLimit(
  clientIp: string,
  nowMs: number = Date.now()
): Promise<{ allowed: boolean; retryAfterSeconds: number; remainingAttempts: number }> {
  const ipId = ipBucketId(clientIp);
  return withTransactionScopedContext('trusted-auth-service', 'owner', async (_client, db) => {
    const [ipRow] = await db
      .select({ value: verifications.value })
      .from(verifications)
      .where(eq(verifications.id, ipId))
      .limit(1);
    const [globalRow] = await db
      .select({ value: verifications.value })
      .from(verifications)
      .where(eq(verifications.id, GLOBAL_BUCKET_ID))
      .limit(1);

    const ipState = evaluateRateLimitWindow(ipRow?.value ?? null, PIN_MAX_IP_ATTEMPTS, nowMs);
    const globalState = evaluateRateLimitWindow(
      globalRow?.value ?? null,
      PIN_MAX_GLOBAL_ATTEMPTS,
      nowMs
    );

    if (ipState.blocked || globalState.blocked) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(ipState.retryAfterSeconds, globalState.retryAfterSeconds),
        remainingAttempts: 0,
      };
    }

    return {
      allowed: true,
      retryAfterSeconds: 0,
      remainingAttempts: Math.min(ipState.remainingAttempts, globalState.remainingAttempts),
    };
  });
}

async function incrementBucket(
  bucketId: string,
  maxAttempts: number,
  nowMs: number
): Promise<RateLimitDecision> {
  return withTransactionScopedContext('trusted-auth-service', 'owner', async (client, db) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [bucketId]);
    const [existing] = await db
      .select({ value: verifications.value })
      .from(verifications)
      .where(eq(verifications.id, bucketId))
      .limit(1);

    const current = evaluateRateLimitWindow(existing?.value ?? null, maxAttempts, nowMs);
    const nextCount = current.count + 1;
    const windowEndsAtMs = current.count === 0 ? nowMs + PIN_RATE_LIMIT_WINDOW_MS : current.windowEndsAtMs;
    const payload = JSON.stringify({ count: nextCount, windowEndsAtMs });
    const expiresAt = new Date(windowEndsAtMs);

    await db
      .insert(verifications)
      .values({
        id: bucketId,
        identifier: 'pin_rate_limit',
        value: payload,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: verifications.id,
        set: { value: payload, expiresAt, updatedAt: new Date() },
      });

    return evaluateRateLimitWindow(payload, maxAttempts, nowMs);
  });
}

/** Records a failed PIN guess against per-IP and global rate limits. */
export async function recordFailedPinAttempt(
  clientIp: string,
  nowMs: number = Date.now()
): Promise<{ blocked: boolean; retryAfterSeconds: number; remainingAttempts: number }> {
  const [ipState, globalState] = await Promise.all([
    incrementBucket(ipBucketId(clientIp), PIN_MAX_IP_ATTEMPTS, nowMs),
    incrementBucket(GLOBAL_BUCKET_ID, PIN_MAX_GLOBAL_ATTEMPTS, nowMs),
  ]);

  const blocked = ipState.blocked || globalState.blocked;
  return {
    blocked,
    retryAfterSeconds: Math.max(ipState.retryAfterSeconds, globalState.retryAfterSeconds),
    remainingAttempts: blocked
      ? 0
      : Math.min(ipState.remainingAttempts, globalState.remainingAttempts),
  };
}

/** Clears failed-attempt lockout for the client IP once PIN succeeds. */
export async function clearPinRateLimit(clientIp: string): Promise<void> {
  const ipId = ipBucketId(clientIp);
  await withTransactionScopedContext('trusted-auth-service', 'owner', async (_client, db) => {
    await db.delete(verifications).where(eq(verifications.id, ipId));
  });
}

/** Verifies input PIN against DB pin_hash first, falling back to WEDDING_LOGIN_PIN env. */
export async function verifyConfiguredPin(
  pin: string
): Promise<{ configured: boolean; valid: boolean; hasDbPin: boolean }> {
  if (!isValidPinFormat(pin)) {
    return { configured: true, valid: false, hasDbPin: false };
  }

  const settings = await withTransactionScopedContext(
    'trusted-auth-service',
    'owner',
    async (_client, db) => {
      const [row] = await db
        .select({ pinHash: weddingSettings.pinHash })
        .from(weddingSettings)
        .limit(1);
      return row ?? null;
    }
  );

  if (settings?.pinHash) {
    return {
      configured: true,
      valid: verifyPinHash(pin, settings.pinHash),
      hasDbPin: true,
    };
  }

  const envPin = process.env.WEDDING_LOGIN_PIN?.trim();
  if (envPin && isValidPinFormat(envPin)) {
    return {
      configured: true,
      valid: verifyPlaintextPin(pin, envPin),
      hasDbPin: false,
    };
  }

  return { configured: false, valid: false, hasDbPin: false };
}

/** Resolves existing primary owner ID or inserts a default local owner if DB is empty. */
export async function ensurePrimaryOwnerId(): Promise<string> {
  return withTransactionScopedContext('trusted-auth-service', 'owner', async (client, db) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('primary-owner-bootstrap'))");
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, 'owner'))
      .orderBy(asc(users.createdAt))
      .limit(1);

    if (existing) {
      return existing.id;
    }

    const [created] = await db
      .insert(users)
      .values({
        id: 'owner-primary',
        name: 'Cô dâu & Chú rể',
        email: 'couple@wedding.local',
        emailVerified: true,
        role: 'owner',
      })
      .onConflictDoNothing({ target: users.id })
      .returning({ id: users.id });

    return created?.id ?? 'owner-primary';
  });
}

/** Creates a 30-day PostgreSQL session and returns its HMAC-signed cookie value. */
export async function createOwnerPinSession(
  ownerUserId: string,
  req: Request
): Promise<{ signedCookieValue: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString('hex');
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + PIN_SESSION_TTL_SECONDS * 1000);
  const ipAddress = getClientIp(req);
  const userAgent = req.headers.get('user-agent')?.slice(0, 256) ?? null;

  await withTransactionScopedContext('trusted-auth-service', 'owner', async (_client, db) => {
    await db.insert(sessions).values({
      id: sessionId,
      userId: ownerUserId,
      token,
      expiresAt,
      ipAddress,
      userAgent,
    });
  });

  const { secret } = await auth.$context;
  const signature = await makeSignature(token, secret);
  return {
    signedCookieValue: `${token}.${signature}`,
    expiresAt,
  };
}

/** Determines whether secure HTTPS session cookies should be set for this request. */
export function isSecureSessionCookieRequest(req: Request): boolean {
  const host = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '').toLowerCase();
  const isLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1');
  if (req.headers.get('x-forwarded-proto') === 'https') return true;
  if (req.url.startsWith('https://')) return true;
  if (!isLocal && (process.env.APP_URL || '').startsWith('https://')) return true;
  return false;
}

/** Attaches the signed owner session cookie and clears stale variants. */
export function attachSessionCookie(res: NextResponse, signedValue: string, req: Request): void {
  const secure = isSecureSessionCookieRequest(req);
  const primaryName = secure ? '__Secure-session_token' : 'session_token';
  for (const name of SESSION_COOKIE_NAMES) {
    if (name !== primaryName) {
      res.cookies.set(name, '', { path: '/', maxAge: 0 });
    }
  }
  res.cookies.set(primaryName, signedValue, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: PIN_SESSION_TTL_SECONDS,
  });
}

/** Clears all known session cookies on logout. */
export function clearAllSessionCookies(res: NextResponse): void {
  for (const name of SESSION_COOKIE_NAMES) {
    res.cookies.set(name, '', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
  }
}

/** Deletes the active session from DB if present. */
export async function revokeCurrentSession(req: Request): Promise<void> {
  const session = await getCurrentSession(req);
  if (!session) return;
  await withTransactionScopedContext(session.user.id, 'owner', async (_client, db) => {
    await db.delete(sessions).where(eq(sessions.id, session.session.id));
  });
}

/** Verifies current PIN and saves the new salted scrypt hash in wedding_settings. */
export async function updateWeddingPin(
  session: UserSession,
  currentPin: string,
  newPin: string
): Promise<{ updated: true }> {
  if (session.role !== 'owner') {
    throw new PinAuthError(403, 'Chỉ chủ sở hữu mới được đổi mã PIN.');
  }
  if (!isValidPinFormat(currentPin) || !isValidPinFormat(newPin)) {
    throw new PinAuthError(400, 'Mã PIN phải gồm đúng 6 chữ số.');
  }

  const check = await verifyConfiguredPin(currentPin);
  if (!check.configured) {
    throw new PinAuthError(400, 'Hệ thống chưa được cấu hình mã PIN ban đầu.');
  }
  if (!check.valid) {
    throw new PinAuthError(400, 'Mã PIN hiện tại không đúng.');
  }

  const nextHash = hashPin(newPin);

  await withTransactionScopedContext(session.user.id, 'owner', async (_client, db) => {
    const [settings] = await db
      .select({ id: weddingSettings.id })
      .from(weddingSettings)
      .limit(1);

    if (!settings) {
      throw new PinAuthError(
        400,
        'Vui lòng thiết lập thông tin đám cưới trước khi cập nhật mã PIN.'
      );
    }

    await db
      .update(weddingSettings)
      .set({
        pinHash: nextHash,
        version: sql`${weddingSettings.version} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(weddingSettings.id, settings.id));

    await db.insert(auditLogs).values({
      userId: session.user.id,
      action: 'UPDATE_APP_PIN',
      entityType: 'wedding_settings',
      entityId: settings.id,
      afterState: { pinUpdated: true },
    });
  });

  return { updated: true };
}
