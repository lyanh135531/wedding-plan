import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as dbClient from '@/db/client';
import { GET } from '@/app/api/health/route';

describe('Container Healthcheck Route Handler (GET /api/health)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns HTTP 200 with status "ok" and db true when database connectivity is sound', async () => {
    vi.spyOn(dbClient, 'checkDatabaseHealth').mockResolvedValue({
      ok: true,
      latencyMs: 12,
    });

    const response = await GET();
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.status).toBe('ok');
    expect(data.db).toBe(true);
    expect(data.latencyMs).toBe(12);
  });

  it('returns HTTP 503 Service Unavailable when database health check returns ok: false', async () => {
    vi.spyOn(dbClient, 'checkDatabaseHealth').mockResolvedValue({
      ok: false,
      latencyMs: 5005,
    });

    const response = await GET();
    expect(response.status).toBe(503);

    const data = await response.json();
    expect(data.status).toBe('error');
    expect(data.db).toBe(false);
    expect(data.message).toBe('Database health check failed');
  });

  it('returns HTTP 503 with error details when checkDatabaseHealth throws an exception', async () => {
    vi.spyOn(dbClient, 'checkDatabaseHealth').mockRejectedValue(
      new Error('Connection pool exhausted: timeout 5000ms')
    );

    const response = await GET();
    expect(response.status).toBe(503);

    const data = await response.json();
    expect(data.status).toBe('error');
    expect(data.db).toBe(false);
    expect(data.error).toContain('Connection pool exhausted');
  });
});
