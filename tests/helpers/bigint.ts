/**
 * Bigint VND Currency & Mathematical Invariant Helpers for Testing.
 * Strictly adheres to Vietnamese Dong integer math without float precision loss.
 */

export interface PaymentEntry {
  amount: bigint;
  type: 'payment' | 'refund';
  status?: 'pending' | 'completed' | 'failed';
}

export interface CostItemBalances {
  netPaid: bigint;
  priceBasis: bigint | null;
  confirmedRemaining: bigint | null;
  projectedRemaining: bigint | null;
  surplusPaid: bigint;
}

export interface FundEntry {
  amount: bigint;
  type: 'initial' | 'contribution' | 'expense' | 'direct_vendor_payment' | 'gift';
  date: Date;
}

/**
 * Format a bigint VND amount into standard Vietnamese currency notation:
 * Example: 15000000n -> "15.000.000 ₫"
 */
export function formatVnd(amount: bigint): string {
  const isNegative = amount < 0n;
  const absVal = isNegative ? -amount : amount;
  const str = absVal.toString();
  const formatted = str.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${isNegative ? '-' : ''}${formatted} ₫`;
}

/**
 * Parse a numeric string or formatted VND string into bigint.
 * Rejects floating numbers or strings with decimal points.
 */
export function parseVnd(input: string): bigint {
  const cleaned = input.trim().replace(/[₫\s.]/g, '');
  if (!/^-?\d+$/.test(cleaned)) {
    throw new Error(`Invalid VND format, expected integer string: "${input}"`);
  }
  return BigInt(cleaned);
}

/**
 * Calculate net paid from payments and refunds:
 * Net Paid = Sum(Completed Payments) - Sum(Completed Refunds)
 */
export function calculateNetPaid(entries: PaymentEntry[]): bigint {
  let net = 0n;
  for (const entry of entries) {
    if (entry.status && entry.status !== 'completed') continue;
    if (entry.type === 'payment') {
      net += entry.amount;
    } else if (entry.type === 'refund') {
      net -= entry.amount;
    }
  }
  return net;
}

/**
 * Calculate balances for a cost item following strict invariant rules:
 * - If finalSettlement is present (including 0n), it takes precedence over lockedPrice.
 * - Confirmed remaining is only defined if a final settlement or locked price exists.
 * - Surplus paid is only positive if net paid exceeds the finalized price.
 * - Surplus and debt are NEVER offset across separate items (AT15).
 */
export function calculateCostItemBalances(params: {
  estimatedAmount?: bigint | null;
  lockedPrice?: bigint | null;
  finalSettlement?: bigint | null;
  payments: PaymentEntry[];
}): CostItemBalances {
  const netPaid = calculateNetPaid(params.payments);

  // Note: strict check !== null to avoid truthy bug with 0n settlement (AT48)
  const priceBasis =
    params.finalSettlement !== undefined && params.finalSettlement !== null
      ? params.finalSettlement
      : params.lockedPrice !== undefined && params.lockedPrice !== null
      ? params.lockedPrice
      : null;

  if (priceBasis === null) {
    const projectedRemaining =
      params.estimatedAmount !== undefined && params.estimatedAmount !== null
        ? (params.estimatedAmount - netPaid > 0n ? params.estimatedAmount - netPaid : 0n)
        : null;

    return {
      netPaid,
      priceBasis: null,
      confirmedRemaining: null,
      projectedRemaining,
      surplusPaid: 0n,
    };
  }

  const confirmedRemaining = priceBasis > netPaid ? priceBasis - netPaid : 0n;
  const surplusPaid = netPaid > priceBasis ? netPaid - priceBasis : 0n;

  return {
    netPaid,
    priceBasis,
    confirmedRemaining,
    projectedRemaining: confirmedRemaining,
    surplusPaid,
  };
}

/**
 * Calculate available cash fund taking opening_as_of anchor date into account:
 * - Historical expenses prior to openingAsOf are NOT deducted twice (AT45).
 * - Direct vendor payments by relatives (paid_by_other) do NOT alter the cash fund (AT38).
 */
export function calculateAvailableCash(params: {
  initialBalance: bigint;
  openingAsOf: Date;
  entries: FundEntry[];
}): bigint {
  let balance = params.initialBalance;

  for (const entry of params.entries) {
    // Entries strictly before the opening milestone do not affect post-opening cash
    if (entry.date.getTime() < params.openingAsOf.getTime()) {
      continue;
    }

    // Direct third-party vendor payments do not alter the couple's cash fund
    if (entry.type === 'direct_vendor_payment') {
      continue;
    }

    if (entry.type === 'contribution' || entry.type === 'gift') {
      balance += entry.amount;
    } else if (entry.type === 'expense') {
      balance -= entry.amount;
    }
  }

  return balance;
}
