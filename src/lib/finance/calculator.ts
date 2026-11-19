import { endOfWeddingDay } from '@/lib/dates';
import {
  CostItemModel,
  PaymentModel,
  FundSettingsModel,
  FundingEntryModel,
  PaymentScheduleModel,
  PaymentAllocationModel,
  CostItemFinancialMetrics,
  OverallBudgetFinancialMetrics,
  CashFundLedgerMetrics,
  InstallmentStatusMetrics,
} from './types';

/**
 * Calculates financial metrics for an individual cost item.
 * Strictly adheres to BigInt VND integer arithmetic.
 *
 * Invariants:
 * - AT11: If no price is locked (no finalSettlement, no contractedAmount), confirmedRemaining is NULL (never false 0n).
 * - AT15: If netPaid > priceBasis, surplusPaid is recorded separately.
 * - AT47: In cancellation, finalSettlementAmount is the final penalty liability.
 * - AT48: finalSettlementAmount = 0n is a valid settlement (distinguished via !== null check, never falsy check).
 */
export function calculateCostItemMetrics(
  item: {
    estimatedAmount?: bigint | null;
    contractedAmount?: bigint | null;
    finalSettlementAmount?: bigint | null;
    status?: string | null;
  },
  payments: Array<{
    paymentType: 'outflow' | 'refund';
    amount: bigint;
    isVoided?: boolean | null;
  }>
): CostItemFinancialMetrics {
  let totalOutflow = 0n;
  let totalRefund = 0n;

  for (const p of payments) {
    if (p.isVoided) continue;
    if (p.paymentType === 'outflow') {
      totalOutflow += p.amount;
    } else if (p.paymentType === 'refund') {
      totalRefund += p.amount;
    }
  }

  const netPaid = totalOutflow - totalRefund;

  // Strict null checks to preserve 0n as a valid settlement (AT48)
  const priceBasis =
    item.finalSettlementAmount !== undefined && item.finalSettlementAmount !== null
      ? item.finalSettlementAmount
      : item.contractedAmount !== undefined && item.contractedAmount !== null
      ? item.contractedAmount
      : null;

  const forecastAmount =
    priceBasis !== null
      ? priceBasis
      : item.estimatedAmount !== undefined && item.estimatedAmount !== null
      ? item.estimatedAmount
      : null;

  const isPriceMissing = forecastAmount === null;

  // AT11: If priceBasis is not set, confirmedRemaining is strictly null (undefined obligation), not 0n
  const confirmedRemaining =
    priceBasis !== null
      ? priceBasis > netPaid
        ? priceBasis - netPaid
        : 0n
      : null;

  // Projected remaining falls back to estimatedAmount if priceBasis is not yet agreed
  const projectedRemaining =
    priceBasis !== null
      ? confirmedRemaining
      : item.estimatedAmount !== undefined && item.estimatedAmount !== null
      ? item.estimatedAmount > netPaid
        ? item.estimatedAmount - netPaid
        : 0n
      : null;

  // Surplus is only positive if net paid exceeds the confirmed obligation
  const surplusPaid =
    priceBasis !== null && netPaid > priceBasis
      ? netPaid - priceBasis
      : 0n;

  const requiresScheduleReview =
    item.status === 'cancelling' ||
    item.status === 'cancelled' ||
    (priceBasis !== null && netPaid > priceBasis);

  return {
    totalOutflow,
    totalRefund,
    netPaid,
    priceBasis,
    forecastAmount,
    isPriceMissing,
    confirmedRemaining,
    projectedRemaining,
    surplusPaid,
    requiresScheduleReview,
  };
}

/**
 * Calculates the overall wedding budget and financial health metrics.
 *
 * Invariants:
 * - AT15: Total surplus is reported strictly separately from total confirmed remaining debt (NEVER netted together).
 * - AT17, AT53: If any cost item is missing a price, isProvisional = true and labeled "Tạm tính — còn N khoản thiếu giá".
 * - AT48: 0n settlement items are considered settled, not missing prices.
 */
export function calculateOverallBudgetSummary(
  targetBudget: bigint | null,
  itemsWithMetrics: Array<{
    item: {
      status?: string | null;
      finalSettlementAmount?: bigint | null;
    };
    metrics: CostItemFinancialMetrics;
  }>
): OverallBudgetFinancialMetrics {
  let totalProjectedCost = 0n;
  let missingPricesCount = 0;
  let totalNetPaid = 0n;
  let totalConfirmedRemaining = 0n;
  let totalProjectedRemaining = 0n;
  let totalSurplusPaid = 0n;
  let settledItemsCount = 0;

  for (const { item, metrics } of itemsWithMetrics) {
    if (metrics.forecastAmount !== null) {
      totalProjectedCost += metrics.forecastAmount;
    }

    if (metrics.isPriceMissing) {
      missingPricesCount++;
    }

    totalNetPaid += metrics.netPaid;

    if (metrics.confirmedRemaining !== null) {
      totalConfirmedRemaining += metrics.confirmedRemaining;
    }

    if (metrics.projectedRemaining !== null) {
      totalProjectedRemaining += metrics.projectedRemaining;
    }

    // AT15: Surplus is accumulated independently
    totalSurplusPaid += metrics.surplusPaid;

    const isSettled =
      item.status === 'completed' ||
      (item.finalSettlementAmount !== undefined && item.finalSettlementAmount !== null);
    if (isSettled) {
      settledItemsCount++;
    }
  }

  const hasMissingPrices = missingPricesCount > 0;
  const isProvisional = hasMissingPrices;
  const provisionalNote = isProvisional
    ? `Tạm tính — còn ${missingPricesCount} khoản thiếu giá`
    : undefined;

  const budgetVariance =
    targetBudget !== null ? targetBudget - totalProjectedCost : null;
  const isOverBudget =
    targetBudget !== null ? totalProjectedCost > targetBudget : false;

  return {
    targetBudget,
    totalProjectedCost,
    hasMissingPrices,
    missingPricesCount,
    isProvisional,
    provisionalNote,
    totalNetPaid,
    totalConfirmedRemaining,
    totalProjectedRemaining,
    totalSurplusPaid,
    budgetVariance,
    isOverBudget,
    settledItemsCount,
    totalItemsCount: itemsWithMetrics.length,
  };
}

/**
 * Calculates available cash balance with cutoff anchor logic.
 * Follows PLAN §9.2, RV01, AT37, AT38, and AT45.
 *
 * Invariants:
 * - AT37: If fundScopeConfirmed is false or settings missing, isConfigured is false and availableCash is null.
 * - AT38: Direct third party payments ("Người khác góp bằng cách trả hộ") do NOT deduct or add to cash fund.
 * - AT45: Historical payments before openingAsOf are included in all-time reports, but NOT deducted from available cash.
 */
export function calculateCashLedger(
  settings: {
    openingAsOf?: Date | string | null;
    initialBalance: bigint;
    fundScopeConfirmed: boolean;
  } | null,
  payments: Array<{
    paymentType: 'outflow' | 'refund';
    amount: bigint;
    transactionTime: Date | string;
    isDirectThirdParty?: boolean | null;
    isVoided?: boolean | null;
  }>,
  fundingEntries: Array<{
    entryType: 'cash_fund' | 'direct_vendor_payment' | 'pledged_unreceived';
    amount: bigint;
    contributionDate: Date | string;
    isVoided?: boolean | null;
  }>
): CashFundLedgerMetrics {
  if (!settings || !settings.fundScopeConfirmed) {
    return {
      isConfigured: false,
      initialBalance: null,
      openingAsOf: null,
      availableCash: null,
      totalDisbursedAllTime: 0n,
      disbursedPriorToOpening: 0n,
      disbursedPostOpening: 0n,
      directThirdPartyDisbursements: 0n,
      postOpeningCashContributions: 0n,
    };
  }

  const openingDate = settings.openingAsOf ? new Date(settings.openingAsOf) : null;
  const openingEpoch = openingDate ? openingDate.getTime() : 0;

  let totalDisbursedAllTime = 0n;
  let disbursedPriorToOpening = 0n;
  let disbursedPostOpening = 0n;
  let directThirdPartyDisbursements = 0n;
  let disbursedFromCashFund = 0n;

  for (const p of payments) {
    if (p.isVoided) continue;
    const txEpoch = new Date(p.transactionTime).getTime();

    if (p.paymentType === 'outflow') {
      totalDisbursedAllTime += p.amount;

      if (txEpoch < openingEpoch) {
        // AT45: Historical disbursement before opening cutoff does not reduce availableCash
        disbursedPriorToOpening += p.amount;
      } else {
        disbursedPostOpening += p.amount;
        if (p.isDirectThirdParty) {
          // AT38: Relative paid directly to vendor; does not touch wedding cash fund
          directThirdPartyDisbursements += p.amount;
        } else {
          disbursedFromCashFund += p.amount;
        }
      }
    } else if (p.paymentType === 'refund') {
      totalDisbursedAllTime -= p.amount;
      if (txEpoch >= openingEpoch) {
        disbursedPostOpening -= p.amount;
        if (!p.isDirectThirdParty) {
          disbursedFromCashFund -= p.amount;
        }
      }
    }
  }

  let postOpeningCashContributions = 0n;
  for (const fe of fundingEntries) {
    if (fe.isVoided) continue;
    const feEpoch = new Date(fe.contributionDate).getTime();

    // Only cash contributions received post-opening add to cash fund
    if (feEpoch >= openingEpoch && fe.entryType === 'cash_fund') {
      postOpeningCashContributions += fe.amount;
    }
  }

  const availableCash =
    settings.initialBalance +
    postOpeningCashContributions -
    disbursedFromCashFund;

  return {
    isConfigured: true,
    initialBalance: settings.initialBalance,
    openingAsOf: openingDate,
    availableCash,
    totalDisbursedAllTime,
    disbursedPriorToOpening,
    disbursedPostOpening,
    directThirdPartyDisbursements,
    postOpeningCashContributions,
  };
}

/**
 * Calculates installment status for a payment schedule installment.
 * Adheres to AT12 and AT46.
 */
export function calculateInstallmentStatus(
  schedule: {
    id: string;
    installmentNumber: number;
    title: string;
    amountDue: bigint;
    dueDate: string;
    status: 'estimated' | 'agreed' | 'cancelled';
  },
  allocations: Array<{
    scheduleId?: string | null;
    allocatedAmount: bigint;
    isPaymentVoided?: boolean;
  }>,
  currentDate = new Date()
): InstallmentStatusMetrics {
  let allocatedAmount = 0n;

  for (const a of allocations) {
    if (a.isPaymentVoided) continue;
    if (a.scheduleId === schedule.id) {
      allocatedAmount += a.allocatedAmount;
    }
  }

  const remainingDue =
    schedule.amountDue > allocatedAmount ? schedule.amountDue - allocatedAmount : 0n;

  // Due date comparison: string YYYY-MM-DD
  const dueEpoch = endOfWeddingDay(schedule.dueDate).getTime();
  const nowEpoch = currentDate.getTime();
  const isOverdue = remainingDue > 0n && nowEpoch > dueEpoch && schedule.status !== 'cancelled';

  return {
    scheduleId: schedule.id,
    installmentNumber: schedule.installmentNumber,
    title: schedule.title,
    amountDue: schedule.amountDue,
    dueDate: schedule.dueDate,
    allocatedAmount,
    remainingDue,
    isOverdue,
    status: schedule.status,
  };
}

/**
 * Validates and calculates the maximum allowable refund for a given parent outflow payment.
 * Adheres to AT12 and AT14.
 */
export function calculateRefundCeiling(
  parentPayment: {
    id: string;
    paymentType: 'outflow' | 'refund';
    amount: bigint;
    isVoided?: boolean | null;
  },
  existingRefunds: Array<{
    parentPaymentId?: string | null;
    amount: bigint;
    isVoided?: boolean | null;
  }>
): {
  maxRefundable: bigint;
  totalRefundedSoFar: bigint;
  isValid: boolean;
  errorMessage?: string;
} {
  if (parentPayment.paymentType !== 'outflow') {
    return {
      maxRefundable: 0n,
      totalRefundedSoFar: 0n,
      isValid: false,
      errorMessage: 'Giao dịch gốc để hoàn tiền phải là giao dịch chi ra (outflow)',
    };
  }

  if (parentPayment.isVoided) {
    return {
      maxRefundable: 0n,
      totalRefundedSoFar: 0n,
      isValid: false,
      errorMessage: 'Không thể hoàn tiền cho giao dịch đã bị hủy ghi nhận (voided)',
    };
  }

  let totalRefundedSoFar = 0n;
  for (const r of existingRefunds) {
    if (r.isVoided) continue;
    if (r.parentPaymentId === parentPayment.id) {
      totalRefundedSoFar += r.amount;
    }
  }

  const maxRefundable =
    parentPayment.amount > totalRefundedSoFar ? parentPayment.amount - totalRefundedSoFar : 0n;

  return {
    maxRefundable,
    totalRefundedSoFar,
    isValid: true,
  };
}
