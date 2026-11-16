import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vendorsApi, ApiError } from '@/lib/vendors/api-client';

describe('Vendors API Client (src/lib/vendors/api-client.ts)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('vendorsApi.list constructs search and filter query parameters correctly', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: 'v1', name: 'Vendor 1' }],
        pagination: { page: 1, limit: 25, total: 1 },
      }),
    });
    global.fetch = mockFetch;

    const res = await vendorsApi.list({
      search: 'Riverside',
      serviceType: 'venue',
      status: 'selected',
      page: 1,
      limit: 25,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain('/api/v1/vendors?');
    expect(url).toContain('search=Riverside');
    expect(url).toContain('serviceType=venue');
    expect(url).toContain('status=selected');
    expect(url).toContain('page=1');
    expect(url).toContain('limit=25');
    expect(res.data).toHaveLength(1);
  });

  it('vendorsApi.getById fetches vendor by UUID', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { id: 'v-uuid-1', name: 'Riverside Palace' },
      }),
    });
    global.fetch = mockFetch;

    const res = await vendorsApi.getById('v-uuid-1');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/vendors/v-uuid-1',
      expect.objectContaining({ headers: expect.any(Headers) })
    );
    expect(res.data.name).toBe('Riverside Palace');
  });

  it('vendorsApi.create sends POST request with JSON payload', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { id: 'v-new', name: 'New Vendor' },
        message: 'Tạo nhà cung cấp thành công.',
      }),
    });
    global.fetch = mockFetch;

    const res = await vendorsApi.create({
      name: 'New Vendor',
      service_type: 'catering',
      status: 'researching',
    } as any);

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/vendors',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          name: 'New Vendor',
          service_type: 'catering',
          status: 'researching',
        }),
      })
    );
    expect(res.message).toBe('Tạo nhà cung cấp thành công.');
  });

  it('vendorsApi.update sends PATCH request with optimistic version (AT30)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { id: 'v-uuid', name: 'Updated Vendor', version: 2 },
        message: 'Cập nhật thành công.',
      }),
    });
    global.fetch = mockFetch;

    const res = await vendorsApi.update('v-uuid', {
      name: 'Updated Vendor',
      version: 1,
    } as any);

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/vendors/v-uuid',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          name: 'Updated Vendor',
          version: 1,
        }),
      })
    );
    expect(res.data.version).toBe(2);
  });

  it('vendorsApi.delete sends DELETE request', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Xóa thành công.' }),
    });
    global.fetch = mockFetch;

    const res = await vendorsApi.delete('v-uuid');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/vendors/v-uuid',
      expect.objectContaining({ method: 'DELETE' })
    );
    expect(res.message).toBe('Xóa thành công.');
  });

  it('vendorsApi.listQuotes passes includeSuperseded query parameter (AT24)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });
    global.fetch = mockFetch;

    await vendorsApi.listQuotes('v-uuid', true);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/vendors/v-uuid/quotes?includeSuperseded=true',
      expect.anything()
    );
  });

  it('vendorsApi.reviseQuote sends parent_quote_id in body (AT24)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { id: 'q-new', version_number: 2 },
        message: 'Tạo phiên bản mới thành công.',
      }),
    });
    global.fetch = mockFetch;

    await vendorsApi.reviseQuote('v-uuid', 'q-parent-uuid', {
      quote_name: 'Gói Tiệc Bạc v2',
      revision_reason: 'Đàm phán giảm giá',
    } as any);

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/vendors/v-uuid/quotes',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          quote_name: 'Gói Tiệc Bạc v2',
          revision_reason: 'Đàm phán giảm giá',
          parent_quote_id: 'q-parent-uuid',
        }),
      })
    );
  });

  it('vendorsApi.convertQuoteToCost sends Idempotency-Key header (AT23)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          is_already_converted: false,
          cost_item_id: 'cost-1',
          cost_item_name: 'Sảnh tiệc',
          action: 'created_new',
        },
        message: 'Đã tạo khoản chi thành công.',
      }),
    });
    global.fetch = mockFetch;

    const idempotencyKey = '11111111-2222-4333-8444-555555555555';
    await vendorsApi.convertQuoteToCost(
      'v-uuid',
      'q-uuid',
      { category_id: 'cat-uuid', status: 'contracted' } as any,
      idempotencyKey
    );

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/vendors/v-uuid/quotes/q-uuid/create-cost-item',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Idempotency-Key': idempotencyKey,
        }),
      })
    );
  });

  it('vendorsApi.compare sends simulation parameters (table_count, guest_count, vat)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        simulation_params: { table_count: 30, guest_count: 300, include_vat_and_service_fee: true },
        packages: [],
      }),
    });
    global.fetch = mockFetch;

    await vendorsApi.compare({
      quote_ids: ['q1', 'q2'],
      table_count: 30,
      guest_count: 300,
      include_vat_and_service_fee: true,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/vendors/compare',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          quote_ids: ['q1', 'q2'],
          table_count: 30,
          guest_count: 300,
          include_vat_and_service_fee: true,
        }),
      })
    );
  });

  it('ApiError throws with status, code, and message on server failure', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        error: 'CONFLICT',
        message: 'Dữ liệu đã bị thay đổi bởi người khác, vui lòng tải lại',
      }),
    });
    global.fetch = mockFetch;

    await expect(vendorsApi.update('v-uuid', { version: 1 } as any)).rejects.toThrow(ApiError);
    await expect(vendorsApi.update('v-uuid', { version: 1 } as any)).rejects.toMatchObject({
      status: 409,
      code: 'CONFLICT',
      message: 'Dữ liệu đã bị thay đổi bởi người khác, vui lòng tải lại',
    });
  });
});
