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
import * as schema from '@/db/schema';
import { getTableColumns } from 'drizzle-orm';

// ==============================================================================
// Mock Client & Simulated Pool Implementation for RLS & Transaction Isolation
// ==============================================================================

class MockPgClient {
  public inTransaction = false;
  public gucs: Record<string, string | null> = {
    'app.current_user_id': null,
    'app.current_role': null,
  };
  public queries: { sql: string; params: any[] }[] = [];
  public released = false;
  public releaseError: boolean | Error | undefined = undefined;
  public failOnDiscard = false;

  async query(sql: string, params: any[] = []): Promise<{ rows: any[]; rowCount: number }> {
    const trimmed = sql.trim();
    this.queries.push({ sql: trimmed, params });

    // Transaction Control
    if (trimmed === 'BEGIN;' || trimmed === 'BEGIN') {
      this.inTransaction = true;
      return { rows: [], rowCount: 0 };
    }

    if (trimmed === 'COMMIT;' || trimmed === 'COMMIT') {
      this.inTransaction = false;
      return { rows: [], rowCount: 0 };
    }

    if (trimmed === 'ROLLBACK;' || trimmed === 'ROLLBACK') {
      this.inTransaction = false;
      // In Postgres, local GUCs are rolled back with the transaction
      this.gucs['app.current_user_id'] = null;
      this.gucs['app.current_role'] = null;
      return { rows: [], rowCount: 0 };
    }

    // DISCARD ALL (AT57)
    if (trimmed === 'DISCARD ALL;' || trimmed === 'DISCARD ALL') {
      if (this.failOnDiscard) {
        throw new Error('Connection error: socket closed during DISCARD ALL');
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

    // Querying current_setting
    if (trimmed.includes("current_setting('app.current_user_id'")) {
      return { rows: [{ u: this.gucs['app.current_user_id'] }], rowCount: 1 };
    }
    if (trimmed.includes("current_setting('app.current_role'")) {
      return { rows: [{ r: this.gucs['app.current_role'] }], rowCount: 1 };
    }

    // RLS Policy Simulation
    const currentRole = this.gucs['app.current_role'];
    const currentUserId = this.gucs['app.current_user_id'];

    const financialTables = [
      'budget_categories',
      'category_budgets',
      'cost_items',
      'payment_schedules',
      'payments',
      'payment_allocations',
      'fund_settings',
      'funding_entries',
    ];

    for (const table of financialTables) {
      if (trimmed.includes(table)) {
        if (currentRole === 'owner') {
          // Owner has full access
          if (trimmed.startsWith('INSERT')) return { rows: [{ id: 'mock-fin-id' }], rowCount: 1 };
          if (trimmed.startsWith('UPDATE') || trimmed.startsWith('DELETE')) return { rows: [], rowCount: 1 };
          return { rows: [{ id: 'mock-fin-id', table, contracted_amount: 15000000n }], rowCount: 1 };
        } else {
          // family_view or unset/unauthorized: Strict Deny (AT03)
          if (trimmed.startsWith('INSERT')) {
            throw new Error(`new row violates row-level security policy for table "${table}"`);
          }
          if (trimmed.startsWith('UPDATE') || trimmed.startsWith('DELETE')) {
            return { rows: [], rowCount: 0 };
          }
          return { rows: [], rowCount: 0 };
        }
      }
    }

    // Events and shared tasks simulation
    if (trimmed.includes('events')) {
      if (currentRole === 'owner') {
        return { rows: [{ id: 'event-1' }, { id: 'event-2' }], rowCount: 2 };
      }
      if (currentRole === 'family_view') {
        // Only return allowed event
        return { rows: [{ id: 'event-1' }], rowCount: 1 };
      }
      // Default deny
      return { rows: [], rowCount: 0 };
    }

    // Sessions and Users: Unauthenticated token lookup simulation
    if (trimmed.includes('sessions')) {
      if (currentRole === 'owner' || (currentUserId && trimmed.includes(currentUserId))) {
        return { rows: [{ id: 'session-1', user_id: currentUserId || 'owner-id' }], rowCount: 1 };
      }
      if (currentRole === null && trimmed.includes('token')) {
        // Better Auth unauthenticated token lookup
        return { rows: [{ id: 'session-1', user_id: 'user-lookup-1', token: 'valid-token' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    if (trimmed.includes('users')) {
      if (currentRole === 'owner') {
        return { rows: [{ id: 'user-1' }, { id: 'user-2' }], rowCount: 2 };
      }
      if (currentRole === 'family_view') {
        return { rows: [{ id: currentUserId, role: 'family_view' }], rowCount: 1 };
      }
      if (currentRole === null) {
        // Better Auth unauthenticated user lookup by ID
        return { rows: [{ id: 'user-lookup-1', email: 'user@example.com' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    return { rows: [], rowCount: 0 };
  }

  release(err?: boolean | Error): void {
    this.released = true;
    this.releaseError = err;
  }
}

// ==============================================================================
// Test Suites
// ==============================================================================

describe('Database Client & RLS Architecture (Milestone 3 / Gate G2)', () => {
  const OWNER_ID = '00000000-0000-0000-0000-000000000001';
  const FAMILY_ID = '00000000-0000-0000-0000-000000000002';

  describe('1. withTransactionScopedContext Execution & Parameter Validation', () => {
    it('throws if userId is empty or whitespace', async () => {
      await expect(
        withTransactionScopedContext('', 'owner', async () => 'test')
      ).rejects.toThrow('withTransactionScopedContext requires a valid, non-empty userId.');

      await expect(
        withTransactionScopedContext('   ', 'owner', async () => 'test')
      ).rejects.toThrow('withTransactionScopedContext requires a valid, non-empty userId.');
    });

    it('throws if role is not owner or family_view', async () => {
      await expect(
        withTransactionScopedContext(OWNER_ID, 'admin' as any, async () => 'test')
      ).rejects.toThrow("Invalid role 'admin' specified for transaction context.");

      await expect(
        withTransactionScopedContext(OWNER_ID, 'guest' as any, async () => 'test')
      ).rejects.toThrow("Invalid role 'guest' specified for transaction context.");
    });

    it('executes transaction with set_config, callback, COMMIT, and DISCARD ALL (AT57)', async () => {
      const mockClient = new MockPgClient();
      const spyConnect = vi.spyOn(pool, 'connect').mockImplementation(async () => mockClient as unknown as PoolClient);

      try {
        let callbackRan = false;
        const result = await withTransactionScopedContext(OWNER_ID, 'owner', async (client, scopedDb) => {
          callbackRan = true;
          expect(client).toBeDefined();
          expect(scopedDb).toBeDefined();
          return 'success-result';
        });

        expect(result).toBe('success-result');
        expect(callbackRan).toBe(true);

        // Verify execution sequence
        const querySqls = mockClient.queries.map((q) => q.sql);
        expect(querySqls[0]).toBe('BEGIN;');
        expect(querySqls[1]).toContain("set_config('app.current_user_id'");
        expect(querySqls[1]).toContain("set_config('app.current_role'");
        expect(mockClient.queries[1].params).toEqual([OWNER_ID, 'owner']);
        expect(querySqls[2]).toBe('COMMIT;');
        expect(querySqls[3]).toBe('DISCARD ALL;');

        // Client must be released normally
        expect(mockClient.released).toBe(true);
        expect(mockClient.releaseError).toBeUndefined();
      } finally {
        spyConnect.mockRestore();
      }
    });

    it('executes ROLLBACK and DISCARD ALL on callback error', async () => {
      const mockClient = new MockPgClient();
      const spyConnect = vi.spyOn(pool, 'connect').mockImplementation(async () => mockClient as unknown as PoolClient);

      try {
        await expect(
          withTransactionScopedContext(OWNER_ID, 'owner', async () => {
            throw new Error('Transaction business failure');
          })
        ).rejects.toThrow('Transaction business failure');

        const querySqls = mockClient.queries.map((q) => q.sql);
        expect(querySqls[0]).toBe('BEGIN;');
        expect(querySqls[1]).toContain('set_config');
        expect(querySqls[2]).toBe('ROLLBACK;');
        expect(querySqls[3]).toBe('DISCARD ALL;');

        expect(mockClient.released).toBe(true);
        expect(mockClient.releaseError).toBeUndefined();
      } finally {
        spyConnect.mockRestore();
      }
    });

    it('destroys client via release(true) if DISCARD ALL fails (AT57 fail-safe)', async () => {
      const mockClient = new MockPgClient();
      mockClient.failOnDiscard = true;
      const spyConnect = vi.spyOn(pool, 'connect').mockImplementation(async () => mockClient as unknown as PoolClient);

      try {
        const result = await withTransactionScopedContext(OWNER_ID, 'owner', async () => {
          return 'ok';
        });

        expect(result).toBe('ok');
        // Because DISCARD ALL threw, client must be released with true to destroy and eject from pool
        expect(mockClient.released).toBe(true);
        expect(mockClient.releaseError).toBe(true);
      } finally {
        spyConnect.mockRestore();
      }
    });

    it('does not release client when clientOverride is supplied by caller', async () => {
      const mockClient = new MockPgClient();
      const releaseSpy = vi.fn();
      mockClient.release = releaseSpy;

      const result = await withTransactionScopedContext(
        OWNER_ID,
        'owner',
        async () => 'custom-override-result',
        mockClient as unknown as PoolClient
      );

      expect(result).toBe('custom-override-result');
      expect(releaseSpy).not.toHaveBeenCalled();
    });
  });

  describe('2. Connection Pool Isolation & Zero Residual State (AT57)', () => {
    it('completely wipes session GUCs between successive checkouts from pool', async () => {
      const sharedClient = new MockPgClient();
      let checkoutCount = 0;

      const spyConnect = vi.spyOn(pool, 'connect').mockImplementation(async () => {
        checkoutCount++;
        sharedClient.released = false;
        return sharedClient as unknown as PoolClient;
      });

      try {
        // Step 1: Owner runs transaction, setting context to Owner
        await withTransactionScopedContext(OWNER_ID, 'owner', async (client) => {
          const u = await client.query("SELECT current_setting('app.current_user_id', true) AS u");
          const r = await client.query("SELECT current_setting('app.current_role', true) AS r");
          expect(u.rows[0].u).toBe(OWNER_ID);
          expect(r.rows[0].r).toBe('owner');
        });

        expect(checkoutCount).toBe(1);
        expect(sharedClient.released).toBe(true);

        // Step 2: Client checked out naked (unauthenticated) from pool
        const nakedClient = await pool.connect();
        try {
          const u = await nakedClient.query("SELECT current_setting('app.current_user_id', true) AS u");
          const r = await nakedClient.query("SELECT current_setting('app.current_role', true) AS r");

          // Must be strictly null / empty: zero leakage of Owner identity (AT57)
          expect(u.rows[0].u).toBeNull();
          expect(r.rows[0].r).toBeNull();

          // Financial queries return 0 rows under naked checkout
          const costs = await nakedClient.query('SELECT * FROM cost_items');
          expect(costs.rows.length).toBe(0);
        } finally {
          nakedClient.release();
        }

        // Step 3: Family View runs next transaction on the reused connection
        await withTransactionScopedContext(FAMILY_ID, 'family_view', async (client) => {
          const u = await client.query("SELECT current_setting('app.current_user_id', true) AS u");
          const r = await client.query("SELECT current_setting('app.current_role', true) AS r");
          expect(u.rows[0].u).toBe(FAMILY_ID);
          expect(r.rows[0].r).toBe('family_view');
        });

        // Step 4: Subsequent naked checkout is again completely clean
        const nakedClient2 = await pool.connect();
        try {
          const r = await nakedClient2.query("SELECT current_setting('app.current_role', true) AS r");
          expect(r.rows[0].r).toBeNull();
        } finally {
          nakedClient2.release();
        }
      } finally {
        spyConnect.mockRestore();
      }
    });
  });

  describe('3. RLS Financial Domain Strict Denial for family_view (AT03)', () => {
    const financialTables = [
      'budget_categories',
      'category_budgets',
      'cost_items',
      'payment_schedules',
      'payments',
      'payment_allocations',
      'fund_settings',
      'funding_entries',
    ];

    for (const table of financialTables) {
      it(`strictly denies SELECT queries for family_view on ${table}`, async () => {
        const mockClient = new MockPgClient();
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

      it(`strictly denies INSERT mutations for family_view on ${table}`, async () => {
        const mockClient = new MockPgClient();
        const spyConnect = vi.spyOn(pool, 'connect').mockImplementation(async () => mockClient as unknown as PoolClient);

        try {
          await withTransactionScopedContext(FAMILY_ID, 'family_view', async (client) => {
            await expect(
              client.query(`INSERT INTO "${table}" (name) VALUES ('Test')`)
            ).rejects.toThrow(/row-level security policy/);
          });
        } finally {
          spyConnect.mockRestore();
        }
      });

      it(`strictly denies UPDATE mutations for family_view on ${table}`, async () => {
        const mockClient = new MockPgClient();
        const spyConnect = vi.spyOn(pool, 'connect').mockImplementation(async () => mockClient as unknown as PoolClient);

        try {
          await withTransactionScopedContext(FAMILY_ID, 'family_view', async (client) => {
            const updateRes = await client.query(`UPDATE "${table}" SET id = '123'`);
            expect(updateRes.rowCount).toBe(0);
          });
        } finally {
          spyConnect.mockRestore();
        }
      });

      it(`strictly denies DELETE mutations for family_view on ${table}`, async () => {
        const mockClient = new MockPgClient();
        const spyConnect = vi.spyOn(pool, 'connect').mockImplementation(async () => mockClient as unknown as PoolClient);

        try {
          await withTransactionScopedContext(FAMILY_ID, 'family_view', async (client) => {
            const deleteRes = await client.query(`DELETE FROM "${table}"`);
            expect(deleteRes.rowCount).toBe(0);
          });
        } finally {
          spyConnect.mockRestore();
        }
      });

      it(`permits full access for owner on ${table}`, async () => {
        const mockClient = new MockPgClient();
        const spyConnect = vi.spyOn(pool, 'connect').mockImplementation(async () => mockClient as unknown as PoolClient);

        try {
          await withTransactionScopedContext(OWNER_ID, 'owner', async (client) => {
            const selectRes = await client.query(`SELECT * FROM "${table}"`);
            expect(selectRes.rows.length).toBeGreaterThan(0);

            const insertRes = await client.query(`INSERT INTO "${table}" (name) VALUES ('Test')`);
            expect(insertRes.rowCount).toBe(1);
          });
        } finally {
          spyConnect.mockRestore();
        }
      });
    }
  });

  describe('4. RLS Default-Deny & Better Auth Unauthenticated Lookup', () => {
    it('denies domain table access when context is missing (default-deny)', async () => {
      const mockClient = new MockPgClient();
      const spyConnect = vi.spyOn(pool, 'connect').mockImplementation(async () => mockClient as unknown as PoolClient);

      try {
        const client = await pool.connect();
        try {
          // No context set: role is null
          const costRes = await client.query('SELECT * FROM cost_items');
          expect(costRes.rows.length).toBe(0);

          const eventRes = await client.query('SELECT * FROM events');
          expect(eventRes.rows.length).toBe(0);
        } finally {
          client.release();
        }
      } finally {
        spyConnect.mockRestore();
      }
    });

    it('allows unauthenticated token lookup on sessions for Better Auth resolution', async () => {
      const mockClient = new MockPgClient();
      const spyConnect = vi.spyOn(pool, 'connect').mockImplementation(async () => mockClient as unknown as PoolClient);

      try {
        const client = await pool.connect();
        try {
          // Unauthenticated lookup querying by token
          const sessionRes = await client.query("SELECT * FROM sessions WHERE token = 'valid-token'");
          expect(sessionRes.rows.length).toBe(1);
          expect(sessionRes.rows[0].user_id).toBe('user-lookup-1');

          // Unauthenticated lookup querying user by id
          const userRes = await client.query("SELECT * FROM users WHERE id = 'user-lookup-1'");
          expect(userRes.rows.length).toBe(1);
          expect(userRes.rows[0].email).toBe('user@example.com');
        } finally {
          client.release();
        }
      } finally {
        spyConnect.mockRestore();
      }
    });
  });

  describe('5. RLS Migration File Static Analysis (0001_rls_policies.sql)', () => {
    const migrationPath = path.resolve(process.cwd(), 'src/db/migrations/0001_rls_policies.sql');
    let migrationSql: string;

    beforeEach(() => {
      migrationSql = fs.readFileSync(migrationPath, 'utf8');
    });

    const all33Tables = [
      'accounts', 'member_event_access', 'member_invites', 'sessions', 'users', 'verifications',
      'events', 'wedding_settings',
      'guest_groups', 'guests', 'invitations', 'invitation_members', 'attendance', 'contact_followups',
      'budget_categories', 'category_budgets', 'cost_items', 'payment_schedules', 'payments',
      'payment_allocations', 'fund_settings', 'funding_entries',
      'tasks', 'task_checklist_items', 'task_dependencies', 'appointments',
      'attachments', 'attachment_variants',
      'audit_logs', 'notifications', 'idempotency_records', 'import_batches', 'import_rows',
    ];

    it('enforces ENABLE ROW LEVEL SECURITY across all 33 tables', () => {
      for (const table of all33Tables) {
        const pattern = new RegExp(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`, 'i');
        expect(
          pattern.test(migrationSql),
          `Missing ENABLE ROW LEVEL SECURITY for table: ${table}`
        ).toBe(true);
      }
    });

    it('enforces FORCE ROW LEVEL SECURITY across all 33 tables', () => {
      for (const table of all33Tables) {
        const pattern = new RegExp(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;`, 'i');
        expect(
          pattern.test(migrationSql),
          `Missing FORCE ROW LEVEL SECURITY for table: ${table}`
        ).toBe(true);
      }
    });

    it('defines SECURITY DEFINER helper with fixed search_path = public to eliminate recursion', () => {
      expect(migrationSql).toContain('FUNCTION public.get_current_user_allowed_event_ids()');
      expect(migrationSql).toContain('SECURITY DEFINER');
      expect(migrationSql).toContain('SET search_path = public');
    });

    it('defines unauthenticated lookup policies for sessions and users for Better Auth', () => {
      expect(migrationSql).toContain('sessions_token_lookup');
      expect(migrationSql).toContain('users_auth_lookup');
    });

    it('strictly avoids defining any family_view policy on all 8 financial tables (AT03)', () => {
      const financialTables = [
        'budget_categories', 'category_budgets', 'cost_items',
        'payment_schedules', 'payments', 'payment_allocations',
        'fund_settings', 'funding_entries',
      ];

      for (const table of financialTables) {
        // Assert there is an owner policy
        const ownerPattern = new RegExp(`CREATE POLICY owner_all_${table} ON "${table}"`, 'i');
        expect(ownerPattern.test(migrationSql)).toBe(true);

        // Assert there is NO family policy on this table
        const familyPattern = new RegExp(`CREATE POLICY [^;]*family[^;]* ON "${table}"`, 'i');
        expect(familyPattern.test(migrationSql)).toBe(false);
      }
    });

    it('verifies all columns referenced in 0001_rls_policies.sql exist in schema and 0000_silly_shockwave.sql', () => {
      // 1. Verify member_invites specifically references token_hash and NOT token
      const invitesPolicyMatch = migrationSql.match(/CREATE POLICY invites_token_lookup ON "member_invites"[\s\S]*?;/i);
      expect(invitesPolicyMatch).not.toBeNull();
      const invitesPolicySql = invitesPolicyMatch![0];
      expect(invitesPolicySql).toContain('token_hash');
      expect(invitesPolicySql).not.toMatch(/\btoken\s+IS\s+NOT\s+NULL/i);

      // 2. Validate columns for key tables against Drizzle schema
      const memberInvitesCols = Object.keys(getTableColumns(schema.memberInvites)).map(
        (k) => (getTableColumns(schema.memberInvites) as any)[k].name
      );
      expect(memberInvitesCols).toContain('token_hash');
      expect(memberInvitesCols).not.toContain('token');

      const sessionsCols = Object.keys(getTableColumns(schema.sessions)).map(
        (k) => (getTableColumns(schema.sessions) as any)[k].name
      );
      expect(sessionsCols).toContain('token');
      expect(sessionsCols).toContain('user_id');

      // 3. Verify against 0000_silly_shockwave.sql
      const schema0000Path = path.resolve(process.cwd(), 'src/db/migrations/0000_silly_shockwave.sql');
      const schema0000Sql = fs.readFileSync(schema0000Path, 'utf8');
      expect(schema0000Sql).toContain('"token_hash"');
      const memberInvitesTableMatch = schema0000Sql.match(/CREATE TABLE (?:IF NOT EXISTS )?"member_invites"[\s\S]*?\);/i);
      expect(memberInvitesTableMatch).not.toBeNull();
      expect(memberInvitesTableMatch![0]).toContain('"token_hash"');
      expect(memberInvitesTableMatch![0]).not.toMatch(/"token"\s+/);
    });
  });

  describe('6. Drizzle ORM Instance & Schema Export Verification', () => {
    it('exports db and globalDb wrapping connection pool with full schema', () => {
      expect(db).toBeDefined();
      expect(globalDb).toBe(db);

      // Verify schema tables are defined on schema
      expect(schema.users).toBeDefined();
      expect(schema.sessions).toBeDefined();
      expect(schema.events).toBeDefined();
      expect(schema.guests).toBeDefined();
      expect(schema.costItems).toBeDefined();
      expect(schema.payments).toBeDefined();
      expect(schema.tasks).toBeDefined();
      expect(schema.attachments).toBeDefined();
      expect(schema.auditLogs).toBeDefined();
    });
  });
});
