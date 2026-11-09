/**
 * Database Transaction & RLS Context Helpers for Testing.
 * Tests transaction-scoped SET LOCAL variables and connection pool sanitization.
 */

export interface MockDbClientState {
  inTransaction: boolean;
  currentUserId: string | null;
  currentRole: string | null;
  queries: string[];
}

export class MockDbClient {
  public state: MockDbClientState = {
    inTransaction: false,
    currentUserId: null,
    currentRole: null,
    queries: [],
  };

  async query(sql: string, params: unknown[] = []): Promise<{ rows: unknown[]; rowCount: number }> {
    this.state.queries.push(sql);

    const trimmed = sql.trim().toUpperCase();

    if (trimmed === 'BEGIN' || trimmed === 'BEGIN;') {
      this.state.inTransaction = true;
      return { rows: [], rowCount: 0 };
    }

    if (trimmed === 'COMMIT' || trimmed === 'COMMIT;') {
      this.state.inTransaction = false;
      return { rows: [], rowCount: 0 };
    }

    if (trimmed === 'ROLLBACK' || trimmed === 'ROLLBACK;') {
      this.state.inTransaction = false;
      this.state.currentUserId = null;
      this.state.currentRole = null;
      return { rows: [], rowCount: 0 };
    }

    if (trimmed === 'DISCARD ALL' || trimmed === 'DISCARD ALL;' || trimmed === 'RESET ALL' || trimmed === 'RESET ALL;') {
      this.state.inTransaction = false;
      this.state.currentUserId = null;
      this.state.currentRole = null;
      return { rows: [], rowCount: 0 };
    }

    // Parse SET LOCAL app.current_user_id
    const userMatch = sql.match(/SET\s+LOCAL\s+app\.current_user_id\s*=\s*(?:'([^']+)'|\$1)/i);
    if (userMatch) {
      this.state.currentUserId = (params[0] as string) || userMatch[1] || null;
      return { rows: [], rowCount: 0 };
    }

    // Parse SET LOCAL app.current_role
    const roleMatch = sql.match(/SET\s+LOCAL\s+app\.current_role\s*=\s*(?:'([^']+)'|\$1)/i);
    if (roleMatch) {
      this.state.currentRole = (params[0] as string) || roleMatch[1] || null;
      return { rows: [], rowCount: 0 };
    }

    return { rows: [], rowCount: 0 };
  }

  reset(): void {
    this.state = {
      inTransaction: false,
      currentUserId: null,
      currentRole: null,
      queries: [],
    };
  }
}

/**
 * Execute a callback within an isolated transaction-scoped context.
 * Strictly guarantees DISCARD ALL upon checkout/checkin (AT57).
 */
export async function withMockTransactionScopedContext<T>(
  client: MockDbClient,
  userId: string,
  role: 'owner' | 'family_view',
  callback: (client: MockDbClient) => Promise<T>
): Promise<T> {
  await client.query('BEGIN');
  await client.query(`SET LOCAL app.current_user_id = '${userId}'`);
  await client.query(`SET LOCAL app.current_role = '${role}'`);

  try {
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    // Guarantees no residual context leaks across pooled connections (AT57)
    await client.query('DISCARD ALL');
  }
}

/**
 * Verify that a database client has zero residual context.
 */
export function assertNoContextLeak(client: MockDbClient): void {
  if (client.state.currentUserId !== null || client.state.currentRole !== null) {
    throw new Error(
      `Connection pool leak detected! Residual state: userId=${client.state.currentUserId}, role=${client.state.currentRole}`
    );
  }
}
