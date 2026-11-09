/**
 * Fixture Hub & Domain Helper Functions
 * Provides re-exports, deep clone factories, and canonical calculation algorithms.
 */

export * from './fx01-family';
export * from './fx02-cancellation';
export * from './fx03-opening-fund';

import { FX01_FAMILY_GROUP, Fx01FamilyGroupFixture, FixtureAttendance, FixtureGuest } from './fx01-family';
import { FX02_CANCELLED_SERVICE, Fx02CancelledServiceFixture, FixturePayment, FixtureCostItem } from './fx02-cancellation';
import { FX03_OPENING_CUTOFF, Fx03OpeningFundFixture, FixtureFundSettings, FixtureFundingEntry } from './fx03-opening-fund';

/**
 * Calculates guest attendance, seat counts, and dietary meal breakdown
 * strictly following PLAN §8.5 & AT06/AT07 rules.
 */
export function calculateAttendanceMetrics(
  attendances: FixtureAttendance[],
  guestsMap: Record<string, FixtureGuest>
) {
  let totalInvited = attendances.length;
  let confirmedGuests = 0;
  let declinedGuests = 0;
  let uncertainGuests = 0;
  let confirmedSeats = 0;
  let mealsTotal = 0;
  let mealsRegularAdult = 0;
  let mealsVegetarian = 0;
  let mealsChild = 0;
  let mealsBaby = 0;

  for (const att of attendances) {
    const guest = guestsMap[att.guestId];
    if (att.rsvpStatus === 'accepted') {
      confirmedGuests++;
      if (att.needsSeat) {
        confirmedSeats++;
      }
      if (att.needsMeal) {
        mealsTotal++;
        if (att.mealDietaryTier === 'vegetarian') {
          mealsVegetarian++;
        } else if (att.mealDietaryTier === 'child_portion' || (guest && guest.ageTier === 'child')) {
          mealsChild++;
        } else if (guest && guest.ageTier === 'baby') {
          mealsBaby++;
        } else {
          mealsRegularAdult++;
        }
      }
    } else if (att.rsvpStatus === 'declined') {
      declinedGuests++;
    } else {
      uncertainGuests++;
    }
  }

  return {
    totalInvited,
    confirmedGuests,
    declinedGuests,
    uncertainGuests,
    confirmedSeats,
    mealsTotal,
    mealsRegularAdult,
    mealsVegetarian,
    mealsChild,
    mealsBaby,
  };
}

/**
 * Calculates cost item financial invariants strictly using BigInt arithmetic
 * following PLAN §9.2, §9.5 and AT11/AT12/AT14/AT47/AT48.
 */
export function calculateCostFinancialMetrics(
  costItem: FixtureCostItem,
  payments: FixturePayment[]
) {
  let totalOutflows = 0n;
  let totalRefunds = 0n;

  for (const p of payments) {
    if (p.isVoided) continue;
    if (p.paymentType === 'outflow') {
      totalOutflows += p.amount;
    } else if (p.paymentType === 'refund') {
      totalRefunds += p.amount;
    }
  }

  const netPaid = totalOutflows - totalRefunds;

  // Final obligation priority: finalSettlementAmount ?? contractedAmount ?? estimatedAmount
  const obligationAmount = costItem.finalSettlementAmount !== null
    ? costItem.finalSettlementAmount
    : costItem.contractedAmount !== null
    ? costItem.contractedAmount
    : null;

  const confirmedRemaining = obligationAmount !== null
    ? (obligationAmount > netPaid ? obligationAmount - netPaid : 0n)
    : null;

  const surplusPaid = obligationAmount !== null
    ? (netPaid > obligationAmount ? netPaid - obligationAmount : 0n)
    : 0n;

  return {
    totalOutflows,
    totalRefunds,
    netPaid,
    obligationAmount,
    confirmedRemaining,
    surplusPaid,
  };
}

/**
 * Calculates available cash balance with cutoff anchor logic
 * following PLAN §9.2, RV01, AT37, AT38, and AT45.
 */
export function calculateCashFundLedger(
  fundSettings: FixtureFundSettings | null,
  payments: FixturePayment[],
  fundingEntries: FixtureFundingEntry[]
) {
  if (!fundSettings || !fundSettings.fundScopeConfirmed) {
    return {
      isConfigured: false,
      availableCash: null,
      totalDisbursedAllTime: 0n,
    };
  }

  const openingEpoch = new Date(fundSettings.openingAsOf).getTime();

  let totalDisbursedAllTime = 0n;
  let disbursedPriorToOpening = 0n;
  let disbursedAfterOpening = 0n;
  let disbursedFromCashFundPostOpening = 0n;
  let directThirdPartyDisbursements = 0n;

  for (const p of payments) {
    if (p.isVoided) continue;
    const txEpoch = new Date(p.transactionTime).getTime();

    if (p.paymentType === 'outflow') {
      totalDisbursedAllTime += p.amount;

      if (txEpoch < openingEpoch) {
        disbursedPriorToOpening += p.amount;
      } else {
        disbursedAfterOpening += p.amount;
        if (p.isDirectThirdParty) {
          directThirdPartyDisbursements += p.amount;
        } else {
          disbursedFromCashFundPostOpening += p.amount;
        }
      }
    } else if (p.paymentType === 'refund') {
      totalDisbursedAllTime -= p.amount;
      if (txEpoch >= openingEpoch) {
        disbursedAfterOpening -= p.amount;
        disbursedFromCashFundPostOpening -= p.amount;
      }
    }
  }

  let cashContributionsPostOpening = 0n;
  for (const fe of fundingEntries) {
    if (fe.isVoided) continue;
    const feEpoch = new Date(fe.contributionDate).getTime();
    if (feEpoch >= openingEpoch && fe.entryType === 'cash_fund') {
      cashContributionsPostOpening += fe.amount;
    }
  }

  const availableCash =
    fundSettings.initialBalance +
    cashContributionsPostOpening -
    disbursedFromCashFundPostOpening;

  return {
    isConfigured: true,
    availableCash,
    initialBalance: fundSettings.initialBalance,
    totalDisbursedAllTime,
    disbursedPriorToOpening,
    disbursedAfterOpening,
    disbursedFromCashFundPostOpening,
    directThirdPartyDisbursements,
    cashContributionsPostOpening,
  };
}

/**
 * Deep-clone helper to provide pristine fixture copies for test isolation.
 */
export function getFx01FamilyGroupClone(): Fx01FamilyGroupFixture {
  return JSON.parse(JSON.stringify(FX01_FAMILY_GROUP));
}

export function getFx02CancelledServiceClone(): Fx02CancelledServiceFixture {
  return {
    ...FX02_CANCELLED_SERVICE,
    costItem: { ...FX02_CANCELLED_SERVICE.costItem },
    schedules: FX02_CANCELLED_SERVICE.schedules.map((s) => ({ ...s })),
    initialPayment: { ...FX02_CANCELLED_SERVICE.initialPayment },
    initialAllocation: { ...FX02_CANCELLED_SERVICE.initialAllocation },
    refundInstallment1: { ...FX02_CANCELLED_SERVICE.refundInstallment1 },
    refundInstallment2: { ...FX02_CANCELLED_SERVICE.refundInstallment2 },
    expectedCalculations: {
      ...FX02_CANCELLED_SERVICE.expectedCalculations,
      dto: { ...FX02_CANCELLED_SERVICE.expectedCalculations.dto },
    },
  };
}

export function getFx03OpeningCutoffClone(): Fx03OpeningFundFixture {
  return {
    ...FX03_OPENING_CUTOFF,
    fundSettings: { ...FX03_OPENING_CUTOFF.fundSettings },
    historicalPayments: FX03_OPENING_CUTOFF.historicalPayments.map((p) => ({ ...p })),
    postOpeningPayments: FX03_OPENING_CUTOFF.postOpeningPayments.map((p) => ({ ...p })),
    fundingEntries: FX03_OPENING_CUTOFF.fundingEntries.map((fe) => ({ ...fe })),
    expectedCalculations: {
      ...FX03_OPENING_CUTOFF.expectedCalculations,
      dto: { ...FX03_OPENING_CUTOFF.expectedCalculations.dto },
    },
  };
}
