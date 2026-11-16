import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import * as compareRoute from '@/app/api/v1/vendors/compare/route';
import * as sessionModule from '@/lib/auth/session';
import * as dbModule from '@/db/client';
import * as comparisonService from '@/lib/vendors/comparison.service';
import {
  InvalidComparisonCountError,
} from '@/lib/vendors/comparison.service';
import { QuoteNotFoundError } from '@/lib/vendors/quotes.repository';
import { ComparePackagesResponse } from '@/schemas/vendors';

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

describe('Compare Packages API Route Handler Integration Tests (M8.3, AT03, AT24)', () => {
  const quoteId1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const quoteId2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const quoteId3 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

  const mockCompareResponse: ComparePackagesResponse = {
    simulation_params: {
      table_count: 25,
      guest_count: 250,
      include_vat_and_service_fee: true,
    },
    packages: [
      {
        quote_id: quoteId1,
        vendor_id: '11111111-1111-4111-8111-111111111111',
        vendor_name: 'Riverside Palace',
        package_name: 'Gói Kim Cương',
        version_number: 1,
        received_date: '2026-11-01',
        rental_fee: '20000000',
        table_price: '5500000',
        total_amount: null,
        capacity_fit: 'optimal',
        capacity_warning: null,
        simulation: {
          table_count: 25,
          guest_count: 250,
          base_amount: null,
          table_costs: '137500000', // 25 * 5,500,000
          rental_fee: '20000000',
          subtotal: '157500000',
          estimated_vat: '15750000', // 10%
          estimated_service_charge: '7875000', // 5%
          total_estimated: '181125000',
          is_missing_price: false,
          missing_price_label: '',
        },
        fees_inclusive: false,
        includes: ['Menu 8 món'],
        excludes: [],
        deposit_conditions: 'Cọc 30%',
        terms: null,
      },
      {
        quote_id: quoteId2,
        vendor_id: '22222222-2222-4222-8222-222222222222',
        vendor_name: 'White Palace',
        package_name: 'Gói Hoàng Gia (Chưa báo giá)',
        version_number: 1,
        received_date: '2026-11-05',
        rental_fee: null,
        table_price: null,
        total_amount: null,
        capacity_fit: 'optimal',
        capacity_warning: null,
        simulation: {
          table_count: 25,
          guest_count: 250,
          base_amount: null,
          table_costs: null,
          rental_fee: null,
          subtotal: null,
          estimated_vat: null,
          estimated_service_charge: null,
          total_estimated: null,
          is_missing_price: true, // AT24 Missing Price
          missing_price_label: 'Chưa báo', // AT24 Badge
        },
        fees_inclusive: false,
        includes: ['Sảnh Alpas'],
        excludes: [],
        deposit_conditions: null,
        terms: null,
      },
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(dbModule, 'withTransactionScopedContext').mockImplementation(
      async (_userId, _role, callback) => callback({} as any, {} as any)
    );
  });

  it('returns 401 UNAUTHORIZED when no session exists', async () => {
    vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(null);

    const req = new NextRequest('http://localhost:3000/api/v1/vendors/compare', {
      method: 'POST',
      body: JSON.stringify({ quote_ids: [quoteId1, quoteId2] }),
    });
    const res = await compareRoute.POST(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('UNAUTHORIZED');
  });

  it('AT03: returns 403 FORBIDDEN when family_view attempts package comparison', async () => {
    const familySession = createMockSession('family_view');
    vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(familySession as any);

    const req = new NextRequest('http://localhost:3000/api/v1/vendors/compare', {
      method: 'POST',
      body: JSON.stringify({ quote_ids: [quoteId1, quoteId2] }),
    });
    const res = await compareRoute.POST(req);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('FORBIDDEN');
  });

  it('returns 400 BAD_REQUEST when JSON body is invalid', async () => {
    const ownerSession = createMockSession('owner');
    vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);

    const req = new NextRequest('http://localhost:3000/api/v1/vendors/compare', {
      method: 'POST',
      body: 'invalid-json{{{',
    });
    const res = await compareRoute.POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('BAD_REQUEST');
  });

  it('returns 400 VALIDATION_ERROR when fewer than 2 quotes are passed (< 2)', async () => {
    const ownerSession = createMockSession('owner');
    vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);

    const req = new NextRequest('http://localhost:3000/api/v1/vendors/compare', {
      method: 'POST',
      body: JSON.stringify({ quote_ids: [quoteId1] }), // Only 1 quote
    });
    const res = await compareRoute.POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('VALIDATION_ERROR');
    expect(body.message).toContain('tối thiểu 2');
  });

  it('returns 400 VALIDATION_ERROR when more than 4 quotes are passed (> 4)', async () => {
    const ownerSession = createMockSession('owner');
    vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);

    const req = new NextRequest('http://localhost:3000/api/v1/vendors/compare', {
      method: 'POST',
      body: JSON.stringify({
        quote_ids: [
          quoteId1,
          quoteId2,
          quoteId3,
          'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', // 5 quotes
        ],
      }),
    });
    const res = await compareRoute.POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('VALIDATION_ERROR');
    expect(body.message).toContain('Tối đa so sánh 4');
  });

  it('returns 400 VALIDATION_ERROR when table_count is non-positive (<= 0)', async () => {
    const ownerSession = createMockSession('owner');
    vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);

    const req = new NextRequest('http://localhost:3000/api/v1/vendors/compare', {
      method: 'POST',
      body: JSON.stringify({
        quote_ids: [quoteId1, quoteId2],
        table_count: 0,
      }),
    });
    const res = await compareRoute.POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('VALIDATION_ERROR');
    expect(body.message).toContain('số nguyên dương');
  });

  it('returns 400 BAD_REQUEST when InvalidComparisonCountError is thrown by service', async () => {
    const ownerSession = createMockSession('owner');
    vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);
    vi.spyOn(comparisonService, 'comparePackages').mockRejectedValue(new InvalidComparisonCountError());

    const req = new NextRequest('http://localhost:3000/api/v1/vendors/compare', {
      method: 'POST',
      body: JSON.stringify({
        quote_ids: [quoteId1, quoteId2],
      }),
    });
    const res = await compareRoute.POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('BAD_REQUEST');
  });

  it('returns 404 NOT_FOUND when QuoteNotFoundError is thrown', async () => {
    const ownerSession = createMockSession('owner');
    vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);
    vi.spyOn(comparisonService, 'comparePackages').mockRejectedValue(new QuoteNotFoundError());

    const req = new NextRequest('http://localhost:3000/api/v1/vendors/compare', {
      method: 'POST',
      body: JSON.stringify({
        quote_ids: [quoteId1, quoteId2],
      }),
    });
    const res = await compareRoute.POST(req);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('NOT_FOUND');
  });

  it('returns 200 OK with simulated breakdown, transparent VAT/service fees, and AT24 Chưa báo badge', async () => {
    const ownerSession = createMockSession('owner');
    vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);
    const compareSpy = vi
      .spyOn(comparisonService, 'comparePackages')
      .mockResolvedValue(mockCompareResponse);

    const payload = {
      quote_ids: [quoteId1, quoteId2],
      table_count: 25,
      guest_count: 250,
      include_vat_and_service_fee: true,
    };

    const req = new NextRequest('http://localhost:3000/api/v1/vendors/compare', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const res = await compareRoute.POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();

    // Verify simulation params
    expect(body.simulation_params.table_count).toBe(25);
    expect(body.simulation_params.guest_count).toBe(250);

    // Verify package 1 calculations
    const pkg1 = body.packages[0];
    expect(pkg1.simulation.table_costs).toBe('137500000');
    expect(pkg1.simulation.estimated_vat).toBe('15750000');
    expect(pkg1.simulation.estimated_service_charge).toBe('7875000');
    expect(pkg1.simulation.total_estimated).toBe('181125000');
    expect(pkg1.simulation.is_missing_price).toBe(false);

    // Verify package 2 AT24 Missing Price ("Chưa báo" instead of fake 0 VND)
    const pkg2 = body.packages[1];
    expect(pkg2.simulation.is_missing_price).toBe(true);
    expect(pkg2.simulation.missing_price_label).toBe('Chưa báo');
    expect(pkg2.simulation.total_estimated).toBeNull();

    expect(compareSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        quoteIds: [quoteId1, quoteId2],
        tableCount: 25,
        guestCount: 250,
        includeVatAndServiceFee: true,
      })
    );
  });
});
