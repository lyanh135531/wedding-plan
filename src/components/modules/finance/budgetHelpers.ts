import { calculateCostItemMetrics } from '@/lib/finance/calculator';
import { removeVietnameseDiacritics } from '@/lib/utils';
import type { CostStatus } from '@/schemas/finance';

export interface BudgetCategory {
  id: string;
  name: string;
  allocatedAmount: string | null;
  updatedAt: string;
  defaultOrder?: number;
}

export interface BudgetCost {
  id: string;
  name: string;
  categoryId: string;
  categoryName?: string;
  eventId: string | null;
  vendorName?: string | null;
  vendorPhone?: string | null;
  vendorContact?: string | null;
  estimatedAmount: string | null;
  contractedAmount: string | null;
  finalSettlementAmount: string | null;
  status: CostStatus | string;
  cancellationFee?: string | null;
  cancellationNotes?: string | null;
  notes?: string | null;
  version: number;
}

export interface BudgetPayment {
  id: string;
  costItemId: string;
  costItemName?: string;
  paymentType: 'outflow' | 'refund';
  amount: string;
  transactionTime: string;
  paymentMethod: string;
  parentPaymentId?: string | null;
  isVoided: boolean;
  voidedReason?: string | null;
  version: number;
}

export type CostStatusFilter =
  | 'all'
  | 'draft'
  | 'contracted'
  | 'completed'
  | 'missing_price'
  | 'cancelled';

export const COST_STATUS_META: Record<
  string,
  { variant: 'warning' | 'info' | 'success' | 'danger' | 'neutral'; label: string }
> = {
  draft: { variant: 'warning', label: 'Dự toán' },
  contracted: { variant: 'info', label: 'Đã ký HĐ' },
  completed: { variant: 'success', label: 'Hoàn tất' },
  cancelling: { variant: 'warning', label: 'Đang hủy' },
  cancelled: { variant: 'danger', label: 'Đã hủy' },
};

export interface CostRowMetrics {
  netPaid: bigint;
  forecastAmount: bigint | null;
  remaining: bigint | null;
  surplusPaid: bigint;
  isPriceMissing: boolean;
  priceSourceLabel: string;
  paidPercent: number;
}

export interface CategoryBreakdown {
  category: BudgetCategory;
  allocated: bigint;
  projected: bigint;
  paid: bigint;
  remaining: bigint;
  itemCount: number;
  missingCount: number;
  percentUsed: number;
  isOverBudget: boolean;
}

export interface BudgetDashboardStats {
  totalAllocated: bigint;
  targetBudget: bigint | null;
  contingencyBudget: bigint | null;
  totalProjectedCost: bigint;
  totalNetPaid: bigint;
  totalProjectedRemaining: bigint;
  totalSurplusPaid: bigint;
  missingPricesCount: number;
  budgetCap: bigint;
  paidPercent: number;
  projectedPercent: number;
  overBudgetAmount: bigint;
}

/** Filters costs matching the global Header EventScope selector. */
export function scopeCosts(
  costs: BudgetCost[],
  currentScope: string,
  activeEventIds: string[]
): BudgetCost[] {
  if (currentScope === 'common') {
    return costs.filter((cost) => cost.eventId === null);
  }
  const matchesEvent = activeEventIds.includes(currentScope);
  if (!matchesEvent) {
    return costs;
  }
  return costs.filter((cost) => cost.eventId === currentScope);
}

/** Computes BigInt financial metrics for a single cost item. */
export function computeCostRowMetrics(
  cost: BudgetCost,
  paymentsForCost: BudgetPayment[]
): CostRowMetrics {
  const metrics = calculateCostItemMetrics(
    {
      estimatedAmount: cost.estimatedAmount === null ? null : BigInt(cost.estimatedAmount),
      contractedAmount: cost.contractedAmount === null ? null : BigInt(cost.contractedAmount),
      finalSettlementAmount:
        cost.finalSettlementAmount === null ? null : BigInt(cost.finalSettlementAmount),
      status: cost.status,
    },
    paymentsForCost.map((p) => ({
      paymentType: p.paymentType,
      amount: BigInt(p.amount),
      isVoided: p.isVoided,
    }))
  );

  let priceSourceLabel = 'Thiếu giá';
  if (cost.finalSettlementAmount !== null) {
    priceSourceLabel = cost.status === 'cancelled' ? 'Phí hủy' : 'Quyết toán';
  } else if (cost.contractedAmount !== null) {
    priceSourceLabel = 'Hợp đồng';
  } else if (cost.estimatedAmount !== null) {
    priceSourceLabel = 'Dự toán';
  }

  const paidPercent =
    metrics.forecastAmount !== null && metrics.forecastAmount > 0n
      ? Math.min(100, Number((metrics.netPaid * 100n) / metrics.forecastAmount))
      : 0;

  return {
    netPaid: metrics.netPaid,
    forecastAmount: metrics.forecastAmount,
    remaining: metrics.projectedRemaining,
    surplusPaid: metrics.surplusPaid,
    isPriceMissing: metrics.isPriceMissing,
    priceSourceLabel,
    paidPercent,
  };
}

/** Aggregates summary KPI counters across categories and scoped costs. */
export function computeBudgetDashboardStats(
  categories: BudgetCategory[],
  scopedCosts: BudgetCost[],
  paymentsByCostId: Map<string, BudgetPayment[]>,
  targetBudget: bigint | null = null,
  contingencyBudget: bigint | null = null
): BudgetDashboardStats {
  const totalAllocated = categories.reduce(
    (sum, cat) => sum + BigInt(cat.allocatedAmount || '0'),
    0n
  );

  let totalProjectedCost = 0n;
  let totalNetPaid = 0n;
  let totalProjectedRemaining = 0n;
  let totalSurplusPaid = 0n;
  let missingPricesCount = 0;

  for (const cost of scopedCosts) {
    const m = computeCostRowMetrics(cost, paymentsByCostId.get(cost.id) || []);
    if (m.forecastAmount !== null) totalProjectedCost += m.forecastAmount;
    else if (cost.status !== 'cancelled') missingPricesCount++;
    totalNetPaid += m.netPaid;
    if (m.remaining !== null) totalProjectedRemaining += m.remaining;
    totalSurplusPaid += m.surplusPaid;
  }

  const referenceCap =
    totalAllocated > 0n
      ? totalAllocated
      : targetBudget !== null && targetBudget > 0n
      ? targetBudget
      : 0n;

  const budgetCap = referenceCap > totalProjectedCost ? referenceCap : totalProjectedCost;
  const paidPercent =
    budgetCap > 0n ? Math.min(100, Number((totalNetPaid * 100n) / budgetCap)) : 0;
  const projectedPercent =
    budgetCap > 0n ? Math.min(100, Number((totalProjectedCost * 100n) / budgetCap)) : 0;
  const overBudgetAmount =
    referenceCap > 0n && totalProjectedCost > referenceCap
      ? totalProjectedCost - referenceCap
      : 0n;

  return {
    totalAllocated,
    targetBudget,
    contingencyBudget,
    totalProjectedCost,
    totalNetPaid,
    totalProjectedRemaining,
    totalSurplusPaid,
    missingPricesCount,
    budgetCap,
    paidPercent,
    projectedPercent,
    overBudgetAmount,
  };
}

/** Computes per-category allocation vs projected spend & paid breakdowns. */
export function computeCategoryBreakdown(
  categories: BudgetCategory[],
  scopedCosts: BudgetCost[],
  paymentsByCostId: Map<string, BudgetPayment[]>
): CategoryBreakdown[] {
  return categories.map((category) => {
    const items = scopedCosts.filter((c) => c.categoryId === category.id);
    const allocated = BigInt(category.allocatedAmount || '0');
    let projected = 0n;
    let paid = 0n;
    let remaining = 0n;
    let missingCount = 0;

    for (const item of items) {
      const m = computeCostRowMetrics(item, paymentsByCostId.get(item.id) || []);
      if (m.forecastAmount !== null) projected += m.forecastAmount;
      else if (item.status !== 'cancelled') missingCount++;
      paid += m.netPaid;
      if (m.remaining !== null) remaining += m.remaining;
    }

    const percentUsed =
      allocated > 0n ? Math.min(100, Number((projected * 100n) / allocated)) : projected > 0n ? 100 : 0;

    return {
      category,
      allocated,
      projected,
      paid,
      remaining,
      itemCount: items.length,
      missingCount,
      percentUsed,
      isOverBudget: allocated > 0n && projected > allocated,
    };
  });
}

/** Filters scoped costs by diacritic-insensitive search, category, and status. */
export function filterBudgetCosts(
  costs: BudgetCost[],
  categoriesMap: Map<string, BudgetCategory>,
  paymentsByCostId: Map<string, BudgetPayment[]>,
  filters: {
    search: string;
    categoryId: string;
    statusFilter: CostStatusFilter;
  }
): BudgetCost[] {
  const normQuery = removeVietnameseDiacritics(filters.search.trim());

  return costs.filter((cost) => {
    if (filters.categoryId !== 'all' && cost.categoryId !== filters.categoryId) {
      return false;
    }
    if (filters.statusFilter === 'missing_price') {
      const m = computeCostRowMetrics(cost, paymentsByCostId.get(cost.id) || []);
      if (!m.isPriceMissing || cost.status === 'cancelled') return false;
    } else if (filters.statusFilter === 'cancelled') {
      if (cost.status !== 'cancelled' && cost.status !== 'cancelling') return false;
    } else if (filters.statusFilter !== 'all' && cost.status !== filters.statusFilter) {
      return false;
    }

    if (normQuery) {
      const categoryName = cost.categoryName || categoriesMap.get(cost.categoryId)?.name || '';
      const haystack = removeVietnameseDiacritics(
        `${cost.name} ${categoryName} ${cost.vendorName || ''} ${cost.notes || ''}`
      );
      if (!haystack.includes(normQuery)) {
        return false;
      }
    }

    return true;
  });
}

/** Formats current Asia/Ho_Chi_Minh wall time for datetime-local inputs. */
export function localVietnamDateTime(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (name: string) => parts.find((part) => part.type === name)!.value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}
