import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, HttpError } from '@/lib/api/request';

afterEach(() => vi.unstubAllGlobals());

describe('API response handling', () => {
  it('accepts successful delete responses without a JSON body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    expect(await api('/api/resource', { method: 'DELETE' })).toBeUndefined();
  });
  it('reports proxy HTML errors without leaking a JSON parser exception', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 })));
    await expect(api('/api/resource')).rejects.toMatchObject({ status: 502, message: expect.stringContaining('không hợp lệ') });
  });
  it('preserves the server validation message and HTTP status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ issues: [{ message: 'Tên không được để trống' }] }, { status: 400 })));
    await expect(api('/api/resource')).rejects.toThrow('Tên không được để trống');
  });
  it('handles null error bodies', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(null, { status: 500 })));
    await expect(api('/api/resource')).rejects.toBeInstanceOf(HttpError);
  });
});
