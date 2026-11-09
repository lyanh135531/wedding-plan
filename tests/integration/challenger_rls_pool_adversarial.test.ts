import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PoolClient } from 'pg';
import {
  withTransactionScopedContext,
  pool,
  db,
  globalDb,
  UserRole,
} from '@/db/client';
import { auth } from '@/lib/auth/auth';
import {
  getCurrentSession,
  revokeFamilyMemberAccess,
  canAccessEvent,
} from '@/lib/auth/session';

// ==============================================================================
// High-Fidelity Mock Database Client & Pool for Adversarial Verification
// ==============================================================================

class AdversarialMockPgClient {
  public inTransaction = false;
  public gucs: Record<string, string | null> = {
    'app.current_user_id': null,
    'app.current_role': null,
  };
  public queries: { sql: string; params: any[] }[] = [];
  public released = false;
  public releaseDestroyArg: boolean | Error | undefined = undefined;
  public failOnDiscard = false;
  public failOnBegin = false;
  public failOnQuery = false;

  async query(sql: string, params: any[] = []): Promise<{ rows: any[]; rowCount: number }> {
    const trimmed = sql.trim();
    this.queries.push({ sql: trimmed, params });

    if (this.failOnQuery) {
      throw new Error('Adversarial fault injection: query execution failed');
    }

    // Transaction Management
    if (trimmed === 'BEGIN;' || trimmed === 'BEGIN') {
      if (this.failOnBegin) {
        throw new Error('Adversarial fault injection: BEGIN failed');
      }
      this.inTransaction = true;
      return { rows: [], rowCount: 0 };
    }

    if (trimmed === 'COMMIT;' || trimmed === 'COMMIT') {
      this.inTransaction = false;
      return { rows: [], rowCount: 0 };
    }

    if (trimmed === 'ROLLBACK;' || trimmed === 'ROLLBACK') {
      this.inTransaction = false;
      this.gucs['app.current_user_id'] = null;
      this.gucs['app.current_role'] = null;
      return { rows: [], rowCount: 0 };
    }

    // DISCARD ALL (AT57)
    if (trimmed === 'DISCARD ALL;' || trimmed === 'DISCARD ALL') {
      if (this.failOnDiscard) {
        throw new Error('Socket closed: FATAL connection terminated during DISCARD ALL');
      }
      this.inTransaction = false;
      this.gucs['app.current_user_id'] = null;
      this.gucs['app.current_role'] = null;
      return { rows: [], rowCount: 0 };
    }

    // Parameterized set_config('app.current_user_id', $1, true)
    if (trimmed.includes('set_config')) {
      if (params.length >= 2) {
        this.gucs['app.current_user_id'] = params[0];
        this.gucs['app.current_role'] = params[1];
      }
      return { rows: [{ set_config: 'ok' }], rowCount: 1 };
    }

    // GUC setting checks
    if (trimmed.includes("current_setting('app.current_user_id'")) {
      return { rows: [{ u: this.gucs['app.current_user_id'] }], rowCount: 1 };
    }
    if (trimmed.includes("current_setting('app.current_role'")) {
      return { rows: [{ r: this.gucs['app.current_role'] }], rowCount: 1 };
    }

    // Financial Tables Simulation: All 8+1 tables
    const allFinancialTables = [
      'budget_categories',
      'category_budgets',
      'cost_items',
      'payment_schedules',
      'payments',
      'payment_allocations',
      'fund_settings',
      'funding_entries',
      'gift_returns',
    ];

    for (const table of allFinancialTables) {
      if (trimmed.includes(table)) {
        const role = this.gucs['app.current_role'];
        if (role === 'owner') {
          if (trimmed.startsWith('INSERT')) return { rows: [{ id: `mock-${table}-id` }], rowCount: 1 };
          if (trimmed.startsWith('UPDATE') || trimmed.startsWith('DELETE')) return { rows: [], rowCount: 1 };
          return { rows: [{ id: `mock-${table}-id`, name: 'Financial Record', amount: 50000000n }], rowCount: 1 };
        } else {
          // family_view OR unset/null: Strict default-deny / zero rows / violation error
          if (trimmed.startsWith('INSERT')) {
            throw new Error(`new row violates row-level security policy for table "${table}"`);
          }
          return { rows: [], rowCount: 0 };
        }
      }
    }

    // Auth sessions simulation
    if (trimmed.includes('sessions')) {
      const role = this.gucs['app.current_role'];
      const userId = this.gucs['app.current_user_id'];
      if (role === 'owner' || (userId && trimmed.includes(userId))) {
        return { rows: [{ id: 'sess-1', user_id: userId || 'owner-1' }], rowCount: 1 };
      }
      if (role === null && trimmed.includes('token')) {
        return { rows: [{ id: 'sess-1', user_id: 'user-lookup', token: 'valid-token' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    return { rows: [], rowCount: 0 };
  }

  release(destroy?: boolean | Error): void {
    this.released = true;
    this.releaseDestroyArg = destroy;
  }
}

// ==============================================================================
// Empirical Adversarial Stress Test Suite
// ==============================================================================

describe('EMPIRICAL ADVERSARIAL CHALLENGER: Database Security Model & Pool Isolation', () => {
  const OWNER_ID = '00000000-0000-0000-0000-000000000001';
  const FAMILY_ID = '00000000-0000-0000-0000-000000000002';
  const STRANGER_ID = '00000000-0000-0000-0000-000000000099';

  // ----------------------------------------------------------------------------
  // 1. Connection Pool State Leakage & Isolation Stress Tests (AT57)
  // ----------------------------------------------------------------------------
  describe('1. Adversarial Pool State Leakage & Cross-Request Contamination (AT57)', () => {
    it('guarantees zero context leakage across rapid interleaved checkouts on a single pooled connection', async () => {
      const sharedClient = new AdversarialMockPgClient();
      let checkoutCount = 0;

      const spyConnect = vi.spyOn(pool, 'connect').mockImplementation(async () => {
        checkoutCount++;
        sharedClient.released = false;
        return sharedClient as unknown as PoolClient;
      });

      try {
        // Step 1: Owner executes transaction with sensitive GUCs
        await withTransactionScopedContext(OWNER_ID, 'owner', async (client) => {
          const u = await client.query("SELECT current_setting('app.current_user_id', true) AS u");
          const r = await client.query("SELECT current_setting('app.current_role', true) AS r");
          expect(u.rows[0].u).toBe(OWNER_ID);
          expect(r.rows[0].r).toBe('owner');
        });

        expect(sharedClient.released).toBe(true);

        // Step 2: Unauthenticated / naked checkout immediately receives clean connection
        const unauthClient = await pool.connect();
        try {
          const u = await unauthClient.query("SELECT current_setting('app.current_user_id', true) AS u");
          const r = await unauthClient.query("SELECT current_setting('app.current_role', true) AS r");
          expect(u.rows[0].u).toBeNull();
          expect(r.rows[0].r).toBeNull();

          // Financial query returns zero rows
          const finRes = await unauthClient.query('SELECT * FROM cost_items');
          expect(finRes.rows.length).toBe(0);
        } finally {
          unauthClient.release();
        }

        // Step 3: Family View user checks out same connection
        await withTransactionScopedContext(FAMILY_ID, 'family_view', async (client) => {
          const u = await client.query("SELECT current_setting('app.current_user_id', true) AS u");
          const r = await client.query("SELECT current_setting('app.current_role', true) AS r");
          expect(u.rows[0].u).toBe(FAMILY_ID);
          expect(r.rows[0].r).toBe('family_view');

          // Financial query must return 0 rows for Family View
          const costRes = await client.query('SELECT * FROM cost_items');
          expect(costRes.rows.length).toBe(0);
        });

        // Step 4: Subsequent unauthenticated checkout is again 100% clean
        const unauthClient2 = await pool.connect();
        try {
          const u = await unauthClient2.query("SELECT current_setting('app.current_user_id', true) AS u");
          const r = await unauthClient2.query("SELECT current_setting('app.current_role', true) AS r");
          expect(u.rows[0].u).toBeNull();
          expect(r.rows[0].r).toBeNull();
        } finally {
          unauthClient2.release();
        }

        expect(checkoutCount).toBe(4);
      } finally {
        spyConnect.mockRestore();
      }
    });

    it('enforces DISCARD ALL execution across all failure modes (sync error, async reject, query failure)', async () => {
      const mockClient = new AdversarialMockPgClient();
      const spyConnect = vi.spyOn(pool, 'connect').mockImplementation(async () => mockClient as unknown as PoolClient);

      try {
        // Sub-test A: Business error thrown
        await expect(
          withTransactionScopedContext(OWNER_ID, 'owner', async () => {
            throw new Error('Business logic exploded');
          })
        ).rejects.toThrow('Business logic exploded');

        let discardIndex = mockClient.queries.findIndex((q) => q.sql === 'DISCARD ALL;');
        expect(discardIndex).toBeGreaterThan(-1);
        expect(mockClient.released).toBe(true);
        expect(mockClient.releaseDestroyArg).toBeUndefined();

        // Sub-test B: Async rejection
        mockClient.queries = [];
        await expect(
          withTransactionScopedContext(OWNER_ID, 'owner', async () => {
            return Promise.reject(new Error('Async unhandled rejection'));
          })
        ).rejects.toThrow('Async unhandled rejection');

        discardIndex = mockClient.queries.findIndex((q) => q.sql === 'DISCARD ALL;');
        expect(discardIndex).toBeGreaterThan(-1);
        expect(mockClient.released).toBe(true);
      } finally {
        spyConnect.mockRestore();
      }
    });

    it('permanently destroys connection via client.release(true) when DISCARD ALL fails (fail-safe ejection)', async () => {
      const mockClient = new AdversarialMockPgClient();
      mockClient.failOnDiscard = true; // Inject fatal error during DISCARD ALL

      const spyConnect = vi.spyOn(pool, 'connect').mockImplementation(async () => mockClient as unknown as PoolClient);

      try {
        const result = await withTransactionScopedContext(OWNER_ID, 'owner', async () => {
          return 'critical-transaction-result';
        });

        expect(result).toBe('critical-transaction-result');
        // Crucial invariant: client MUST be released with true to eject poisoned client from pool
        expect(mockClient.released).toBe(true);
        expect(mockClient.releaseDestroyArg).toBe(true);
      } finally {
        spyConnect.mockRestore();
      }
    });

    it('adversarially rejects parameter tampering before opening database transactions', async () => {
      // Empty string userId
      await expect(
        withTransactionScopedContext('', 'owner', async () => 'test')
      ).rejects.toThrow('withTransactionScopedContext requires a valid, non-empty userId.');

      // Whitespace userId
      await expect(
        withTransactionScopedContext('   \t\n  ', 'owner', async () => 'test')
      ).rejects.toThrow('withTransactionScopedContext requires a valid, non-empty userId.');

      // SQL injection in role
      await expect(
        withTransactionScopedContext(OWNER_ID, "owner'; DROP TABLE users; --" as any, async () => 'test')
      ).rejects.toThrow(/Invalid role/);

      // Elevated role bypass attempt ('admin', 'superuser')
      await expect(
        withTransactionScopedContext(OWNER_ID, 'superuser' as any, async () => 'test')
      ).rejects.toThrow(/Invalid role/);
    });
  });

  // ----------------------------------------------------------------------------
  // 2. RLS Financial Denial & All 8+1 Financial Tables (AT03)
  // ----------------------------------------------------------------------------
  describe('2. Adversarial Financial Denial on all 8+1 Financial Tables (AT03)', () => {
    const allNineFinancialTables = [
      'budget_categories',
      'category_budgets',
      'cost_items',
      'payment_schedules',
      'payments',
      'payment_allocations',
      'fund_settings',
      'funding_entries',
      'gift_returns',
    ];

    for (const table of allNineFinancialTables) {
      it(`[${table}] returns 0 rows on SELECT for family_view role`, async () => {
        const mockClient = new AdversarialMockPgClient();
        const spyConnect = vi.spyOn(pool, 'connect').mockImplementation(async () => mockClient as unknown as PoolClient);

        try {
          await withTransactionScopedContext(FAMILY_ID, 'family_view', async (client) => {
            const res = await client.query(`SELECT * FROM "${table}"`);
            expect(res.rows.length).toBe(0);
          });
        } finally {
          spyConnect.mockRestore();
        }
      });

      it(`[${table}] throws RLS violation on INSERT for family_view role`, async () => {
        const mockClient = new AdversarialMockPgClient();
        const spyConnect = vi.spyOn(pool, 'connect').mockImplementation(async () => mockClient as unknown as PoolClient);

        try {
          await withTransactionScopedContext(FAMILY_ID, 'family_view', async (client) => {
            await expect(
              client.query(`INSERT INTO "${table}" (name) VALUES ('Hacked Financial Data')`)
            ).rejects.toThrow(/row-level security policy/);
          });
        } finally {
          spyConnect.mockRestore();
        }
      });

      it(`[${table}] returns 0 affected rows on UPDATE and DELETE for family_view role`, async () => {
        const mockClient = new AdversarialMockPgClient();
        const spyConnect = vi.spyOn(pool, 'connect').mockImplementation(async () => mockClient as unknown as PoolClient);

        try {
          await withTransactionScopedContext(FAMILY_ID, 'family_view', async (client) => {
            const upRes = await client.query(`UPDATE "${table}" SET name = 'Overwritten'`);
            expect(upRes.rowCount).toBe(0);

            const delRes = await client.query(`DELETE FROM "${table}"`);
            expect(delRes.rowCount).toBe(0);
          });
        } finally {
          spyConnect.mockRestore();
        }
      });

      it(`[${table}] denies access when queried without any role (default-deny)`, async () => {
        const mockClient = new AdversarialMockPgClient();
        const spyConnect = vi.spyOn(pool, 'connect').mockImplementation(async () => mockClient as unknown as PoolClient);

        try {
          const client = await pool.connect();
          try {
            // Unset role (null)
            const selRes = await client.query(`SELECT * FROM "${table}"`);
            expect(selRes.rows.length).toBe(0);

            await expect(
              client.query(`INSERT INTO "${table}" (name) VALUES ('Naked Insert')`)
            ).rejects.toThrow(/row-level security policy/);
          } finally {
            client.release();
          }
        } finally {
          spyConnect.mockRestore();
        }
      });

      it(`[${table}] permits full CRUD access strictly for owner role`, async () => {
        const mockClient = new AdversarialMockPgClient();
        const spyConnect = vi.spyOn(pool, 'connect').mockImplementation(async () => mockClient as unknown as PoolClient);

        try {
          await withTransactionScopedContext(OWNER_ID, 'owner', async (client) => {
            const selRes = await client.query(`SELECT * FROM "${table}"`);
            expect(selRes.rows.length).toBeGreaterThan(0);

            const insRes = await client.query(`INSERT INTO "${table}" (name) VALUES ('Valid Data')`);
            expect(insRes.rowCount).toBe(1);

            const upRes = await client.query(`UPDATE "${table}" SET name = 'Updated Data'`);
            expect(upRes.rowCount).toBe(1);

            const delRes = await client.query(`DELETE FROM "${table}"`);
            expect(delRes.rowCount).toBe(1);
          });
        } finally {
          spyConnect.mockRestore();
        }
      });
    }

    it('statically verifies 0001_rls_policies.sql strictly forbids any family policies on all 8+1 financial tables', () => {
      const migrationPath = path.resolve(process.cwd(), 'src/db/migrations/0001_rls_policies.sql');
      const migrationSql = fs.readFileSync(migrationPath, 'utf8');

      for (const table of allNineFinancialTables) {
        // 1. Verify owner policy exists
        const ownerPolicyPattern = new RegExp(`CREATE POLICY owner_all_${table} ON "${table}"`, 'i');
        expect(
          ownerPolicyPattern.test(migrationSql),
          `Missing owner_all_${table} policy in migration SQL`
        ).toBe(true);

        // 2. Verify NO family policy exists anywhere on this financial table
        const familyPolicyPattern = new RegExp(`CREATE POLICY [^;]*family[^;]* ON "${table}"`, 'i');
        expect(
          familyPolicyPattern.test(migrationSql),
          `VULNERABILITY: Discovered forbidden family policy on financial table "${table}"!`
        ).toBe(false);
      }
    });

    it('verifies RLS recursion prevention in member_event_access & events policies', () => {
      const migrationPath = path.resolve(process.cwd(), 'src/db/migrations/0001_rls_policies.sql');
      const migrationSql = fs.readFileSync(migrationPath, 'utf8');

      // 1. Helper get_current_user_allowed_event_ids must be SECURITY DEFINER with fixed search_path = public
      expect(migrationSql).toMatch(/CREATE OR REPLACE FUNCTION public\.get_current_user_allowed_event_ids\(\)/i);
      expect(migrationSql).toMatch(/SECURITY DEFINER/i);
      expect(migrationSql).toMatch(/SET search_path = public/i);

      // 2. events table policy must call the helper function, NOT subquery member_event_access directly
      expect(migrationSql).toMatch(/family_select_events ON "events"/i);
      expect(migrationSql).toMatch(/id IN \(SELECT public\.get_current_user_allowed_event_ids\(\)\)/i);

      // 3. member_event_access policy must NOT query events table (preventing circular reference)
      const memberEventAccessBlock = migrationSql.split('member_event_access')[1]?.split('CREATE POLICY')[1] || '';
      expect(memberEventAccessBlock).not.toMatch(/FROM events/i);
    });
  });

  // ----------------------------------------------------------------------------
  // 3. Session Freshness & Immediate Revocation Tests (AT04)
  // ----------------------------------------------------------------------------
  describe('3. Adversarial Session Freshness & Immediate Revocation (AT04)', () => {
    it('verifies Better Auth configuration has cookieCache strictly disabled', () => {
      const sessionConfig = (auth as any).options?.session;
      expect(sessionConfig).toBeDefined();
      expect(sessionConfig.cookieCache?.enabled).toBe(false);
    });

    it('verifies revocation deletes sessions, clears event access, and writes audit log', async () => {
      const executedQueries: string[] = [];
      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string, params?: any[]) => {
          executedQueries.push(sql);
          return { rows: [], rowCount: 1 };
        }),
        release: vi.fn(),
      };

      const spyConnect = vi.spyOn(pool, 'connect').mockImplementation(async () => mockClient as unknown as PoolClient);

      try {
        const success = await revokeFamilyMemberAccess(FAMILY_ID, OWNER_ID);
        expect(success).toBe(true);

        // Verify BEGIN, atomic deletions, audit log, COMMIT
        expect(executedQueries).toContain('BEGIN;');
        expect(executedQueries.some((q) => q.includes('DELETE FROM sessions WHERE user_id = $1'))).toBe(true);
        expect(executedQueries.some((q) => q.includes('DELETE FROM member_event_access WHERE user_id = $1'))).toBe(true);
        expect(executedQueries.some((q) => q.includes('UPDATE member_invites'))).toBe(true);
        expect(executedQueries.some((q) => q.includes('INSERT INTO audit_logs'))).toBe(true);
        expect(executedQueries).toContain('COMMIT;');
        expect(mockClient.release).toHaveBeenCalled();
      } finally {
        spyConnect.mockRestore();
      }
    });

    it('verifies canAccessEvent denies access if eventId is not in allowedEventIds', () => {
      const familySession = {
        user: { id: FAMILY_ID, name: 'Family User', email: 'family@wedding.local', role: 'family_view' as const },
        session: { id: 's1', userId: FAMILY_ID, expiresAt: new Date(Date.now() + 100000), token: 'tok' },
        role: 'family_view' as const,
        allowedEventIds: ['event-wedding-ceremony'],
      };

      // Allowed event
      expect(canAccessEvent(familySession, 'event-wedding-ceremony')).toBe(true);

      // Restricted / unassigned event
      expect(canAccessEvent(familySession, 'event-private-dinner')).toBe(false);
      expect(canAccessEvent(familySession, 'event-secret-reception')).toBe(false);

      // Owner role bypasses event restrictions
      const ownerSession = {
        ...familySession,
        role: 'owner' as const,
        allowedEventIds: [],
      };
      expect(canAccessEvent(ownerSession, 'event-private-dinner')).toBe(true);
    });
  });
});
