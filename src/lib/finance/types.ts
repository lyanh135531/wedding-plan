export type CostStatus = 'draft' | 'contracted' | 'completed' | 'cancelling' | 'cancelled';
export type ScheduleStatus = 'estimated' | 'agreed' | 'cancelled';
export type PaymentType = 'outflow' | 'refund';
export type PaymentMethod = 'cash' | 'bank_transfer' | 'other';
export type FundingEntryType = 'cash_fund' | 'direct_vendor_payment' | 'pledged_unreceived';
export type IdempotencyStatus = 'processing' | 'completed' | 'failed';

export interface CostItemModel {
  id: string;
  name: string;
  categoryId: string;
  eventId?: string | null;
  vendorName?: string | null;
  vendorPhone?: string | null;
  vendorContact?: string | null;
  estimatedAmount?: bigint | null;
  contractedAmount?: bigint | null;
  finalSettlementAmount?: bigint | null;
  status: CostStatus;
  inChargeUserId?: string | null;
  cancellationFee?: bigint | null;
  cancellationNotes?: string | null;
  notes?: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentScheduleModel {
  id: string;
  costItemId: string;
  installmentNumber: number;
  title: string;
  amountDue: bigint;
  dueDate: string; // YYYY-MM-DD
  status: ScheduleStatus;
  notes?: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentAllocationModel {
  id: string;
  paymentId: string;
  scheduleId?: string | null; // null = advance payment / unallocated
  allocatedAmount: bigint;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentModel {
  id: string;
  costItemId: string;
  paymentType: PaymentType;
  amount: bigint;
  transactionTime: Date;
  paymentMethod: PaymentMethod;
  payerName?: string | null;
  recipientName?: string | null;
  parentPaymentId?: string | null;
  isDirectThirdParty: boolean;
  linkedFundingEntryId?: string | null;
  notes?: string | null;
  isVoided: boolean;
  voidedReason?: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface FundSettingsModel {
  id: string;
  openingAsOf?: Date | null;
  initialBalance: bigint;
  fundScopeConfirmed: boolean;
  confirmedBy?: string | null;
  notes?: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface FundingEntryModel {
  id: string;
  entryType: FundingEntryType;
  amount: bigint;
  contributorName?: string | null;
  contributionDate: Date;
  linkedCostItemId?: string | null;
  linkedPaymentId?: string | null;
  notes?: string | null;
  isVoided: boolean;
  voidedReason?: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Metric calculations for an individual cost item (AT11, AT15, AT48)
 */
export interface CostItemFinancialMetrics {
  totalOutflow: bigint;
  totalRefund: bigint;
  netPaid: bigint;
  priceBasis: bigint | null; // finalSettlementAmount ?? contractedAmount
  forecastAmount: bigint | null; // finalSettlementAmount ?? contractedAmount ?? estimatedAmount
  isPriceMissing: boolean; // all 3 prices are null
  confirmedRemaining: bigint | null; // priceBasis != null ? max(priceBasis - netPaid, 0) : null (AT11: undefined, NOT 0)
  projectedRemaining: bigint | null; // if priceBasis == null & estimatedAmount != null -> max(estimatedAmount - netPaid, 0)
  surplusPaid: bigint; // priceBasis != null ? max(netPaid - priceBasis, 0) : 0
  requiresScheduleReview: boolean; // true if price changed or refunds occurred
}

/**
 * Metric calculations for the overall wedding budget (AT15, AT17, AT53)
 */
export interface OverallBudgetFinancialMetrics {
  targetBudget: bigint | null;
  totalProjectedCost: bigint;
  hasMissingPrices: boolean;
  missingPricesCount: number;
  isProvisional: boolean; // true if missingPricesCount > 0
  provisionalNote?: string;
  totalNetPaid: bigint;
  totalConfirmedRemaining: bigint;
  totalProjectedRemaining: bigint;
  totalSurplusPaid: bigint; // Kept strictly separate, NEVER netted against debt (AT15)
  budgetVariance: bigint | null; // targetBudget - totalProjectedCost
  isOverBudget: boolean;
  settledItemsCount: number;
  totalItemsCount: number;
}

/**
 * Metric calculations for the cash fund ledger (AT37, AT38, AT45, FX03)
 */
export interface CashFundLedgerMetrics {
  isConfigured: boolean; // true only if fundScopeConfirmed == true (AT37)
  initialBalance: bigint | null;
  openingAsOf: Date | null;
  availableCash: bigint | null; // null if unconfigured (AT37)
  totalDisbursedAllTime: bigint;
  disbursedPriorToOpening: bigint;
  disbursedPostOpening: bigint;
  directThirdPartyDisbursements: bigint; // AT38: direct to vendor, 0 impact on cash
  postOpeningCashContributions: bigint;
}

/**
 * Installment status calculation for payment schedules (AT12, AT46)
 */
export interface InstallmentStatusMetrics {
  scheduleId: string;
  installmentNumber: number;
  title: string;
  amountDue: bigint;
  dueDate: string;
  allocatedAmount: bigint;
  remainingDue: bigint;
  isOverdue: boolean;
  status: ScheduleStatus;
}
