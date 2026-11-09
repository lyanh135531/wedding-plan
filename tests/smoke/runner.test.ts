import { describe, it, expect } from 'vitest';
import {
  formatVnd,
  parseVnd,
  calculateCostItemBalances,
  calculateAvailableCash,
  createMockUserSession,
  canViewFinancials,
  canViewGuestPrivateInfo,
  sanitizeGuestForRole,
  MockDbClient,
  withMockTransactionScopedContext,
  assertNoContextLeak,
  sanitizeCsvField,
  validateStorageKey,
} from '../helpers';

describe('Test Infrastructure Smoke Runner', () => {
  it('executes Vitest cleanly and validates pure numeric assertions', () => {
    expect(1 + 1).toBe(2);
    expect(true).toBe(true);
  });

  describe('BigInt Currency & Vietnamese Dong Math (AT11, AT12, AT15, AT38, AT45, AT48)', () => {
    it('formats and parses bigint VND without precision loss', () => {
      const amount = 15_000_000n;
      const formatted = formatVnd(amount);
      expect(formatted).toBe('15.000.000 ₫');
      expect(parseVnd(formatted)).toBe(15_000_000n);
      expect(parseVnd('0 ₫')).toBe(0n);
      expect(formatVnd(0n)).toBe('0 ₫');
      expect(formatVnd(-500_000n)).toBe('-500.000 ₫');
    });

    it('handles unfinalized cost item with advance deposit paid (AT11)', () => {
      const balances = calculateCostItemBalances({
        estimatedAmount: 20_000_000n,
        lockedPrice: null,
        finalSettlement: null,
        payments: [{ amount: 5_000_000n, type: 'payment', status: 'completed' }],
      });

      expect(balances.netPaid).toBe(5_000_000n);
      expect(balances.confirmedRemaining).toBeNull(); // UI renders "Chưa xác định"
      expect(balances.projectedRemaining).toBe(15_000_000n);
      expect(balances.surplusPaid).toBe(0n);
    });

    it('handles multi-installment schedule and partial refunds invariant math (AT12)', () => {
      const balances = calculateCostItemBalances({
        lockedPrice: 30_000_000n,
        finalSettlement: null,
        payments: [
          { amount: 10_000_000n, type: 'payment', status: 'completed' },
          { amount: 5_000_000n, type: 'payment', status: 'completed' },
          { amount: 2_000_000n, type: 'refund', status: 'completed' },
        ],
      });

      expect(balances.netPaid).toBe(13_000_000n);
      expect(balances.confirmedRemaining).toBe(17_000_000n);
      expect(balances.surplusPaid).toBe(0n);
    });

    it('separates surplus and debt without non-offsetting presentation (AT15)', () => {
      // Overpaid item (surplus 2m)
      const overpaid = calculateCostItemBalances({
        lockedPrice: 10_000_000n,
        payments: [{ amount: 12_000_000n, type: 'payment', status: 'completed' }],
      });
      // Underpaid item (debt 5m)
      const underpaid = calculateCostItemBalances({
        lockedPrice: 50_000_000n,
        payments: [{ amount: 45_000_000n, type: 'payment', status: 'completed' }],
      });

      expect(overpaid.surplusPaid).toBe(2_000_000n);
      expect(overpaid.confirmedRemaining).toBe(0n);

      expect(underpaid.surplusPaid).toBe(0n);
      expect(underpaid.confirmedRemaining).toBe(5_000_000n);

      // Invariant: Total surplus is 2m, total debt is 5m — must NEVER be shown as 3m net debt
      expect(overpaid.surplusPaid).not.toBe(underpaid.confirmedRemaining);
    });

    it('isolates direct vendor payment from couple cash balance (AT38)', () => {
      const openingDate = new Date('2028-01-01T00:00:00Z');
      const cash = calculateAvailableCash({
        initialBalance: 50_000_000n,
        openingAsOf: openingDate,
        entries: [
          {
            amount: 5_000_000n,
            type: 'direct_vendor_payment',
            date: new Date('2028-02-01T00:00:00Z'),
          },
          {
            amount: 10_000_000n,
            type: 'expense',
            date: new Date('2028-02-15T00:00:00Z'),
          },
        ],
      });

      // Direct vendor payment (paid by relative) does not alter cash fund; only 10m expense deducts
      expect(cash).toBe(40_000_000n);
    });

    it('does not deduct historical deposit prior to opening_as_of milestone (AT45)', () => {
      const openingDate = new Date('2028-02-01T00:00:00Z');
      const cash = calculateAvailableCash({
        initialBalance: 90_000_000n,
        openingAsOf: openingDate,
        entries: [
          {
            amount: 10_000_000n,
            type: 'expense',
            date: new Date('2028-01-15T00:00:00Z'), // Prior to opening milestone
          },
          {
            amount: 5_000_000n,
            type: 'expense',
            date: new Date('2028-02-10T00:00:00Z'), // After opening milestone
          },
        ],
      });

      // 10m historical deposit is NOT deducted again from 90m opening balance
      expect(cash).toBe(85_000_000n);
    });

    it('preserves valid zero-value final settlement without truthy bug (AT48)', () => {
      const balances = calculateCostItemBalances({
        estimatedAmount: 10_000_000n,
        lockedPrice: 8_000_000n,
        finalSettlement: 0n,
        payments: [],
      });

      // Strict !== null check ensures 0n is respected
      expect(balances.priceBasis).toBe(0n);
      expect(balances.confirmedRemaining).toBe(0n);
      expect(balances.surplusPaid).toBe(0n);
    });
  });

  describe('Auth Session & Role Isolation (AT02, AT03, AT04)', () => {
    it('creates owner session and grants full financial and guest access', () => {
      const session = createMockUserSession('owner');
      expect(session.role).toBe('owner');
      expect(canViewFinancials(session.role)).toBe(true);
      expect(canViewGuestPrivateInfo(session.role)).toBe(true);
    });

    it('creates family view-only session and restricts financial & private guest access (AT03)', () => {
      const session = createMockUserSession('family_view');
      expect(session.role).toBe('family_view');
      expect(canViewFinancials(session.role)).toBe(false);
      expect(canViewGuestPrivateInfo(session.role)).toBe(false);

      const guestData = {
        name: 'Nguyễn Văn Khách',
        phone: '0901234567',
        email: 'guest@example.com',
        address: '123 Đường Hoa Hồng, TP.HCM',
        privateNotes: 'Chú ý: Khách thích ngồi gần cô dâu',
      };

      const sanitized = sanitizeGuestForRole(guestData, session.role);
      expect(sanitized.name).toBe('Nguyễn Văn Khách');
      expect(sanitized.phone).toBeNull();
      expect(sanitized.email).toBeNull();
      expect(sanitized.address).toBeNull();
      expect(sanitized.privateNotes).toBeNull();
    });
  });

  describe('Database Context Isolation & Pool Sanitization (AT57)', () => {
    it('executes transaction context and erases residual state with DISCARD ALL', async () => {
      const client = new MockDbClient();
      let capturedUserId: string | null = null;
      let capturedRole: string | null = null;

      await withMockTransactionScopedContext(
        client,
        'user-uuid-1234',
        'owner',
        async (txClient) => {
          capturedUserId = txClient.state.currentUserId;
          capturedRole = txClient.state.currentRole;
          expect(txClient.state.inTransaction).toBe(true);
          return 'ok';
        }
      );

      expect(capturedUserId).toBe('user-uuid-1234');
      expect(capturedRole).toBe('owner');

      // Assert DISCARD ALL was executed and client state is completely clean
      assertNoContextLeak(client);
      expect(client.state.currentUserId).toBeNull();
      expect(client.state.currentRole).toBeNull();
      expect(client.state.inTransaction).toBe(false);
    });
  });

  describe('Security & Sanitization Helpers (AT29, AT41)', () => {
    it('escapes dangerous prefixes for formula injection prevention (AT29)', () => {
      expect(sanitizeCsvField('=CMD|calc')).toBe(`'=CMD|calc`);
      expect(sanitizeCsvField('+12345')).toBe(`'+12345`);
      expect(sanitizeCsvField('-500')).toBe(`'-500`);
      expect(sanitizeCsvField('@SUM(A1:A10)')).toBe(`'@SUM(A1:A10)`);
      expect(sanitizeCsvField('\tTabbed')).toBe(`'\tTabbed`);
      expect(sanitizeCsvField('\rCarriage')).toBe(`'\rCarriage`);
      expect(sanitizeCsvField('Nguyễn Văn An')).toBe('Nguyễn Văn An');
      expect(sanitizeCsvField('')).toBe('');
      expect(sanitizeCsvField(null)).toBe('');
    });

    it('rejects path traversal attempts in storage keys (AT41)', () => {
      expect(validateStorageKey('../../../etc/passwd')).toBe(false);
      expect(validateStorageKey('..%2F..%2Fdata%2Ffile.jpg')).toBe(false);
      expect(validateStorageKey('/absolute/path/file.jpg')).toBe(false);
      expect(validateStorageKey('\\windows\\path\\file.jpg')).toBe(false);
      expect(validateStorageKey('safe-uuid-1234.webp')).toBe(true);
      expect(validateStorageKey('2028/03/safe-uuid-1234.webp')).toBe(true);
    });
  });
});
