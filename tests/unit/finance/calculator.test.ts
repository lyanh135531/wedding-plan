import { describe, it, expect } from 'vitest';
import {
  calculateCostItemMetrics,
  calculateOverallBudgetSummary,
  calculateCashLedger,
  calculateInstallmentStatus,
  calculateRefundCeiling,
} from '../../../src/lib/finance/calculator';
import {
  FX02_CANCELLED_SERVICE,
  FX03_OPENING_CUTOFF,
} from '../../fixtures';

describe('Financial Calculation Engine (Gate G4 Unit Tests)', () => {
  describe('calculateCostItemMetrics', () => {
    it('AT11: handles unpriced item with deposit — price undefined, not 0n false obligation', () => {
      const item = {
        estimatedAmount: null,
        contractedAmount: null,
        finalSettlementAmount: null,
        status: 'draft',
      };
      const payments = [
        { paymentType: 'outflow' as const, amount: 5000000n, isVoided: false },
      ];

      const metrics = calculateCostItemMetrics(item, payments);

      expect(metrics.totalOutflow).toBe(5000000n);
      expect(metrics.totalRefund).toBe(0n);
      expect(metrics.netPaid).toBe(5000000n);
      expect(metrics.priceBasis).toBeNull();
      expect(metrics.forecastAmount).toBeNull();
      expect(metrics.isPriceMissing).toBe(true);
      // Crucial: confirmedRemaining MUST be null, not 0n!
      expect(metrics.confirmedRemaining).toBeNull();
      expect(metrics.projectedRemaining).toBeNull();
      expect(metrics.surplusPaid).toBe(0n);
    });

    it('AT48: finalSettlementAmount = 0n is a valid settlement, not replaced by estimatedAmount', () => {
      const item = {
        estimatedAmount: 10000000n,
        contractedAmount: 10000000n,
        finalSettlementAmount: 0n, // Gifted/waived or fully cancelled with 0 fee
        status: 'completed',
      };
      const payments: Array<{ paymentType: 'outflow' | 'refund'; amount: bigint; isVoided?: boolean }> = [];

      const metrics = calculateCostItemMetrics(item, payments);

      expect(metrics.priceBasis).toBe(0n);
      expect(metrics.forecastAmount).toBe(0n);
      expect(metrics.isPriceMissing).toBe(false);
      expect(metrics.confirmedRemaining).toBe(0n);
      expect(metrics.surplusPaid).toBe(0n);
    });

    it('AT15: calculates surplusPaid correctly when netPaid exceeds priceBasis', () => {
      const item = {
        estimatedAmount: 20000000n,
        contractedAmount: 20000000n,
        finalSettlementAmount: null,
        status: 'contracted',
      };
      // Overpaid: 22M paid on a 20M contract
      const payments = [
        { paymentType: 'outflow' as const, amount: 22000000n, isVoided: false },
      ];

      const metrics = calculateCostItemMetrics(item, payments);

      expect(metrics.netPaid).toBe(22000000n);
      expect(metrics.confirmedRemaining).toBe(0n);
      expect(metrics.surplusPaid).toBe(2000000n); // 2M surplus
      expect(metrics.requiresScheduleReview).toBe(true);
    });

    it('AT47: FX02 cancelled service with penalty fee 3M, 10M deposit and 7M refund', () => {
      const item = {
        estimatedAmount: 30000000n,
        contractedAmount: 30000000n,
        finalSettlementAmount: 3000000n, // Cancellation fee becomes the final settlement
        status: 'cancelled',
      };
      const payments = [
        { paymentType: 'outflow' as const, amount: 10000000n, isVoided: false },
        { paymentType: 'refund' as const, amount: 7000000n, isVoided: false },
      ];

      const metrics = calculateCostItemMetrics(item, payments);

      expect(metrics.totalOutflow).toBe(10000000n);
      expect(metrics.totalRefund).toBe(7000000n);
      expect(metrics.netPaid).toBe(3000000n);
      expect(metrics.confirmedRemaining).toBe(0n);
      expect(metrics.surplusPaid).toBe(0n);
    });

    it('ignores voided transactions', () => {
      const item = {
        contractedAmount: 10000000n,
        status: 'contracted',
      };
      const payments = [
        { paymentType: 'outflow' as const, amount: 5000000n, isVoided: true },
        { paymentType: 'outflow' as const, amount: 3000000n, isVoided: false },
      ];

      const metrics = calculateCostItemMetrics(item, payments);

      expect(metrics.totalOutflow).toBe(3000000n);
      expect(metrics.netPaid).toBe(3000000n);
      expect(metrics.confirmedRemaining).toBe(7000000n);
    });
  });

  describe('calculateOverallBudgetSummary', () => {
    it('AT15: keeps surplus and debt completely separate, never netting together', () => {
      // Item A: 20M contract, 22M paid -> 2M surplus
      const itemA = {
        item: { status: 'contracted' },
        metrics: calculateCostItemMetrics(
          { contractedAmount: 20000000n },
          [{ paymentType: 'outflow', amount: 22000000n }]
        ),
      };

      // Item B: 30M contract, 25M paid -> 5M remaining debt
      const itemB = {
        item: { status: 'contracted' },
        metrics: calculateCostItemMetrics(
          { contractedAmount: 30000000n },
          [{ paymentType: 'outflow', amount: 25000000n }]
        ),
      };

      const summary = calculateOverallBudgetSummary(100000000n, [itemA, itemB]);

      // Total confirmed remaining MUST be 5M, not netted to 3M!
      expect(summary.totalConfirmedRemaining).toBe(5000000n);
      // Total surplus MUST be 2M
      expect(summary.totalSurplusPaid).toBe(2000000n);
      expect(summary.totalNetPaid).toBe(47000000n);
      expect(summary.totalProjectedCost).toBe(50000000n);
    });

    it('AT17: reports provisional warning when items lack prices', () => {
      const itemPriced = {
        item: { status: 'contracted' },
        metrics: calculateCostItemMetrics(
          { contractedAmount: 100000000n },
          []
        ),
      };
      const itemUnpriced = {
        item: { status: 'draft' },
        metrics: calculateCostItemMetrics(
          { estimatedAmount: null, contractedAmount: null },
          []
        ),
      };

      const summary = calculateOverallBudgetSummary(200000000n, [itemPriced, itemUnpriced]);

      expect(summary.hasMissingPrices).toBe(true);
      expect(summary.missingPricesCount).toBe(1);
      expect(summary.isProvisional).toBe(true);
      expect(summary.provisionalNote).toBe('Tạm tính — còn 1 khoản thiếu giá');
    });
  });

  describe('calculateCashLedger', () => {
    it('AT37: unconfirmed fund settings returns isConfigured: false and availableCash: null', () => {
      const settings = {
        initialBalance: 0n,
        fundScopeConfirmed: false,
      };

      const ledger = calculateCashLedger(settings, [], []);

      expect(ledger.isConfigured).toBe(false);
      expect(ledger.availableCash).toBeNull();
    });

    it('AT37: confirmed 0n balance returns isConfigured: true and availableCash: 0n', () => {
      const settings = {
        openingAsOf: '2026-11-01T00:00:00Z',
        initialBalance: 0n,
        fundScopeConfirmed: true,
      };

      const ledger = calculateCashLedger(settings, [], []);

      expect(ledger.isConfigured).toBe(true);
      expect(ledger.availableCash).toBe(0n);
    });

    it('AT45: historical deposit prior to opening cutoff does NOT reduce availableCash', () => {
      const settings = {
        openingAsOf: '2026-11-01T00:00:00.000Z',
        initialBalance: 90000000n,
        fundScopeConfirmed: true,
      };

      const payments = [
        // Historical deposit: 10M on Oct 15 (before Nov 1 opening cutoff)
        {
          paymentType: 'outflow' as const,
          amount: 10000000n,
          transactionTime: '2026-10-15T10:00:00.000Z',
          isDirectThirdParty: false,
          isVoided: false,
        },
        // Post-opening payment: 20M on Nov 5
        {
          paymentType: 'outflow' as const,
          amount: 20000000n,
          transactionTime: '2026-11-05T10:00:00.000Z',
          isDirectThirdParty: false,
          isVoided: false,
        },
      ];

      const ledger = calculateCashLedger(settings, payments, []);

      expect(ledger.totalDisbursedAllTime).toBe(30000000n);
      expect(ledger.disbursedPriorToOpening).toBe(10000000n);
      expect(ledger.disbursedPostOpening).toBe(20000000n);
      // Available cash = 90M - 20M = 70M (10M historical was already factored into 90M opening balance)
      expect(ledger.availableCash).toBe(70000000n);
    });

    it('AT38: direct vendor payment by relative increases total disbursement with zero impact on cash fund', () => {
      const settings = {
        openingAsOf: '2026-11-01T00:00:00.000Z',
        initialBalance: 50000000n,
        fundScopeConfirmed: true,
      };

      const payments = [
        // Relative paid 5M directly to vendor on Nov 3
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
      // Available cash remains exactly 50M!
      expect(ledger.availableCash).toBe(50000000n);
    });
  });

  describe('calculateInstallmentStatus', () => {
    it('AT12: calculates installment remaining due and overdue state accurately', () => {
      const schedule = {
        id: 'sched-1',
        installmentNumber: 1,
        title: 'Đợt 1: Đặt cọc giữ chỗ',
        amountDue: 10000000n,
        dueDate: '2026-10-01',
        status: 'agreed' as const,
      };

      const allocations = [
        { scheduleId: 'sched-1', allocatedAmount: 6000000n, isPaymentVoided: false },
      ];

      // Simulated current date after due date
      const status = calculateInstallmentStatus(
        schedule,
        allocations,
        new Date('2026-10-15T00:00:00Z')
      );

      expect(status.amountDue).toBe(10000000n);
      expect(status.allocatedAmount).toBe(6000000n);
      expect(status.remainingDue).toBe(4000000n);
      expect(status.isOverdue).toBe(true);
    });
  });

  describe('calculateRefundCeiling', () => {
    it('AT12 & AT14: verifies refund ceiling against parent outflow payment', () => {
      const parent = {
        id: 'pay-1',
        paymentType: 'outflow' as const,
        amount: 10000000n,
        isVoided: false,
      };

      // Existing 2M refund
      const existingRefunds = [
        { parentPaymentId: 'pay-1', amount: 2000000n, isVoided: false },
        { parentPaymentId: 'other-pay', amount: 5000000n, isVoided: false },
      ];

      const ceiling = calculateRefundCeiling(parent, existingRefunds);

      expect(ceiling.isValid).toBe(true);
      expect(ceiling.totalRefundedSoFar).toBe(2000000n);
      expect(ceiling.maxRefundable).toBe(8000000n);
    });

    it('rejects refund on voided parent payment', () => {
      const parent = {
        id: 'pay-1',
        paymentType: 'outflow' as const,
        amount: 10000000n,
        isVoided: true,
      };

      const ceiling = calculateRefundCeiling(parent, []);
      expect(ceiling.isValid).toBe(false);
      expect(ceiling.maxRefundable).toBe(0n);
    });
  });
});
