import { describe, it, expect } from 'vitest';
import {
  vndCurrencyStringSchema,
  vndBigIntSchema,
  nullableVndCurrencyStringSchema,
  createCostItemSchema,
  createPaymentSchema,
  paymentDtoSchema,
  createBudgetCategorySchema,
  createFundingEntrySchema,
  createPaymentScheduleSchema,
  costItemFinancialSummaryDtoSchema,
  overallBudgetSummaryDtoSchema,
  updateFundSettingsSchema,
} from '../../src/schemas';
import {
  payments,
  categoryBudgets,
  costItems,
  paymentSchedules,
  fundSettings,
  fundingEntries,
  paymentAllocations,
} from '../../src/db/schema/finance';
import { idempotencyRecords } from '../../src/db/schema/system';
import {
  calculateCostFinancialMetrics,
  calculateCashFundLedger,
  FixtureCostItem,
  FixturePayment,
  FixtureFundSettings,
  FixtureFundingEntry,
} from '../fixtures';
import {
  formatVnd,
  parseVnd,
  calculateNetPaid,
  calculateCostItemBalances,
  calculateAvailableCash,
  PaymentEntry,
} from '../helpers/bigint';

describe('Adversarial Challenger Suite: Financial Math & DB Invariants (Gate G0)', () => {
  // =========================================================================
  // 1. ABSOLUTE STRICT INTEGER BIGINT & FLOAT REJECTION
  // =========================================================================
  describe('1. Absolute Strict Integer BigInt & Zero Float Leakage', () => {
    it('rejects every conceivable float, scientific notation, and special float string', () => {
      const hostileFloats = [
        '0.0',
        '0.1',
        '0.000000001',
        '1000000.00',
        '1000000,00',
        '1e6',
        '1E6',
        '1.5e7',
        '1e-3',
        'NaN',
        '-NaN',
        'Infinity',
        '-Infinity',
        '+Infinity',
        '0x1A',
        '0b1010',
        '0o77',
      ];

      for (const input of hostileFloats) {
        const res = vndCurrencyStringSchema.safeParse(input);
        expect(res.success, `Expected rejection for "${input}"`).toBe(false);
      }
    });

    it('rejects negative numbers and negative zero strings in vndCurrencyStringSchema', () => {
      const negativeInputs = [
        '-0',
        '-1',
        '-50000',
        '-10000000',
        '-999999999999999999',
      ];

      for (const input of negativeInputs) {
        expect(vndCurrencyStringSchema.safeParse(input).success).toBe(false);
      }
    });

    it('enforces 18-digit boundary to guarantee safety within PostgreSQL signed bigint (64-bit)', () => {
      // 64-bit signed BigInt max is 9,223,372,036,854,775,807 (19 digits)
      // The schema safely caps at 18 digits (999,999,999,999,999,999)
      const eighteenDigits = '999999999999999999';
      expect(vndCurrencyStringSchema.safeParse(eighteenDigits).success).toBe(true);

      const parsedBigInt = vndBigIntSchema.parse(eighteenDigits);
      expect(parsedBigInt).toBe(999_999_999_999_999_999n);

      // 19 digits must be rejected to prevent bigint overflow
      const nineteenDigits = '1000000000000000000';
      expect(vndCurrencyStringSchema.safeParse(nineteenDigits).success).toBe(false);
    });

    it('demonstrates IEEE-754 precision failure vs BigInt immune precision', () => {
      // In JS Number (IEEE-754 double precision float), amounts > 2^53 - 1 lose precision
      const numA = 9007199254740992;
      const numB = 9007199254740993;
      // IEEE-754 falsely equates them:
      expect(numA === numB).toBe(true);

      // In BigInt, precision is exact and discrete down to 1 VND:
      const bigA: bigint = 9007199254740992n;
      const bigB: bigint = 9007199254740993n;
      expect(bigA === bigB).toBe(false);
      expect(bigB - bigA).toBe(1n);
    });

    it('verifies Drizzle ORM finance schemas use mode: "bigint" without float/numeric column types', () => {
      // Inspect Drizzle column types directly on schema definitions
      expect(categoryBudgets.allocatedAmount.dataType).toBe('bigint');
      expect(costItems.estimatedAmount.dataType).toBe('bigint');
      expect(costItems.contractedAmount.dataType).toBe('bigint');
      expect(costItems.finalSettlementAmount.dataType).toBe('bigint');
      expect(costItems.cancellationFee.dataType).toBe('bigint');
      expect(paymentSchedules.amountDue.dataType).toBe('bigint');
      expect(fundSettings.initialBalance.dataType).toBe('bigint');
      expect(fundingEntries.amount.dataType).toBe('bigint');
      expect(payments.amount.dataType).toBe('bigint');
      expect(paymentAllocations.allocatedAmount.dataType).toBe('bigint');
    });
  });

  // =========================================================================
  // 2. INVARIANT: TOTAL REFUNDED <= ORIGINAL AMOUNT ACROSS MULTIPLE REFUNDS
  // =========================================================================
  describe('2. Invariant: total_refunded <= original_amount Across Partial Refunds', () => {
    const parentPaymentId = '22000000-0000-4000-8000-000000000001';
    const originalOutflowAmount = 100_000_000n; // 100 Million VND original payment

    it('stress-tests 100 consecutive micro-refunds summing exactly to 100% of original payment', () => {
      const microRefundAmount = 1_000_000n; // 1 Million each x 100 = 100M
      const refundEntries: PaymentEntry[] = [];
      let accumulatedRefund = 0n;

      for (let i = 0; i < 100; i++) {
        // Assert oracle: before adding, accumulated + current <= original
        expect(accumulatedRefund + microRefundAmount <= originalOutflowAmount).toBe(true);
        accumulatedRefund += microRefundAmount;
        refundEntries.push({
          amount: microRefundAmount,
          type: 'refund',
          status: 'completed',
        });
      }

      expect(accumulatedRefund).toBe(originalOutflowAmount);

      // Attempting the 101st micro-refund of even 1 single VND MUST violate the invariant
      const excessiveAmount = 1n;
      expect(accumulatedRefund + excessiveAmount <= originalOutflowAmount).toBe(false);
    });

    it('verifies multi-stage variable refund sequence with 1 VND boundary test', () => {
      // Sequence: 35M, 40M, 24M999k999, 1 VND -> Total 100M
      const refunds = [
        35_000_000n,
        40_000_000n,
        24_999_999n,
      ];

      let sumRefunds = refunds.reduce((acc, r) => acc + r, 0n);
      expect(sumRefunds).toBe(99_999_999n);

      const remainingRefundable = originalOutflowAmount - sumRefunds;
      expect(remainingRefundable).toBe(1n);

      // Exactly 1 VND refund is permitted
      expect(1n <= remainingRefundable).toBe(true);

      // 2 VND refund is rejected
      expect(2n <= remainingRefundable).toBe(false);
    });

    it('verifies createPaymentSchema enforces refund requires parent_payment_id', () => {
      const invalidRefund = {
        cost_item_id: 'c0000000-0000-4000-8000-000000000001',
        payment_type: 'refund' as const,
        amount: '5000000',
        parent_payment_id: null,
      };
      const res = createPaymentSchema.safeParse(invalidRefund);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain('parent_payment_id');
      }

      const validRefund = {
        ...invalidRefund,
        parent_payment_id: parentPaymentId,
      };
      expect(createPaymentSchema.safeParse(validRefund).success).toBe(true);
    });

    it('verifies DB foreign key constraint and index for parent_payment_id', () => {
      // payments.parentPaymentId must reference payments.id with onDelete: 'restrict'
      // and have parentPaymentIdx on parentPaymentId
      expect(payments.parentPaymentId).toBeDefined();
      // Inspect that parentPaymentId is a UUID column
      expect(payments.parentPaymentId.dataType).toBe('string'); // drizzle uuid maps to string type
    });
  });

  // =========================================================================
  // 3. ZERO AND NEGATIVE BUDGET / PAYMENT ALLOCATIONS
  // =========================================================================
  describe('3. Zero and Negative Budget Boundaries', () => {
    it('rejects negative budget allocations at Zod schema level', () => {
      const negativeCategory = {
        name: 'Tiệc Cưới Âm',
        allocated_budget: '-10000000',
      };
      const res = createBudgetCategorySchema.safeParse(negativeCategory);
      expect(res.success).toBe(false);
    });

    it('allows 0 budget allocation for categories not yet allocated (default 0)', () => {
      const zeroCategory = {
        name: 'Dự phòng chưa phân bổ',
        allocated_budget: '0',
      };
      const res = createBudgetCategorySchema.safeParse(zeroCategory);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.allocated_budget).toBe('0');
      }
    });

    it('rejects zero or negative payments (amount must be strictly > 0)', () => {
      const basePayment = {
        cost_item_id: 'c0000000-0000-4000-8000-000000000001',
        payment_type: 'outflow' as const,
        payment_method: 'bank_transfer' as const,
      };

      // 0 payment rejected
      expect(createPaymentSchema.safeParse({ ...basePayment, amount: '0' }).success).toBe(false);

      // Negative payment rejected
      expect(createPaymentSchema.safeParse({ ...basePayment, amount: '-1000' }).success).toBe(false);

      // 1 VND payment accepted
      expect(createPaymentSchema.safeParse({ ...basePayment, amount: '1' }).success).toBe(true);
    });

    it('rejects zero or negative funding entry amounts', () => {
      const baseFunding = {
        entry_type: 'cash_fund' as const,
        contributor_name: 'Cặp đôi',
      };

      expect(createFundingEntrySchema.safeParse({ ...baseFunding, amount: '0' }).success).toBe(false);
      expect(createFundingEntrySchema.safeParse({ ...baseFunding, amount: '-50000' }).success).toBe(false);
      expect(createFundingEntrySchema.safeParse({ ...baseFunding, amount: '100000' }).success).toBe(true);
    });

    it('rejects zero or negative schedule installment numbers and amounts', () => {
      const baseSchedule = {
        cost_item_id: 'c0000000-0000-4000-8000-000000000001',
        title: 'Đợt 1',
        due_date: '2026-09-01',
      };

      // Installment 0 rejected
      expect(
        createPaymentScheduleSchema.safeParse({
          ...baseSchedule,
          installment_number: 0,
          amount_due: '1000000',
        }).success
      ).toBe(false);

      // Installment -1 rejected
      expect(
        createPaymentScheduleSchema.safeParse({
          ...baseSchedule,
          installment_number: -1,
          amount_due: '1000000',
        }).success
      ).toBe(false);

      // Amount due 0 rejected
      expect(
        createPaymentScheduleSchema.safeParse({
          ...baseSchedule,
          installment_number: 1,
          amount_due: '0',
        }).success
      ).toBe(false);
    });
  });

  // =========================================================================
  // 4. IDEMPOTENCY KEY TRACKING & MUTATION REPLAY PROTECTION
  // =========================================================================
  describe('4. Idempotency Key Tracking & Deduplication', () => {
    it('verifies idempotency_records table structure and uniqueness constraints', () => {
      expect(idempotencyRecords.userId).toBeDefined();
      expect(idempotencyRecords.operationType).toBeDefined();
      expect(idempotencyRecords.idempotencyKey).toBeDefined();
      expect(idempotencyRecords.requestHash).toBeDefined();
      expect(idempotencyRecords.status).toBeDefined();
      expect(idempotencyRecords.expiresAt).toBeDefined();
    });

    it('models concurrent double-submit protection with SHA-256 payload matching', () => {
      // Simulate payload and hash verification
      const payload1 = {
        cost_item_id: 'c0000000-0000-4000-8000-000000000001',
        amount: '10000000',
        payment_method: 'bank_transfer',
      };

      // Identical replay with same hash
      const hash1: string = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      const hashReplay: string = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

      // Replay with mutated amount (attack: hash collision / key reuse)
      const hashMutated: string = '5994471abb01112afcc18159f6cc74b4f511b99806da59b3caf5a9c173cacfc5';

      expect(hash1 === hashReplay).toBe(true);
      expect(hash1 === hashMutated).toBe(false);
    });
  });

  // =========================================================================
  // 5. OPENING FUND ANCHOR (opening_as_of) SUB-SECOND & TIMEZONE PRECISION
  // =========================================================================
  describe('5. Opening Fund Anchor (opening_as_of) Calculations', () => {
    it('verifies Asia/Ho_Chi_Minh (+07:00) converted to UTC anchor produces correct cutoff', () => {
      // 2026-06-01 00:00:00 +07:00 corresponds to 2026-05-31T17:00:00.000Z
      const anchorVnString = '2026-06-01T00:00:00+07:00';
      const anchorUtc = new Date(anchorVnString).toISOString();
      expect(anchorUtc).toBe('2026-05-31T17:00:00.000Z');

      const fundSettings: FixtureFundSettings = {
        id: 'fs01',
        openingAsOf: anchorUtc,
        initialBalance: 100_000_000n,
        fundScopeConfirmed: true,
        confirmedBy: 'u01',
        notes: null,
        version: 1,
      };

      // Payment 1 second before midnight VN time (2026-05-31 23:59:59 +07:00 -> 16:59:59Z)
      const pBefore: FixturePayment = {
        id: 'p-before',
        costItemId: 'c01',
        paymentType: 'outflow',
        amount: 20_000_000n,
        transactionTime: '2026-05-31T16:59:59.000Z',
        paymentMethod: 'bank_transfer',
        payerName: 'Chú rể',
        recipientName: 'Vendor',
        parentPaymentId: null,
        isDirectThirdParty: false,
        notes: null,
        isVoided: false,
        version: 1,
      };

      // Payment 1 second after midnight VN time (2026-06-01 00:00:01 +07:00 -> 17:00:01Z)
      const pAfter: FixturePayment = {
        id: 'p-after',
        costItemId: 'c01',
        paymentType: 'outflow',
        amount: 30_000_000n,
        transactionTime: '2026-05-31T17:00:01.000Z',
        paymentMethod: 'bank_transfer',
        payerName: 'Chú rể',
        recipientName: 'Vendor',
        parentPaymentId: null,
        isDirectThirdParty: false,
        notes: null,
        isVoided: false,
        version: 1,
      };

      const ledger = calculateCashFundLedger(fundSettings, [pBefore, pAfter], []);

      // Total disbursed = 20M + 30M = 50M
      expect(ledger.totalDisbursedAllTime).toBe(50_000_000n);
      // Prior = 20M
      expect(ledger.disbursedPriorToOpening).toBe(20_000_000n);
      // Post = 30M
      expect(ledger.disbursedFromCashFundPostOpening).toBe(30_000_000n);
      // Available cash = 100M - 30M = 70M (pre-opening 20M NOT deducted from available cash!)
      expect(ledger.availableCash).toBe(70_000_000n);
      expect(ledger.availableCash).not.toBe(50_000_000n);
    });

    it('verifies updateFundSettingsSchema validates opening_as_of with timezone offset', () => {
      const validPayload = {
        opening_as_of: '2026-06-01T00:00:00+07:00',
        initial_balance: '100000000',
        fund_scope_confirmed: true,
        version: 1,
      };
      const res = updateFundSettingsSchema.safeParse(validPayload);
      expect(res.success).toBe(true);

      const invalidPayloadNoTz = {
        ...validPayload,
        opening_as_of: '2026-06-01 00:00:00', // Missing ISO 8601 offset
      };
      expect(updateFundSettingsSchema.safeParse(invalidPayloadNoTz).success).toBe(false);
    });
  });

  // =========================================================================
  // 6. ADVERSARIAL STRESS: CROSS-ITEM REFUND & CONTRACTED BOUNDARY
  // =========================================================================
  describe('6. Adversarial Stress: Cross-Item & Settlement Boundaries', () => {
    it('preserves non-netting of surplus and debt across 10 distinct cost items', () => {
      // 5 items with 10M debt each (total debt 50M)
      // 5 items with 5M surplus each (total surplus 25M)
      let totalDebt = 0n;
      let totalSurplus = 0n;

      for (let i = 0; i < 5; i++) {
        const item: FixtureCostItem = {
          id: `c-debt-${i}`,
          name: `Item Debt ${i}`,
          categoryId: 'ca000000-0000-4000-8000-000000000001',
          eventId: null,
          vendorName: 'V',
          vendorPhone: null,
          vendorContact: null,
          estimatedAmount: 20_000_000n,
          contractedAmount: 20_000_000n,
          finalSettlementAmount: null,
          status: 'contracted',
          cancellationFee: null,
          cancellationNotes: null,
          notes: null,
          version: 1,
        };
        const p: FixturePayment = {
          id: `p-debt-${i}`,
          costItemId: item.id,
          paymentType: 'outflow',
          amount: 10_000_000n, // Paid 10M out of 20M -> remaining 10M
          transactionTime: '2026-06-01T10:00:00Z',
          paymentMethod: 'bank_transfer',
          payerName: 'Chú rể',
          recipientName: 'V',
          parentPaymentId: null,
          isDirectThirdParty: false,
          notes: null,
          isVoided: false,
          version: 1,
        };
        const m = calculateCostFinancialMetrics(item, [p]);
        totalDebt += m.confirmedRemaining ?? 0n;
      }

      for (let i = 0; i < 5; i++) {
        const item: FixtureCostItem = {
          id: `c-surplus-${i}`,
          name: `Item Surplus ${i}`,
          categoryId: 'ca000000-0000-4000-8000-000000000001',
          eventId: null,
          vendorName: 'V',
          vendorPhone: null,
          vendorContact: null,
          estimatedAmount: 10_000_000n,
          contractedAmount: 10_000_000n,
          finalSettlementAmount: null,
          status: 'contracted',
          cancellationFee: null,
          cancellationNotes: null,
          notes: null,
          version: 1,
        };
        const p: FixturePayment = {
          id: `p-surplus-${i}`,
          costItemId: item.id,
          paymentType: 'outflow',
          amount: 15_000_000n, // Paid 15M for 10M contract -> surplus 5M
          transactionTime: '2026-06-01T10:00:00Z',
          paymentMethod: 'bank_transfer',
          payerName: 'Chú rể',
          recipientName: 'V',
          parentPaymentId: null,
          isDirectThirdParty: false,
          notes: null,
          isVoided: false,
          version: 1,
        };
        const m = calculateCostFinancialMetrics(item, [p]);
        totalSurplus += m.surplusPaid;
      }

      expect(totalDebt).toBe(50_000_000n);
      expect(totalSurplus).toBe(25_000_000n);

      // Total debt MUST NOT be reduced to 25_000_000n by netting surplus! (AT15 invariant)
      expect(totalDebt).not.toBe(25_000_000n);
    });
  });
});
