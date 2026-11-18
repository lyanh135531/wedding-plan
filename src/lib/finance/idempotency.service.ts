import { db as defaultDb } from '@/db/client';
import { idempotencyRecords } from '@/db/schema/system';
import { users } from '@/db/schema/auth';
import { eq, and, sql } from 'drizzle-orm';
import crypto from 'crypto';

export class IdempotencyConflictError extends Error {
  readonly statusCode = 409;
  constructor(message = 'Khóa chống trùng (Idempotency Key) đã được sử dụng với nội dung dữ liệu khác') {
    super(message);
    this.name = 'IdempotencyConflictError';
  }
}

export class IdempotencyInFlightError extends Error {
  readonly statusCode = 409;
  constructor(message = 'Yêu cầu đang trong quá trình xử lý, vui lòng chờ') {
    super(message);
    this.name = 'IdempotencyInFlightError';
  }
}

export class IdempotencyForbiddenError extends Error {
  readonly statusCode = 403;
  constructor(message = 'Quyền hạn đã bị thu hồi, không thể thực hiện hoặc đọc lại kết quả giao dịch') {
    super(message);
    this.name = 'IdempotencyForbiddenError';
  }
}

/**
 * Deterministically computes a SHA-256 hash of a payload object.
 * Recursively sorts object keys so { a: 1, b: 2 } has the same hash as { b: 2, a: 1 }.
 */
export function hashPayload(payload: unknown): string {
  const canonicalJson = serializeCanonical(payload);
  return crypto.createHash('sha256').update(canonicalJson).digest('hex');
}

function serializeCanonical(val: unknown): string {
  if (val === null || val === undefined) return 'null';
  if (typeof val === 'bigint') return `"${val.toString()}"`;
  if (typeof val !== 'object') return JSON.stringify(val);
  if (val instanceof Date) return JSON.stringify(val.toISOString());
  if (Array.isArray(val)) {
    return '[' + val.map((v) => serializeCanonical(v)).join(',') + ']';
  }
  const obj = val as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const pairs = keys.map((k) => `${JSON.stringify(k)}:${serializeCanonical(obj[k])}`);
  return '{' + pairs.join(',') + '}';
}

export interface IdempotencyExecutionOptions<T> {
  /** Must be the same scoped transaction used by execute for atomic financial writes. */
  transactionDb?: Pick<typeof defaultDb, 'select' | 'insert' | 'update' | 'execute'>;
  key?: string | null;
  userId: string;
  operationType: string;
  payload: unknown;
  ttlHours?: number;
  execute: () => Promise<{ status: number; body: T }>;
}

/**
 * Wraps an operation with strict idempotency guarantees.
 *
 * Requirements:
 * - AT13: Duplicate requests with same key and payload return cached response without duplicate execution.
 * - AT54: Same key with different payload throws 409 Conflict.
 * - AT54: Replay after permission revoked throws 403 Forbidden.
 */
export async function withIdempotency<T>(
  options: IdempotencyExecutionOptions<T>
): Promise<{ status: number; body: T; fromCache: boolean }> {
  const { key, userId, operationType, payload, ttlHours = 24, execute } = options;
  const db = options.transactionDb || defaultDb;

  // If no idempotency key provided, execute directly without caching
  if (!key || key.trim() === '') {
    const result = await execute();
    return { ...result, fromCache: false };
  }

  const cleanKey = key.trim();
  const requestHash = hashPayload(payload);
  if (options.transactionDb) {
    // Serialize identical requests until both the mutation and cached result commit.
    await db.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify([userId, operationType, cleanKey])}, 0))`);
  }

  // 1. Check user authorization status in live database (AT54: Replay after permission revoked)
  const [userRecord] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!userRecord || userRecord.role !== 'owner') {
    throw new IdempotencyForbiddenError();
  }

  // 2. Check existing idempotency record
  const [existingRecord] = await db
    .select()
    .from(idempotencyRecords)
    .where(
      and(
        eq(idempotencyRecords.userId, userId),
        eq(idempotencyRecords.operationType, operationType),
        eq(idempotencyRecords.idempotencyKey, cleanKey)
      )
    )
    .limit(1);

  if (existingRecord) {
    // AT54: Payload mismatch
    if (existingRecord.requestHash !== requestHash) {
      throw new IdempotencyConflictError();
    }

    // AT13: Completed request -> return cached response
    if (existingRecord.status === 'completed') {
      return {
        status: existingRecord.responseStatus || 200,
        body: existingRecord.responseBody as T,
        fromCache: true,
      };
    }

    if (existingRecord.status === 'processing') {
      throw new IdempotencyInFlightError();
    }
  }

  // 3. Insert new processing record
  const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000);
  let recordId: string;

  try {
    const [inserted] = await db
      .insert(idempotencyRecords)
      .values({
        userId,
        operationType,
        idempotencyKey: cleanKey,
        requestHash,
        status: 'processing',
        expiresAt,
      })
      .returning({ id: idempotencyRecords.id });
    recordId = inserted.id;
  } catch (err: any) {
    // Handle concurrent insert race condition (Postgres 23505 unique violation)
    if (err?.code === '23505' || err?.message?.includes('idempotency_records_unique')) {
      const [raceRecord] = await db
        .select()
        .from(idempotencyRecords)
        .where(
          and(
            eq(idempotencyRecords.userId, userId),
            eq(idempotencyRecords.operationType, operationType),
            eq(idempotencyRecords.idempotencyKey, cleanKey)
          )
        )
        .limit(1);

      if (raceRecord) {
        if (raceRecord.requestHash !== requestHash) {
          throw new IdempotencyConflictError();
        }
        if (raceRecord.status === 'completed') {
          return {
            status: raceRecord.responseStatus || 200,
            body: raceRecord.responseBody as T,
            fromCache: true,
          };
        }
        throw new IdempotencyInFlightError();
      }
    }
    throw err;
  }

  // 4. Execute mutation
  try {
    const result = await execute();

    // 5. Update record to completed
    await db
      .update(idempotencyRecords)
      .set({
        status: 'completed',
        responseStatus: result.status,
        responseBody: result.body as any,
      })
      .where(eq(idempotencyRecords.id, recordId));

    return { ...result, fromCache: false };
  } catch (executeError) {
    // 6. Delete or mark failed on error
    await db
      .update(idempotencyRecords)
      .set({ status: 'failed' })
      .where(eq(idempotencyRecords.id, recordId))
      .catch(() => {});

    throw executeError;
  }
}
