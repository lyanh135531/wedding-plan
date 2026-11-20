import { afterEach, describe, expect, it, vi } from 'vitest';

const { PoolMock } = vi.hoisted(() => ({ PoolMock: vi.fn(function () {
  return { on: vi.fn(), end: vi.fn().mockResolvedValue(undefined) };
}) }));
vi.mock('pg', () => ({ Pool: PoolMock }));
vi.mock('drizzle-orm/node-postgres', () => ({ drizzle: vi.fn(() => ({})) }));

afterEach(() => {
  delete (globalThis as any).weddingPostgresPool;
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  vi.resetModules();
});

describe('PostgreSQL pool lifecycle across Next.js module reloads', () => {
  it('shares connections instead of opening a pool per module evaluation', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost/pool_singleton_test');
    const first = await import('@/db/client');
    vi.resetModules();
    const second = await import('@/db/client');
    expect(second.pool).toBe(first.pool);
    expect(PoolMock).toHaveBeenCalledTimes(1);
  });

  it('closes the obsolete pool when connection configuration changes', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost/pool_first_test');
    const first = await import('@/db/client');
    vi.resetModules();
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost/pool_second_test');
    const second = await import('@/db/client');
    expect(second.pool).not.toBe(first.pool);
    expect(first.pool.end).toHaveBeenCalledTimes(1);
    expect(PoolMock).toHaveBeenCalledTimes(2);
  });
});
