import { describe, it, expect, vi } from 'vitest';
import { createOfflineSafeFetch, OFFLINE_WRITE_MESSAGE } from '@/components/common/NetworkWriteGuard';

describe('Offline API write barrier', () => {
  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('rejects %s before any network request is dispatched', async (method) => {
    const network = vi.fn<typeof fetch>();
    const fetch = createOfflineSafeFetch(network, () => false, 'https://wedding.test');
    await expect(fetch('/api/v1/vendors', { method })).rejects.toThrow(OFFLINE_WRITE_MESSAGE);
    expect(network).not.toHaveBeenCalled();
  });

  it('checks Request method and lets init override it', async () => {
    const network = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'));
    const guarded = createOfflineSafeFetch(network, () => false, 'https://wedding.test');
    const request = new Request('https://wedding.test/api/v1/vendors', { method: 'DELETE' });
    await expect(guarded(request)).rejects.toThrow(OFFLINE_WRITE_MESSAGE);
    await guarded(request, { method: 'GET' });
    expect(network).toHaveBeenCalledTimes(1);
  });

  it('keeps reads working and resumes writes when the live connectivity state changes', async () => {
    let online = false;
    const network = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'));
    const guarded = createOfflineSafeFetch(network, () => online, 'https://wedding.test');
    await guarded('/api/v1/vendors');
    await guarded('https://external.test/api/v1/telemetry', { method: 'POST' });
    online = true;
    await guarded('/api/v1/vendors', { method: 'POST', body: '{}' });
    expect(network).toHaveBeenCalledTimes(3);
  });
});
