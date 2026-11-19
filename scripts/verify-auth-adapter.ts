/** Called only by isolated verification harnesses with the restricted app role. */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { auth } from '../src/lib/auth/auth';
import { db, pool } from '../src/db/client';
import { users } from '../src/db/schema/auth';
import { sql } from 'drizzle-orm';

if (!process.env.G11_DB_URL || new URL(process.env.G11_DB_URL).pathname !== '/wedding_g11_source' || new URL(process.env.DATABASE_URL || '').pathname !== '/wedding_g11_source') throw new Error('Auth adapter verification requires the disposable harness database.');
const { adapter } = await auth.$context;
const prefix = crypto.randomUUID(); const now = new Date();
const where = (field: string, value: string) => [{ field, value }];
const deniedByRls = (error: unknown): boolean => {
  let cause = error as { code?: string; cause?: unknown } | undefined;
  while (cause) { if (cause.code === '42501') return true; cause = cause.cause as typeof cause; }
  return false;
};
try {
  // Do not weaken the application role or unauthenticated RLS write policies.
  await assert.rejects(db.insert(users).values({ id: prefix, name: 'Blocked', email: `${prefix}@blocked.invalid`, role: 'family_view' }), deniedByRls);
  const user = await adapter.create<{ id: string }>({ model: 'user', data: { name: 'OAuth adapter verification', email: `${prefix}@g11.invalid`, emailVerified: true, role: 'family_view', createdAt: now, updatedAt: now } });
  assert.ok(user.id);
  await adapter.transaction(async transaction => {
    await transaction.create({ model: 'account', data: { accountId: prefix, providerId: 'google', userId: user.id, createdAt: now, updatedAt: now } });
    await transaction.create({ model: 'session', data: { userId: user.id, token: prefix, expiresAt: new Date(Date.now() + 60000), createdAt: now, updatedAt: now } });
    const session = await transaction.findOne<{ userId: string }>({ model: 'session', where: where('token', prefix) }); assert.equal(session?.userId, user.id);
  });
  await adapter.create({ model: 'verification', data: { identifier: prefix, value: 'isolated-state', expiresAt: new Date(Date.now() + 60000), createdAt: now, updatedAt: now } });
  const rollbackId = `${prefix}-rollback`;
  await assert.rejects(adapter.transaction(async transaction => { await transaction.create({ model: 'verification', data: { identifier: rollbackId, value: 'must-rollback', expiresAt: new Date(Date.now() + 60000), createdAt: now, updatedAt: now } }); throw new Error('EXPECTED_AUTH_ROLLBACK'); }), /EXPECTED_AUTH_ROLLBACK/);
  assert.equal(await adapter.findOne({ model: 'verification', where: where('identifier', rollbackId) }), null);
  await adapter.deleteMany({ model: 'verification', where: where('identifier', prefix) });
  await adapter.deleteMany({ model: 'session', where: where('userId', user.id) });
  await adapter.deleteMany({ model: 'account', where: where('userId', user.id) });
  await adapter.delete({ model: 'user', where: where('id', user.id) });
  const context = (await db.execute(sql`SELECT current_setting('app.current_role', true) AS role`)).rows[0]; assert.notEqual(context.role, 'owner');
  console.log('[Auth] Restricted-role OAuth adapter CRUD, atomic rollback and context cleanup PASS');
} finally { await pool.end(); }
