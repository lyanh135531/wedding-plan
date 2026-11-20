import { Pool, PoolClient, PoolConfig } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

export type UserRole = 'owner' | 'family_view';

export interface DbContext {
  userId: string;
  role: UserRole;
}

// -------------------------------------------------------------
// Connection Pool Configuration
// -------------------------------------------------------------
const poolConfig: PoolConfig = {
  connectionString: process.env.DATABASE_URL,
  min: process.env.DB_POOL_MIN ? parseInt(process.env.DB_POOL_MIN, 10) : 2,
  max: process.env.DB_POOL_MAX ? parseInt(process.env.DB_POOL_MAX, 10) : 10,
  idleTimeoutMillis: process.env.DB_IDLE_TIMEOUT_MS
    ? parseInt(process.env.DB_IDLE_TIMEOUT_MS, 10)
    : 30000,
  connectionTimeoutMillis: process.env.DB_CONNECTION_TIMEOUT_MS
    ? parseInt(process.env.DB_CONNECTION_TIMEOUT_MS, 10)
    : 5000,
};

// Next.js can evaluate this module separately for API routes and hot reloads.
// Keep the pool on the process global so each evaluation shares its connections.
const databaseGlobal = globalThis as typeof globalThis & {
  weddingPostgresPool?: { key: string; pool: Pool };
};
const poolKey = JSON.stringify(poolConfig);
const cachedPool = databaseGlobal.weddingPostgresPool;
export const pool = cachedPool?.key === poolKey ? cachedPool.pool : new Pool(poolConfig);
if (cachedPool?.pool !== pool) {
  if (cachedPool) void cachedPool.pool.end().catch(() => {});
  databaseGlobal.weddingPostgresPool = { key: poolKey, pool };
  pool.on('error', (err) => {
    console.error('[DB Pool Error] Unexpected error on idle client:', err);
  });
}

// Default Drizzle instance wrapping the raw pool (for unauthenticated system migrations / health checks)
export const db = drizzle(pool, { schema });
export const globalDb = db;

// -------------------------------------------------------------
// Transaction-Scoped Context Wrapper
// -------------------------------------------------------------

/**
 * Executes a callback within an explicit PostgreSQL transaction with RLS context variables set.
 * Guarantees DISCARD ALL execution upon completion, preventing connection context leakage (AT57).
 *
 * @param userId - Validated user identifier (UUID or provider ID)
 * @param role - Application role: 'owner' or 'family_view'
 * @param callback - Async function receiving the scoped PoolClient and Drizzle instance
 * @param clientOverride - Optional PoolClient override (useful for testing)
 */
export async function withTransactionScopedContext<T>(
  userId: string,
  role: UserRole,
  callback: (client: PoolClient, db: NodePgDatabase<typeof schema>) => Promise<T>,
  clientOverride?: PoolClient,
  isolation: 'read committed' | 'repeatable read' = 'read committed'
): Promise<T> {
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    throw new Error('withTransactionScopedContext requires a valid, non-empty userId.');
  }

  if (role !== 'owner' && role !== 'family_view') {
    throw new Error(`Invalid role '${role}' specified for transaction context.`);
  }

  const client = clientOverride ?? (await pool.connect());
  const scopedDb = drizzle(client, { schema });

  let isTransactionActive = false;

  try {
    // 1. Begin explicit transaction
    await client.query(isolation === 'repeatable read' ? 'BEGIN ISOLATION LEVEL REPEATABLE READ;' : 'BEGIN;');
    isTransactionActive = true;

    // 2. Set transaction-local session configuration variables
    // set_config(name, value, is_local = true) scopes variables strictly to this transaction
    await client.query(
      `SELECT 
        set_config('app.current_user_id', $1, true),
        set_config('app.current_role', $2, true);`,
      [userId, role]
    );

    // 3. Execute business logic within transaction
    const result = await callback(client, scopedDb);

    // 4. Commit transaction
    await client.query('COMMIT;');
    isTransactionActive = false;

    return result;
  } catch (error) {
    if (isTransactionActive) {
      try {
        await client.query('ROLLBACK;');
      } catch (rollbackError) {
        console.error('[DB Transaction Rollback Error]:', rollbackError);
      }
    }
    let cause: any = error;
    while (cause) {
      if (cause.code === '23514' && /chu trình phụ thuộc/.test(cause.message || '')) {
        throw Object.assign(new Error('Công việc không được tạo chu trình phụ thuộc.'), { statusCode: 409 });
      }
      if (cause.code === 'P0001' && /lưu trữ/.test(cause.message || '')) {
        throw Object.assign(new Error('Đám cưới đang lưu trữ. Hãy mở lại trước khi chỉnh sửa.'), { statusCode: 403 });
      }
      cause = cause.cause;
    }
    throw error;
  } finally {
    // 5. Mandatory session sanitization: DISCARD ALL (AT57)
    // Ensures zero residual state (GUCs, temp tables, prepared statements) leak to pooled connection
    try {
      await client.query('DISCARD ALL;');
      if (!clientOverride) {
        client.release();
      }
    } catch (discardError) {
      console.error('[DB Pool Sanitization Error] DISCARD ALL failed, destroying client:', discardError);
      // Passing true forces pool to permanently destroy and eject this client instance
      if (!clientOverride) {
        client.release(true);
      }
    }
  }
}

/**
 * Health check helper validating database connectivity and GUC parameter capability.
 */
export async function checkDatabaseHealth(): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now();
  const client = await pool.connect();
  try {
    await client.query('SELECT 1;');
    return { ok: true, latencyMs: Date.now() - start };
  } finally {
    client.release();
  }
}
