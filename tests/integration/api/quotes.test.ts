import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import * as quotesRoute from '@/app/api/v1/vendors/[id]/quotes/route';
import * as sessionModule from '@/lib/auth/session';
import * as dbModule from '@/db/client';
import * as quotesRepo from '@/lib/vendors/quotes.repository';
import * as vendorsRepo from '@/lib/vendors/vendors.repository';
import {
  QuoteNotFoundError,
} from '@/lib/vendors/quotes.repository';
import {
  VendorNotFoundError,
} from '@/lib/vendors/vendors.repository';
import { QuoteDto } from '@/schemas/vendors';

vi.mock('@/db/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/db/client')>();
  return {
    ...actual,
    withTransactionScopedContext: vi.fn(
      async (_userId: string, _role: string, callback: (client: any, db: any) => Promise<any>) => {
        return callback({} as any, {} as any);
      }
    ),
  };
});

function createMockSession(role: 'owner' | 'family_view' = 'owner') {
  const userId =
    role === 'owner'
      ? '11111111-1111-4111-8111-111111111111'
      : '33333333-3333-4333-8333-333333333333';
  return {
    user: {
      id: userId,
      name: role === 'owner' ? 'Nguyễn Văn Chú Rể' : 'Bác Ba',
      email: role === 'owner' ? 'groom@example.com' : 'family@example.com',
      role,
    },
    session: {
      id: `session-${userId}`,
      userId,
      expiresAt: new Date(Date.now() + 86400000),
      token: `token-${userId}`,
    },
    role,
    allowedEventIds: [],
  };
}

describe('Quotes API Route Handlers Integration Tests (M8.3, AT03, AT24, AT41)', () => {
  const validVendorId = '11111111-1111-4111-8111-111111111111';
  const validQuoteId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const parentQuoteId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  const mockQuoteDtoV1: QuoteDto = {
    id: parentQuoteId,
    vendor_id: validVendorId,
    package_group_id: 'gggggggg-gggg-4ggg-8ggg-gggggggggggg',
    version_number: 1,
    parent_quote_id: null,
    quote_name: 'Gói Tiệc Kim Cương',
    received_date: '2026-11-01',
    valid_until: '2026-12-01',
    total_amount: '150000000',
    is_estimate: false,
    guest_count_assumption: 250,
    table_count_assumption: 25,
    terms: 'Đặt cọc 30% khi ký',
    includes: ['Thực đơn 8 món', 'Âm thanh ánh sáng'],
    excludes: ['Màn hình LED'],
    deposit_conditions: 'Hoàn 50% nếu hủy trước 60 ngày',
    is_selected: false,
    created_by: 'owner-id',
    created_at: '2026-11-01T08:00:00.000Z',
    updated_at: '2026-11-01T08:00:00.000Z',
  };

  const mockQuoteDtoV2: QuoteDto = {
    id: validQuoteId,
    vendor_id: validVendorId,
    package_group_id: 'gggggggg-gggg-4ggg-8ggg-gggggggggggg',
    version_number: 2,
    parent_quote_id: parentQuoteId, // AT24 version pedigree
    quote_name: 'Gói Tiệc Kim Cương (Bổ sung LED)',
    received_date: '2026-11-10',
    valid_until: '2026-12-10',
    total_amount: '165000000',
    is_estimate: false,
    guest_count_assumption: 250,
    table_count_assumption: 25,
    terms: 'Đặt cọc 30% khi ký',
    includes: ['Thực đơn 8 món', 'Âm thanh ánh sáng', 'Màn hình LED P3'],
    excludes: [],
    deposit_conditions: 'Hoàn 50% nếu hủy trước 60 ngày',
    is_selected: false,
    created_by: 'owner-id',
    created_at: '2026-11-10T08:00:00.000Z',
    updated_at: '2026-11-10T08:00:00.000Z',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(dbModule, 'withTransactionScopedContext').mockImplementation(
      async (_userId, _role, callback) => callback({} as any, {} as any)
    );
  });

  // ===========================================================================
  // 1. GET /api/v1/vendors/[id]/quotes
  // ===========================================================================
  describe('GET /api/v1/vendors/[id]/quotes', () => {
    it('returns 400 BAD_REQUEST for invalid vendor UUID', async () => {
      const ownerSession = createMockSession('owner');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);

      const req = new NextRequest('http://localhost:3000/api/v1/vendors/bad-id/quotes');
      const res = await quotesRoute.GET(req, { params: Promise.resolve({ id: 'bad-id' }) });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('BAD_REQUEST');
    });

    it('returns 401 UNAUTHORIZED when no session exists', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(null);

      const req = new NextRequest(`http://localhost:3000/api/v1/vendors/${validVendorId}/quotes`);
      const res = await quotesRoute.GET(req, { params: Promise.resolve({ id: validVendorId }) });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe('UNAUTHORIZED');
    });

    it('AT03, AT41: returns 403 FORBIDDEN when family_view attempts to read quotes', async () => {
      const familySession = createMockSession('family_view');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(familySession as any);

      const req = new NextRequest(`http://localhost:3000/api/v1/vendors/${validVendorId}/quotes`);
      const res = await quotesRoute.GET(req, { params: Promise.resolve({ id: validVendorId }) });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe('FORBIDDEN');
      expect(body.message).toContain('Người nhà');
    });

    it('returns 404 NOT_FOUND when vendor does not exist', async () => {
      const ownerSession = createMockSession('owner');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);
      vi.spyOn(vendorsRepo, 'getVendorById').mockResolvedValue(null);

      const req = new NextRequest(`http://localhost:3000/api/v1/vendors/${validVendorId}/quotes`);
      const res = await quotesRoute.GET(req, { params: Promise.resolve({ id: validVendorId }) });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe('NOT_FOUND');
    });

    it('returns 200 with latest quotes by default (includeSuperseded=false)', async () => {
      const ownerSession = createMockSession('owner');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);
      vi.spyOn(vendorsRepo, 'getVendorById').mockResolvedValue({ id: validVendorId } as any);
      const listQuotesSpy = vi.spyOn(quotesRepo, 'listQuotesByVendorId').mockResolvedValue([mockQuoteDtoV2]);

      const req = new NextRequest(`http://localhost:3000/api/v1/vendors/${validVendorId}/quotes`);
      const res = await quotesRoute.GET(req, { params: Promise.resolve({ id: validVendorId }) });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].version_number).toBe(2);
      expect(listQuotesSpy).toHaveBeenCalledWith(expect.anything(), validVendorId, { includeSuperseded: false });
    });

    it('returns 200 with all historical versions when includeSuperseded=true', async () => {
      const ownerSession = createMockSession('owner');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);
      vi.spyOn(vendorsRepo, 'getVendorById').mockResolvedValue({ id: validVendorId } as any);
      const listQuotesSpy = vi
        .spyOn(quotesRepo, 'listQuotesByVendorId')
        .mockResolvedValue([mockQuoteDtoV2, mockQuoteDtoV1]);

      const req = new NextRequest(`http://localhost:3000/api/v1/vendors/${validVendorId}/quotes?includeSuperseded=true`);
      const res = await quotesRoute.GET(req, { params: Promise.resolve({ id: validVendorId }) });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(2);
      expect(listQuotesSpy).toHaveBeenCalledWith(expect.anything(), validVendorId, { includeSuperseded: true });
    });
  });

  // ===========================================================================
  // 2. POST /api/v1/vendors/[id]/quotes (Initial Quote Creation)
  // ===========================================================================
  describe('POST /api/v1/vendors/[id]/quotes (Initial Quote Creation)', () => {
    it('returns 400 BAD_REQUEST for invalid vendor UUID', async () => {
      const ownerSession = createMockSession('owner');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);

      const req = new NextRequest('http://localhost:3000/api/v1/vendors/bad-id/quotes', {
        method: 'POST',
        body: JSON.stringify({ quote_name: 'Test', received_date: '2026-11-12' }),
      });
      const res = await quotesRoute.POST(req, { params: Promise.resolve({ id: 'bad-id' }) });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('BAD_REQUEST');
    });

    it('AT03: returns 403 FORBIDDEN when family_view tries to create a quote', async () => {
      const familySession = createMockSession('family_view');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(familySession as any);

      const req = new NextRequest(`http://localhost:3000/api/v1/vendors/${validVendorId}/quotes`, {
        method: 'POST',
        body: JSON.stringify({ quote_name: 'Family Quote', received_date: '2026-11-12' }),
      });
      const res = await quotesRoute.POST(req, { params: Promise.resolve({ id: validVendorId }) });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe('FORBIDDEN');
    });

    it('returns 400 VALIDATION_ERROR when quote_name is missing', async () => {
      const ownerSession = createMockSession('owner');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);

      const req = new NextRequest(`http://localhost:3000/api/v1/vendors/${validVendorId}/quotes`, {
        method: 'POST',
        body: JSON.stringify({ received_date: '2026-11-12' }),
      });
      const res = await quotesRoute.POST(req, { params: Promise.resolve({ id: validVendorId }) });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 400 VALIDATION_ERROR when valid_until is before received_date', async () => {
      const ownerSession = createMockSession('owner');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);

      const req = new NextRequest(`http://localhost:3000/api/v1/vendors/${validVendorId}/quotes`, {
        method: 'POST',
        body: JSON.stringify({
          quote_name: 'Gói Tiệc',
          received_date: '2026-11-15',
          valid_until: '2026-11-10', // Invalid: prior to received_date
        }),
      });
      const res = await quotesRoute.POST(req, { params: Promise.resolve({ id: validVendorId }) });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('VALIDATION_ERROR');
      expect(body.message).toContain('sau hoặc bằng');
    });

    it('returns 201 Created and creates initial quote (version 1)', async () => {
      const ownerSession = createMockSession('owner');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);
      vi.spyOn(quotesRepo, 'createInitialQuote').mockResolvedValue(mockQuoteDtoV1);

      const payload = {
        quote_name: 'Gói Tiệc Kim Cương',
        received_date: '2026-11-01',
        valid_until: '2026-12-01',
        total_amount: '150000000',
        table_count_assumption: 25,
        guest_count_assumption: 250,
        includes: ['Thực đơn 8 món', 'Âm thanh ánh sáng'],
        excludes: ['Màn hình LED'],
      };

      const req = new NextRequest(`http://localhost:3000/api/v1/vendors/${validVendorId}/quotes`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const res = await quotesRoute.POST(req, { params: Promise.resolve({ id: validVendorId }) });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.quote_name).toBe('Gói Tiệc Kim Cương');
      expect(body.data.version_number).toBe(1);
      expect(body.data.parent_quote_id).toBeNull();
    });

    it('AT24: preserves total_amount: null when price is not quoted (never converts to 0)', async () => {
      const ownerSession = createMockSession('owner');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);

      const unquotedQuote: QuoteDto = {
        ...mockQuoteDtoV1,
        total_amount: null, // AT24 Chưa báo
      };
      vi.spyOn(quotesRepo, 'createInitialQuote').mockResolvedValue(unquotedQuote);

      const req = new NextRequest(`http://localhost:3000/api/v1/vendors/${validVendorId}/quotes`, {
        method: 'POST',
        body: JSON.stringify({
          quote_name: 'Gói Chụp Ảnh Chưa Chốt Giá',
          received_date: '2026-11-12',
          total_amount: null,
        }),
      });
      const res = await quotesRoute.POST(req, { params: Promise.resolve({ id: validVendorId }) });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.total_amount).toBeNull();
    });
  });

  // ===========================================================================
  // 3. POST /api/v1/vendors/[id]/quotes (Version Revision - AT24)
  // ===========================================================================
  describe('POST /api/v1/vendors/[id]/quotes (Version Revision - AT24)', () => {
    it('AT24: creates new version v2 linked to parent_quote_id without modifying base quote', async () => {
      const ownerSession = createMockSession('owner');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);
      const createVersionSpy = vi
        .spyOn(quotesRepo, 'createNewQuoteVersion')
        .mockResolvedValue(mockQuoteDtoV2);

      const revisionPayload = {
        parent_quote_id: parentQuoteId,
        quote_name: 'Gói Tiệc Kim Cương (Bổ sung LED)',
        total_amount: '165000000',
        revision_reason: 'Nhà cung cấp cập nhật giá kèm màn hình LED',
        includes: ['Thực đơn 8 món', 'Âm thanh ánh sáng', 'Màn hình LED P3'],
      };

      const req = new NextRequest(`http://localhost:3000/api/v1/vendors/${validVendorId}/quotes`, {
        method: 'POST',
        body: JSON.stringify(revisionPayload),
      });
      const res = await quotesRoute.POST(req, { params: Promise.resolve({ id: validVendorId }) });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.version_number).toBe(2);
      expect(body.data.parent_quote_id).toBe(parentQuoteId);
      expect(body.data.total_amount).toBe('165000000');

      expect(createVersionSpy).toHaveBeenCalledWith(
        expect.anything(),
        parentQuoteId,
        expect.objectContaining({
          total_amount: '165000000',
        }),
        ownerSession.user.id
      );
    });

    it('returns 404 NOT_FOUND when parent_quote_id does not exist', async () => {
      const ownerSession = createMockSession('owner');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);
      vi.spyOn(quotesRepo, 'createNewQuoteVersion').mockRejectedValue(new QuoteNotFoundError());

      const req = new NextRequest(`http://localhost:3000/api/v1/vendors/${validVendorId}/quotes`, {
        method: 'POST',
        body: JSON.stringify({
          parent_quote_id: '99999999-9999-4999-8999-999999999999',
          total_amount: '170000000',
        }),
      });
      const res = await quotesRoute.POST(req, { params: Promise.resolve({ id: validVendorId }) });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe('NOT_FOUND');
    });
  });
});
