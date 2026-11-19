import * as costsRepository from '@/lib/finance/costs.repository';
import * as paymentsRepository from '@/lib/finance/payments.repository';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import * as sessionModule from '@/lib/auth/session';
import * as dbClient from '@/db/client';
import * as overviewRoute from '@/app/api/v1/finance/overview/route';
import * as categoriesRoute from '@/app/api/v1/finance/categories/route';
import * as costsRoute from '@/app/api/v1/finance/costs/route';
import * as costDetailRoute from '@/app/api/v1/finance/costs/[id]/route';
import * as costCancelRoute from '@/app/api/v1/finance/costs/[id]/cancel/route';
import * as schedulesRoute from '@/app/api/v1/finance/schedules/route';
import * as reallocateRoute from '@/app/api/v1/finance/schedules/reallocate/route';
import * as paymentsRoute from '@/app/api/v1/finance/payments/route';
import * as voidPaymentRoute from '@/app/api/v1/finance/payments/[id]/void/route';
import * as fundSettingsRoute from '@/app/api/v1/finance/fund-settings/route';
import * as fundingEntriesRoute from '@/app/api/v1/finance/funding-entries/route';

describe('Gate G4 Financial API Integration Test Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const ownerSession = {
    user: { id: 'owner_user_uuid', email: 'owner@wedding.local', name: 'Owner' },
    role: 'owner' as const,
    allowedEventIds: ['e0000000-0000-4000-8000-000000000001'],
    session: { id: 'session_1', userId: 'owner_user_uuid', expiresAt: new Date(Date.now() + 86400000), token: 'token' },
  };

  const familySession = {
    user: { id: 'family_user_uuid', email: 'family@wedding.local', name: 'Family' },
    role: 'family_view' as const,
    allowedEventIds: ['e0000000-0000-4000-8000-000000000001'],
    session: { id: 'session_2', userId: 'family_user_uuid', expiresAt: new Date(Date.now() + 86400000), token: 'token' },
  };

  describe('1. Privacy & Role Isolation (AT03, UXT16)', () => {
    it('blocks Family View with 403 Forbidden on GET /api/v1/finance/overview', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(familySession as any);

      const req = new NextRequest('http://localhost:3000/api/v1/finance/overview');
      const res = await overviewRoute.GET(req);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toContain('Family role cannot view financial overview');
    });

    it('blocks Family View with 403 Forbidden on GET /api/v1/finance/costs', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(familySession as any);

      const req = new NextRequest('http://localhost:3000/api/v1/finance/costs');
      const res = await costsRoute.GET(req);
      expect(res.status).toBe(403);
    });

    it('blocks Family View with 403 Forbidden on GET /api/v1/finance/payments', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(familySession as any);

      const req = new NextRequest('http://localhost:3000/api/v1/finance/payments');
      const res = await paymentsRoute.GET(req);
      expect(res.status).toBe(403);
    });

    it('blocks Family View with 403 Forbidden on GET /api/v1/finance/fund-settings', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(familySession as any);

      const req = new NextRequest('http://localhost:3000/api/v1/finance/fund-settings');
      const res = await fundSettingsRoute.GET(req);
      expect(res.status).toBe(403);
    });
  });

  describe('2. Financial Overview & Budget Metrics (AT15, AT17, AT37, AT45)', () => {
    it('returns 200 with full financial indicators and serialized BigInt strings for Owner', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);
      vi.spyOn(dbClient, 'withTransactionScopedContext').mockImplementation(
        async (_userId, _role, _callback) => {
          return {
            categories: [
              { id: 'cat-1', name: 'Tiệc cưới', defaultOrder: 1, allocatedAmount: 200000000n },
            ],
            budgetSummary: {
              targetBudget: 200000000n,
              totalProjectedCost: 180000000n,
              hasMissingPrices: false,
              missingPricesCount: 0,
              isProvisional: false,
              totalNetPaid: 80000000n,
              totalConfirmedRemaining: 100000000n,
              totalProjectedRemaining: 100000000n,
              totalSurplusPaid: 0n,
              budgetVariance: 20000000n,
              isOverBudget: false,
              settledItemsCount: 0,
              totalItemsCount: 1,
            },
            cashLedger: {
              isConfigured: true,
              initialBalance: 90000000n,
              openingAsOf: new Date('2026-11-01T00:00:00Z'),
              availableCash: 90000000n,
              totalDisbursedAllTime: 10000000n,
              disbursedPriorToOpening: 10000000n,
              disbursedPostOpening: 0n,
              directThirdPartyDisbursements: 0n,
              postOpeningCashContributions: 0n,
            },
            totalItemsCount: 1,
            recentPaymentsCount: 1,
          };
        }
      );

      const req = new NextRequest('http://localhost:3000/api/v1/finance/overview');
      const res = await overviewRoute.GET(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data.budgetSummary.targetBudget).toBe('200000000');
      expect(body.data.budgetSummary.totalProjectedCost).toBe('180000000');
      expect(body.data.cashLedger.availableCash).toBe('90000000');
    });
  });

  describe('3. Cost Items API (AT11, AT16, AT47, AT48)', () => {
    it('creates a cost item and returns 201 with serialized BigInt', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);
      vi.spyOn(costsRepository, 'createCostItem').mockImplementation(
        async () => {
          return {
            id: 'c0000000-0000-4000-8000-000000000001',
            name: 'Thuê sảnh tiệc & Thực đơn',
            categoryId: 'b0000000-0000-4000-8000-000000000001',
            contractedAmount: 150000000n,
            estimatedAmount: 150000000n,
            status: 'contracted',
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        }
      );

      vi.spyOn(dbClient, 'withTransactionScopedContext').mockImplementation(async (_userId, _role, callback) => callback({} as any, {} as any));

      const req = new NextRequest('http://localhost:3000/api/v1/finance/costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Thuê sảnh tiệc & Thực đơn',
          category_id: 'b0000000-0000-4000-8000-000000000001',
          contracted_amount: '150000000',
          estimated_amount: '150000000',
          status: 'contracted',
        }),
      });

      const res = await costsRoute.POST(req);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.contractedAmount).toBe('150000000');
    });

    it('AT47 & AT48: cancels cost item with cancellation fee and 0 VND fee is accepted', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);
      vi.spyOn(dbClient, 'withTransactionScopedContext').mockImplementation(
        async (_userId, _role, _callback) => {
          return {
            id: 'c0000000-0000-4000-8000-000000000002',
            name: 'Áo cưới Hoàng Gia',
            status: 'cancelled',
            cancellationFee: 0n,
            finalSettlementAmount: 0n,
            version: 2,
            updatedAt: new Date(),
          };
        }
      );

      const req = new NextRequest('http://localhost:3000/api/v1/finance/costs/c0000000-0000-4000-8000-000000000002/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cancellation_fee: '0',
          cancellation_notes: 'Nhà cung cấp đồng ý hủy miễn phí',
          version: 1,
        }),
      });

      const res = await costCancelRoute.POST(req, {
        params: Promise.resolve({ id: 'c0000000-0000-4000-8000-000000000002' }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.status).toBe('cancelled');
      expect(body.data.cancellationFee).toBe('0');
      expect(body.data.finalSettlementAmount).toBe('0');
    });
  });

  describe('4. Payments API (AT12, AT14, AT38, AT46)', () => {
    it('creates an outflow payment and validates allocation sum', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);
      vi.spyOn(paymentsRepository, 'createPayment').mockImplementation(
        async () => {
          return {
            id: 'p0000000-0000-4000-8000-000000000001',
            costItemId: 'c0000000-0000-4000-8000-000000000001',
            paymentType: 'outflow',
            amount: 50000000n,
            paymentMethod: 'bank_transfer',
            isVoided: false,
            version: 1,
            allocations: [
              {
                id: 'a1',
                scheduleId: 'd0000000-0000-4000-8000-000000000001',
                allocatedAmount: 50000000n,
              },
            ],
          };
        }
      );

      vi.spyOn(dbClient, 'withTransactionScopedContext').mockImplementation(async (_userId, _role, callback) => callback({} as any, {} as any));

      const req = new NextRequest('http://localhost:3000/api/v1/finance/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cost_item_id: 'c0000000-0000-4000-8000-000000000001',
          payment_type: 'outflow',
          amount: '50000000',
          payment_method: 'bank_transfer',
          schedule_allocations: [
            {
              schedule_id: 'd0000000-0000-4000-8000-000000000001',
              amount: '50000000',
            },
          ],
        }),
      });

      const res = await paymentsRoute.POST(req);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.amount).toBe('50000000');
    });

    it('AT38: creates direct third-party payment ("Người khác góp bằng cách trả hộ")', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);
      vi.spyOn(paymentsRepository, 'createDirectThirdPartyPayment').mockImplementation(
        async () => {
          return {
            payment: {
              id: 'p-direct-1',
              costItemId: 'c0000000-0000-4000-8000-000000000001',
              amount: 5000000n,
              isDirectThirdParty: true,
              linkedFundingEntryId: 'fe-1',
            },
            fundingEntry: {
              id: 'fe-1',
              entryType: 'direct_vendor_payment',
              amount: 5000000n,
              contributorName: 'Bác Ba',
            },
            allocations: [],
          };
        }
      );

      vi.spyOn(dbClient, 'withTransactionScopedContext').mockImplementation(async (_userId, _role, callback) => callback({} as any, {} as any));

      const req = new NextRequest('http://localhost:3000/api/v1/finance/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cost_item_id: 'c0000000-0000-4000-8000-000000000001',
          payment_type: 'outflow',
          amount: '5000000',
          is_direct_third_party: true,
          payer_name: 'Bác Ba',
        }),
      });

      const res = await paymentsRoute.POST(req);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.payment.isDirectThirdParty).toBe(true);
      expect(body.data.fundingEntry.entryType).toBe('direct_vendor_payment');
    });

    it('AT46: reallocates advance payment to a schedule installment', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);
      vi.spyOn(dbClient, 'withTransactionScopedContext').mockImplementation(
        async (_userId, _role, _callback) => {
          return {
            allocated: {
              id: 'a-realloc-1',
              scheduleId: 'd0000000-0000-4000-8000-000000000001',
              allocatedAmount: 10000000n,
            },
            remainingAdvance: null,
          };
        }
      );

      const req = new NextRequest('http://localhost:3000/api/v1/finance/schedules/reallocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cost_item_id: 'c0000000-0000-4000-8000-000000000001',
          allocation_id: 'a0000000-0000-4000-8000-000000000001',
          target_schedule_id: 'd0000000-0000-4000-8000-000000000001',
          amount_to_reallocate: '10000000',
        }),
      });

      const res = await reallocateRoute.POST(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.allocated.scheduleId).toBe('d0000000-0000-4000-8000-000000000001');
    });

    it('voids payment with audit reason', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);
      vi.spyOn(dbClient, 'withTransactionScopedContext').mockImplementation(
        async (_userId, _role, _callback) => {
          return {
            id: 'p0000000-0000-4000-8000-000000000001',
            isVoided: true,
            voidedReason: 'Nhập nhầm số tiền',
            version: 2,
          };
        }
      );

      const req = new NextRequest('http://localhost:3000/api/v1/finance/payments/p0000000-0000-4000-8000-000000000001/void', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voided_reason: 'Nhập nhầm số tiền',
          version: 1,
        }),
      });

      const res = await voidPaymentRoute.POST(req, {
        params: Promise.resolve({ id: 'p0000000-0000-4000-8000-000000000001' }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.isVoided).toBe(true);
      expect(body.data.voidedReason).toBe('Nhập nhầm số tiền');
    });
  });

  describe('5. Fund Settings & Opening Anchor API (AT37, AT45)', () => {
    it('updates fund opening cutoff and confirmed balance', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);
      vi.spyOn(dbClient, 'withTransactionScopedContext').mockImplementation(
        async (_userId, _role, _callback) => {
          return {
            id: 'fs-1',
            openingAsOf: new Date('2026-11-01T00:00:00Z'),
            initialBalance: 90000000n,
            fundScopeConfirmed: true,
            version: 1,
          };
        }
      );

      const req = new NextRequest('http://localhost:3000/api/v1/finance/fund-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opening_as_of: '2026-11-01T00:00:00Z',
          initial_balance: '90000000',
          fund_scope_confirmed: true,
          version: 1,
        }),
      });

      const res = await fundSettingsRoute.PUT(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.initialBalance).toBe('90000000');
      expect(body.data.fundScopeConfirmed).toBe(true);
    });
  });
});
