import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import * as quoteToCostRoute from '@/app/api/v1/vendors/[id]/quotes/[quoteId]/create-cost-item/route';
import * as sessionModule from '@/lib/auth/session';
import * as dbModule from '@/db/client';
import * as quoteToCostService from '@/lib/vendors/quote-to-cost.service';
import { QuoteNotFoundError } from '@/lib/vendors/quotes.repository';
import {
  QuoteToCostPreviewResponse,
  ConvertQuoteToCostResponse,
} from '@/schemas/vendors';

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

describe('Quote-to-Cost API Route Handlers Integration Tests (M8.3, AT03, AT23)', () => {
  const validVendorId = '11111111-1111-4111-8111-111111111111';
  const validQuoteId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const validCategoryId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const existingCostItemId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

  const mockPreviewResponse: QuoteToCostPreviewResponse = {
    quote_id: validQuoteId,
    vendor_id: validVendorId,
    vendor_name: 'Riverside Palace',
    quote_name: 'Gói Tiệc Kim Cương',
    version_number: 1,
    suggested_cost_item_name: 'Riverside Palace - Gói Tiệc Kim Cương',
    suggested_amount: '180000000',
    is_price_missing: false,
    is_already_converted: false,
    existing_cost_item: null,
    available_categories: [
      { id: validCategoryId, name: 'Địa điểm & Tiệc cưới' },
    ],
    available_events: [
      { id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', title: 'Tiệc cưới tối' },
    ],
  };

  const mockCreatedNewResponse: ConvertQuoteToCostResponse = {
    is_already_converted: false,
    cost_item_id: 'new-cost-item-id-123',
    cost_item_name: 'Riverside Palace - Gói Tiệc Kim Cương',
    action: 'created_new',
  };

  const mockAlreadyExistedResponse: ConvertQuoteToCostResponse = {
    is_already_converted: true,
    cost_item_id: existingCostItemId,
    cost_item_name: 'Riverside Palace - Gói Tiệc Kim Cương',
    action: 'already_existed',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(dbModule, 'withTransactionScopedContext').mockImplementation(
      async (_userId, _role, callback) => callback({} as any, {} as any)
    );
  });

  // ===========================================================================
  // 1. GET (Preview Conversion)
  // ===========================================================================
  describe('GET /api/v1/vendors/[id]/quotes/[quoteId]/create-cost-item (Preview Modal)', () => {
    it('returns 400 BAD_REQUEST if IDs are not valid UUIDs', async () => {
      const ownerSession = createMockSession('owner');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);

      const req = new NextRequest(
        'http://localhost:3000/api/v1/vendors/bad-vendor/quotes/bad-quote/create-cost-item'
      );
      const res = await quoteToCostRoute.GET(req, {
        params: { id: 'bad-vendor', quoteId: 'bad-quote' },
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('BAD_REQUEST');
    });

    it('returns 401 UNAUTHORIZED when no session exists', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(null);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/vendors/${validVendorId}/quotes/${validQuoteId}/create-cost-item`
      );
      const res = await quoteToCostRoute.GET(req, {
        params: { id: validVendorId, quoteId: validQuoteId },
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe('UNAUTHORIZED');
    });

    it('AT03: returns 403 FORBIDDEN when family_view accesses preview', async () => {
      const familySession = createMockSession('family_view');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(familySession as any);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/vendors/${validVendorId}/quotes/${validQuoteId}/create-cost-item`
      );
      const res = await quoteToCostRoute.GET(req, {
        params: { id: validVendorId, quoteId: validQuoteId },
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe('FORBIDDEN');
    });

    it('returns 404 NOT_FOUND when quote does not exist', async () => {
      const ownerSession = createMockSession('owner');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);
      vi.spyOn(quoteToCostService, 'generateQuoteToCostPreview').mockRejectedValue(new QuoteNotFoundError());

      const req = new NextRequest(
        `http://localhost:3000/api/v1/vendors/${validVendorId}/quotes/${validQuoteId}/create-cost-item`
      );
      const res = await quoteToCostRoute.GET(req, {
        params: { id: validVendorId, quoteId: validQuoteId },
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe('NOT_FOUND');
    });

    it('returns 200 with preview data when quote is not yet converted', async () => {
      const ownerSession = createMockSession('owner');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);
      vi.spyOn(quoteToCostService, 'generateQuoteToCostPreview').mockResolvedValue(mockPreviewResponse);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/vendors/${validVendorId}/quotes/${validQuoteId}/create-cost-item`
      );
      const res = await quoteToCostRoute.GET(req, {
        params: { id: validVendorId, quoteId: validQuoteId },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.suggested_cost_item_name).toBe('Riverside Palace - Gói Tiệc Kim Cương');
      expect(body.data.suggested_amount).toBe('180000000');
      expect(body.data.is_already_converted).toBe(false);
      expect(body.data.existing_cost_item).toBeNull();
    });

    it('returns 200 with is_already_converted = true and existing cost item when already converted', async () => {
      const ownerSession = createMockSession('owner');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);

      const alreadyConvertedPreview: QuoteToCostPreviewResponse = {
        ...mockPreviewResponse,
        is_already_converted: true,
        existing_cost_item: {
          id: existingCostItemId,
          name: 'Riverside Palace - Gói Tiệc Kim Cương',
          status: 'contracted',
          contracted_amount: '180000000',
        },
      };
      vi.spyOn(quoteToCostService, 'generateQuoteToCostPreview').mockResolvedValue(alreadyConvertedPreview);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/vendors/${validVendorId}/quotes/${validQuoteId}/create-cost-item`
      );
      const res = await quoteToCostRoute.GET(req, {
        params: { id: validVendorId, quoteId: validQuoteId },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.is_already_converted).toBe(true);
      expect(body.data.existing_cost_item.id).toBe(existingCostItemId);
    });
  });

  // ===========================================================================
  // 2. POST (Conversion & AT23 Idempotency Guard)
  // ===========================================================================
  describe('POST /api/v1/vendors/[id]/quotes/[quoteId]/create-cost-item (Conversion)', () => {
    it('returns 400 BAD_REQUEST for invalid UUIDs', async () => {
      const ownerSession = createMockSession('owner');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);

      const req = new NextRequest(
        'http://localhost:3000/api/v1/vendors/bad/quotes/bad/create-cost-item',
        {
          method: 'POST',
          body: JSON.stringify({ category_id: validCategoryId }),
        }
      );
      const res = await quoteToCostRoute.POST(req, {
        params: { id: 'bad', quoteId: 'bad' },
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('BAD_REQUEST');
    });

    it('AT03: returns 403 FORBIDDEN when family_view attempts conversion', async () => {
      const familySession = createMockSession('family_view');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(familySession as any);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/vendors/${validVendorId}/quotes/${validQuoteId}/create-cost-item`,
        {
          method: 'POST',
          body: JSON.stringify({ category_id: validCategoryId }),
        }
      );
      const res = await quoteToCostRoute.POST(req, {
        params: { id: validVendorId, quoteId: validQuoteId },
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe('FORBIDDEN');
    });

    it('returns 400 VALIDATION_ERROR when category_id is missing', async () => {
      const ownerSession = createMockSession('owner');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/vendors/${validVendorId}/quotes/${validQuoteId}/create-cost-item`,
        {
          method: 'POST',
          body: JSON.stringify({ name: 'Cost Item without category' }),
        }
      );
      const res = await quoteToCostRoute.POST(req, {
        params: { id: validVendorId, quoteId: validQuoteId },
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 201 Created on initial conversion (action: created_new)', async () => {
      const ownerSession = createMockSession('owner');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);
      const convertSpy = vi
        .spyOn(quoteToCostService, 'convertQuoteToCostItem')
        .mockResolvedValue(mockCreatedNewResponse);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/vendors/${validVendorId}/quotes/${validQuoteId}/create-cost-item`,
        {
          method: 'POST',
          body: JSON.stringify({
            category_id: validCategoryId,
            name: 'Riverside Palace - Gói Tiệc Kim Cương',
            status: 'contracted',
          }),
        }
      );
      const res = await quoteToCostRoute.POST(req, {
        params: { id: validVendorId, quoteId: validQuoteId },
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.action).toBe('created_new');
      expect(body.is_already_converted).toBe(false);
      expect(body.cost_item_id).toBe('new-cost-item-id-123');
      expect(convertSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          quoteId: validQuoteId,
          userId: ownerSession.user.id,
        })
      );
    });

    it('AT23 Invariant: returns 200 OK with already_existed when re-converting same quote (prevents duplicates)', async () => {
      const ownerSession = createMockSession('owner');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);
      vi.spyOn(quoteToCostService, 'convertQuoteToCostItem').mockResolvedValue(mockAlreadyExistedResponse);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/vendors/${validVendorId}/quotes/${validQuoteId}/create-cost-item`,
        {
          method: 'POST',
          body: JSON.stringify({
            category_id: validCategoryId,
          }),
        }
      );
      const res = await quoteToCostRoute.POST(req, {
        params: { id: validVendorId, quoteId: validQuoteId },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.action).toBe('already_existed');
      expect(body.is_already_converted).toBe(true);
      expect(body.cost_item_id).toBe(existingCostItemId);
      expect(body.message).toContain('đã được tạo trước đó');
    });

    it('AT54: passes Idempotency-Key header to service', async () => {
      const ownerSession = createMockSession('owner');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);
      const convertSpy = vi
        .spyOn(quoteToCostService, 'convertQuoteToCostItem')
        .mockResolvedValue(mockCreatedNewResponse);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/vendors/${validVendorId}/quotes/${validQuoteId}/create-cost-item`,
        {
          method: 'POST',
          headers: {
            'Idempotency-Key': 'IDEMP-TEST-KEY-001',
          },
          body: JSON.stringify({
            category_id: validCategoryId,
          }),
        }
      );
      await quoteToCostRoute.POST(req, {
        params: { id: validVendorId, quoteId: validQuoteId },
      });

      expect(convertSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          idempotencyKey: 'IDEMP-TEST-KEY-001',
        })
      );
    });
  });
});
