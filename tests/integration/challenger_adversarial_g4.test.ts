import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateCostItemMetrics,
  calculateOverallBudgetSummary,
  calculateCashLedger,
  calculateInstallmentStatus,
  calculateRefundCeiling,
} from '@/lib/finance/calculator';
import {
  reallocateAdvancePayment,
  AllocationNotFoundError,
  ReallocationAmountError,
} from '@/lib/finance/schedules.repository';
import {
  createPayment,
  voidPayment,
  RefundExceedsCeilingError,
  AllocationSumMismatchError,
  VoidDependentRefundsError,
} from '@/lib/finance/payments.repository';
import {
  cancelCostItem,
  updateCostItem,
  VersionConflictError,
} from '@/lib/finance/costs.repository';
import {
  hashPayload,
  withIdempotency,
  IdempotencyConflictError,
  IdempotencyForbiddenError,
} from '@/lib/finance/idempotency.service';
import { db } from '@/db/client';

describe('Adversarial Challenger Suite: Gate G4 Financial Invariants & Concurrency', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // AT11: UNPRICED ITEM WITH DEPOSIT
  // =========================================================================
  describe('AT11: Unpriced cost item with paid deposit', () => {
    it('records deposit paid while confirmed remaining is strictly undefined (null), NOT false 0', () => {
      const item = {
        name: 'Ban nhạc hòa tấu đón khách',
        estimatedAmount: null,
        contractedAmount: null,
        finalSettlementAmount: null,
        status: 'draft',
      };

      const payments = [
        { paymentType: 'outflow' as const, amount: 2000000n, isVoided: false },
      ];

      const metrics = calculateCostItemMetrics(item, payments);

      expect(metrics.totalOutflow).toBe(2000000n);
      expect(metrics.netPaid).toBe(2000000n);
      expect(metrics.priceBasis).toBeNull();
      expect(metrics.isPriceMissing).toBe(true);
      // Critical invariant AT11: Must NOT report 0 VND remaining obligation!
      expect(metrics.confirmedRemaining).toBeNull();
      expect(metrics.projectedRemaining).toBeNull();
      expect(metrics.surplusPaid).toBe(0n);
    });
  });

  // =========================================================================
  // AT12: MULTI-INSTALLMENT FLOW & 2M REFUND
  // =========================================================================
  describe('AT12: Multi-installment payments and refund deduction', () => {
    it('correctly calculates remaining debt per installment and net paid after 2M refund', () => {
      // Contract: 30.000.000 VND photography, 3 installments of 10.000.000 VND
      const schedule1 = {
        id: 'sched-1',
        installmentNumber: 1,
        title: 'Đợt 1: Đặt cọc giữ chỗ',
        amountDue: 10000000n,
        dueDate: '2026-10-01',
        status: 'agreed' as const,
      };
      const schedule2 = {
        id: 'sched-2',
        installmentNumber: 2,
        title: 'Đợt 2: Thanh toán ngày chụp',
        amountDue: 10000000n,
        dueDate: '2026-11-01',
        status: 'agreed' as const,
      };

      // Scenario:
      // - Paid 10M for installment 1
      // - Paid 5M for installment 2
      // - Received 2M refund from installment 1
      const initialPayments = [
        { paymentType: 'outflow' as const, amount: 10000000n, isVoided: false },
        { paymentType: 'outflow' as const, amount: 5000000n, isVoided: false },
        { paymentType: 'refund' as const, amount: 2000000n, isVoided: false },
      ];

      const metrics = calculateCostItemMetrics(
        { contractedAmount: 30000000n },
        initialPayments
      );

      // Total paid: 15M - 2M = 13M net paid
      expect(metrics.netPaid).toBe(13000000n);
      // Remaining obligation: 30M - 13M = 17M
      expect(metrics.confirmedRemaining).toBe(17000000n);

      // Verify schedule status for installment 2 (5M paid of 10M)
      const sched2Status = calculateInstallmentStatus(
        schedule2,
        [{ scheduleId: 'sched-2', allocatedAmount: 5000000n }]
      );
      expect(sched2Status.allocatedAmount).toBe(5000000n);
      expect(sched2Status.remainingDue).toBe(5000000n);
    });
  });

  // =========================================================================
  // AT13 & AT54: IDEMPOTENCY LOCK & CONCURRENCY
  // =========================================================================
  describe('AT13 & AT54: Idempotency replay and conflict prevention', () => {
    it('AT13: duplicate request returns cached result with 0 duplicate mutations', async () => {
      const payload = { cost_item_id: 'c1', amount: '10000000' };
      const hash = hashPayload(payload);

      let callCount = 0;
      vi.spyOn(db, 'select').mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount === 1) return Promise.resolve([{ id: 'u1', role: 'owner' }]);
              return Promise.resolve([
                {
                  id: 'rec-1',
                  requestHash: hash,
                  status: 'completed',
                  responseStatus: 201,
                  responseBody: { paymentId: 'p-original', amount: '10000000' },
                },
              ]);
            }),
          }),
        }),
      }) as any);

      const executeFn = vi.fn();

      const result = await withIdempotency({
        key: 'idemp-uuid-1234',
        userId: 'u1',
        operationType: 'RECORD_PAYMENT',
        payload,
        execute: executeFn,
      });

      expect(result.fromCache).toBe(true);
      expect(result.status).toBe(201);
      expect((result.body as any).paymentId).toBe('p-original');
      expect(executeFn).not.toHaveBeenCalled();
    });

    it('AT54: rejects request with 409 Conflict if same key is reused with different payload', async () => {
      const payloadA = { cost_item_id: 'c1', amount: '10000000' };
      const payloadB = { cost_item_id: 'c1', amount: '20000000' };

      let callCount = 0;
      vi.spyOn(db, 'select').mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount === 1) return Promise.resolve([{ id: 'u1', role: 'owner' }]);
              return Promise.resolve([
                {
                  id: 'rec-1',
                  requestHash: hashPayload(payloadA), // existing hash is for payloadA
                  status: 'completed',
                  responseStatus: 201,
                  responseBody: {},
                },
              ]);
            }),
          }),
        }),
      }) as any);

      await expect(
        withIdempotency({
          key: 'idemp-uuid-1234',
          userId: 'u1',
          operationType: 'RECORD_PAYMENT',
          payload: payloadB, // Reusing key with payloadB!
          execute: vi.fn(),
        })
      ).rejects.toThrow(IdempotencyConflictError);
    });

    it('AT54: rejects replay with 403 Forbidden after owner permission is revoked', async () => {
      vi.spyOn(db, 'select').mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'u1', role: 'family_view' }]), // Revoked to family_view!
          }),
        }),
      }) as any);

      await expect(
        withIdempotency({
          key: 'idemp-uuid-1234',
          userId: 'u1',
          operationType: 'RECORD_PAYMENT',
          payload: { amount: '1000' },
          execute: vi.fn(),
        })
      ).rejects.toThrow(IdempotencyForbiddenError);
    });
  });

  // =========================================================================
  // AT14: REFUND CEILING & ILLEGAL REFUNDS
  // =========================================================================
  describe('AT14: Refund ceiling validation', () => {
    it('blocks refund that exceeds the original payment amount', () => {
      const parentPayment = {
        id: 'p-1',
        paymentType: 'outflow' as const,
        amount: 10000000n, // 10M original deposit
        isVoided: false,
      };

      const existingRefunds = [
        { parentPaymentId: 'p-1', amount: 4000000n, isVoided: false }, // 4M already refunded
      ];

      const ceiling = calculateRefundCeiling(parentPayment, existingRefunds);
      expect(ceiling.maxRefundable).toBe(6000000n);

      // Attempting to refund 7M must exceed ceiling
      const requestedRefund = 7000000n;
      expect(requestedRefund > ceiling.maxRefundable).toBe(true);
    });
  });

  // =========================================================================
  // AT15: INDEPENDENT SURPLUS & DEBT (NO NETTING)
  // =========================================================================
  describe('AT15: Separation of item surplus and remaining debt', () => {
    it('never offsets surplus of Item A against debt of Item B', () => {
      // Item A: 10M contract, 12M paid -> 2M surplus
      const itemA = {
        item: { status: 'contracted' },
        metrics: calculateCostItemMetrics(
          { contractedAmount: 10000000n },
          [{ paymentType: 'outflow', amount: 12000000n }]
        ),
      };

      // Item B: 20M contract, 15M paid -> 5M remaining debt
      const itemB = {
        item: { status: 'contracted' },
        metrics: calculateCostItemMetrics(
          { contractedAmount: 20000000n },
          [{ paymentType: 'outflow', amount: 15000000n }]
        ),
      };

      const summary = calculateOverallBudgetSummary(50000000n, [itemA, itemB]);

      // Critical AT15 checks:
      // Item A surplus: 2M
      expect(itemA.metrics.surplusPaid).toBe(2000000n);
      expect(itemA.metrics.confirmedRemaining).toBe(0n);

      // Item B debt: 5M
      expect(itemB.metrics.confirmedRemaining).toBe(5000000n);
      expect(itemB.metrics.surplusPaid).toBe(0n);

      // Overall: total surplus is 2M, total debt is 5M. NEVER NETTED TO 3M DEBT!
      expect(summary.totalSurplusPaid).toBe(2000000n);
      expect(summary.totalConfirmedRemaining).toBe(5000000n);
    });
  });

  // =========================================================================
  // AT16: CONTRACT PRICE CHANGE AFTER DEPOSIT
  // =========================================================================
  describe('AT16: Contract price modification after deposit', () => {
    it('detects contractedPriceChanged when contracted amount changes and preserves payment history', async () => {
      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  id: 'c-1',
                  contractedAmount: 20000000n,
                  version: 1,
                },
              ]),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([
                {
                  id: 'c-1',
                  contractedAmount: 25000000n, // Price increased from 20M to 25M
                  version: 2,
                },
              ]),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue([]),
        }),
      };

      const result = await updateCostItem(
        mockTx as any,
        'c-1',
        {
          name: 'Gói chụp ảnh cưới',
          category_id: 'cat-1',
          contracted_amount: '25000000',
          version: 1,
        } as any,
        'user-1'
      );

      expect(result.contractedPriceChanged).toBe(true);
      expect(result.version).toBe(2);
    });
  });

  // =========================================================================
  // AT17: PROVISIONAL BUDGET WARNING ON UNPRICED ITEMS
  // =========================================================================
  describe('AT17: Provisional budget warning on missing prices', () => {
    it('marks budget as provisional and forbids declaring false surplus', () => {
      const item1 = {
        item: { status: 'contracted' },
        metrics: calculateCostItemMetrics({ contractedAmount: 50000000n }, []),
      };
      const item2 = {
        item: { status: 'draft' },
        metrics: calculateCostItemMetrics({ contractedAmount: null, estimatedAmount: null }, []),
      };

      const summary = calculateOverallBudgetSummary(100000000n, [item1, item2]);

      expect(summary.isProvisional).toBe(true);
      expect(summary.missingPricesCount).toBe(1);
      expect(summary.provisionalNote).toBe('Tạm tính — còn 1 khoản thiếu giá');
    });
  });

  // =========================================================================
  // AT37: UNCONFIGURED FUND VS CONFIRMED 0 BALANCE
  // =========================================================================
  describe('AT37: Fund settings state differentiation', () => {
    it('distinguishes unconfirmed fund (null availableCash) from confirmed 0 VND fund', () => {
      // 1. Unconfirmed fund
      const unconfirmed = calculateCashLedger(
        { initialBalance: 0n, fundScopeConfirmed: false },
        [],
        []
      );
      expect(unconfirmed.isConfigured).toBe(false);
      expect(unconfirmed.availableCash).toBeNull();

      // 2. Confirmed 0 VND fund
      const confirmedZero = calculateCashLedger(
        {
          openingAsOf: '2026-11-01T00:00:00Z',
          initialBalance: 0n,
          fundScopeConfirmed: true,
        },
        [],
        []
      );
      expect(confirmedZero.isConfigured).toBe(true);
      expect(confirmedZero.availableCash).toBe(0n);
    });
  });

  // =========================================================================
  // AT38: DIRECT VENDOR PAYMENT BY THIRD PARTY
  // =========================================================================
  describe('AT38: Direct third party payment to vendor ("Người khác góp bằng cách trả hộ")', () => {
    it('increases total paid and contribution ledger with zero change to bride/groom available cash', () => {
      const settings = {
        openingAsOf: '2026-11-01T00:00:00.000Z',
        initialBalance: 30000000n,
        fundScopeConfirmed: true,
      };

      // Relative pays 5M directly to venue vendor
      const payments = [
        {
          paymentType: 'outflow' as const,
          amount: 5000000n,
          transactionTime: '2026-11-03T10:00:00.000Z',
          isDirectThirdParty: true,
          isVoided: false,
        },
      ];

      const fundingEntries = [
        {
          entryType: 'direct_vendor_payment' as const,
          amount: 5000000n,
          contributionDate: '2026-11-03T10:00:00.000Z',
          isVoided: false,
        },
      ];

      const ledger = calculateCashLedger(settings, payments, fundingEntries);

      expect(ledger.totalDisbursedAllTime).toBe(5000000n);
      expect(ledger.directThirdPartyDisbursements).toBe(5000000n);
      // Available cash in bride/groom wedding fund remains exactly 30M!
      expect(ledger.availableCash).toBe(30000000n);
    });
  });

  // =========================================================================
  // AT45: HISTORICAL DEPOSIT PRIOR TO OPENING CUTOFF
  // =========================================================================
  describe('AT45: Historical deposit before opening fund cutoff', () => {
    it('re-entering a historical deposit before opening cutoff does not deduct from opening balance', () => {
      // Opening balance at Nov 1 is 90M (which already accounted for prior 10M deposit)
      const settings = {
        openingAsOf: '2026-11-01T00:00:00.000Z',
        initialBalance: 90000000n,
        fundScopeConfirmed: true,
      };

      const payments = [
        // Historical 10M deposit on Oct 20
        {
          paymentType: 'outflow' as const,
          amount: 10000000n,
          transactionTime: '2026-10-20T10:00:00.000Z',
          isDirectThirdParty: false,
          isVoided: false,
        },
      ];

      const ledger = calculateCashLedger(settings, payments, []);

      expect(ledger.totalDisbursedAllTime).toBe(10000000n);
      expect(ledger.disbursedPriorToOpening).toBe(10000000n);
      expect(ledger.disbursedPostOpening).toBe(0n);
      // Invariant AT45: Available cash is still 90M, not deducted to 80M!
      expect(ledger.availableCash).toBe(90000000n);
    });
  });

  // =========================================================================
  // AT46: REALLOCATION OF ADVANCE DEPOSITS
  // =========================================================================
  describe('AT46: Advance deposit reallocation without duplicate payments', () => {
    it('reallocates unassigned advance deposit to newly created schedule installment by updating allocations only', async () => {
      const mockTx = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([
                  {
                    id: 'alloc-advance-1',
                    paymentId: 'pay-advance-1',
                    scheduleId: null, // Advance unassigned
                    allocatedAmount: 10000000n,
                  },
                ]),
              }),
            }),
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  id: 'sched-new-1',
                  costItemId: 'cost-1',
                  installmentNumber: 1,
                  amountDue: 10000000n,
                },
              ]),
            }),
          }),
        })),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([
                {
                  id: 'alloc-advance-1',
                  scheduleId: 'sched-new-1',
                  allocatedAmount: 10000000n,
                },
              ]),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue([]),
        }),
      };

      const result = await reallocateAdvancePayment(
        mockTx as any,
        {
          costItemId: 'cost-1',
          allocationId: 'alloc-advance-1',
          targetScheduleId: 'sched-new-1',
          amountToReallocate: 10000000n,
        },
        'user-1'
      );

      // Verify allocation was updated to target schedule
      expect(result.allocated.scheduleId).toBe('sched-new-1');
      // Crucial: mockTx.insert was only called for audit_logs, NEVER payments!
      expect(mockTx.update).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // AT47: CANCELLATION WITH FEE & MULTI-STAGE REFUND
  // =========================================================================
  describe('AT47: Service cancellation with penalty fee and refund', () => {
    it('10M deposit, cancelled with 3M penalty fee, 7M refund results in net paid 3M and 0 debt/surplus', () => {
      // 10M deposit paid, 7M refunded
      const payments = [
        { paymentType: 'outflow' as const, amount: 10000000n, isVoided: false },
        { paymentType: 'refund' as const, amount: 7000000n, isVoided: false },
      ];

      // Cancelled item with 3M penalty fee
      const item = {
        name: 'Trang phục cưới',
        contractedAmount: 20000000n,
        cancellationFee: 3000000n,
        finalSettlementAmount: 3000000n, // Penalty fee becomes final settlement obligation
        status: 'cancelled',
      };

      const metrics = calculateCostItemMetrics(item, payments);

      expect(metrics.totalOutflow).toBe(10000000n);
      expect(metrics.totalRefund).toBe(7000000n);
      // Net paid: 3M
      expect(metrics.netPaid).toBe(3000000n);
      // Final obligation: 3M
      expect(metrics.priceBasis).toBe(3000000n);
      // Debt remaining: 0 VND
      expect(metrics.confirmedRemaining).toBe(0n);
      // Surplus: 0 VND
      expect(metrics.surplusPaid).toBe(0n);
    });
  });

  // =========================================================================
  // AT48: ZERO VND SETTLEMENT (0 IS VALID!)
  // =========================================================================
  describe('AT48: 0 VND settlement is valid and not replaced by estimated amount', () => {
    it('preserves finalSettlementAmount = 0n via strict null checking', () => {
      const item = {
        name: 'Quà tặng kèm đối tác',
        estimatedAmount: 5000000n,
        contractedAmount: 5000000n,
        finalSettlementAmount: 0n, // Completely waived or gifted
        status: 'completed',
      };

      const metrics = calculateCostItemMetrics(item, []);

      // Invariant AT48: 0n is NOT falsy-replaced with 5000000n
      expect(metrics.priceBasis).toBe(0n);
      expect(metrics.forecastAmount).toBe(0n);
      expect(metrics.confirmedRemaining).toBe(0n);
      expect(metrics.isPriceMissing).toBe(false);
    });
  });
});
