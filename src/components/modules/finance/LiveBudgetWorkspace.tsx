'use client';

import * as React from 'react';
import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  CheckCircle2,
  Edit3,
  Layers,
  Plus,
  Search,
  Wallet,
  X,
} from 'lucide-react';
import { useEventScope } from '@/context/EventScopeContext';
import { allPages, api } from '@/lib/api/request';
import { formatVND } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { usePagination } from '@/components/common/usePagination';
import { useLoadState } from '@/components/common/useLoadState';
import { BudgetCategoryModal } from './BudgetCategoryModal';
import { BudgetCostModal } from './BudgetCostModal';
import { BudgetPaymentModal } from './BudgetPaymentModal';
import { BudgetScheduleModal } from './BudgetScheduleModal';
import {
  COST_STATUS_META,
  type BudgetCategory,
  type BudgetCost,
  type BudgetPayment,
  type CostStatusFilter,
  computeBudgetDashboardStats,
  computeCategoryBreakdown,
  computeCostRowMetrics,
  filterBudgetCosts,
  scopeCosts,
} from './budgetHelpers';

const STATUS_TABS: ReadonlyArray<{ value: CostStatusFilter; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'draft', label: 'Dự toán' },
  { value: 'contracted', label: 'Đã ký HĐ' },
  { value: 'completed', label: 'Hoàn tất' },
  { value: 'missing_price', label: 'Thiếu giá' },
  { value: 'cancelled', label: 'Đã hủy' },
];

export function LiveBudgetWorkspace() {
  const { currentScope, availableEvents } = useEventScope();
  const activeEvents = React.useMemo(
    () => availableEvents.filter((event) => !event.isCancelled),
    [availableEvents]
  );
  const activeEventIds = React.useMemo(
    () => activeEvents.map((event) => event.id),
    [activeEvents]
  );
  const eventMap = React.useMemo(
    () => new Map(availableEvents.map((event) => [event.id, event.name])),
    [availableEvents]
  );

  const [categories, setCategories] = React.useState<BudgetCategory[]>([]);
  const [costs, setCosts] = React.useState<BudgetCost[]>([]);
  const [payments, setPayments] = React.useState<BudgetPayment[]>([]);
  const [targetBudgetSetting, setTargetBudgetSetting] = React.useState<bigint | null>(null);
  const [contingencySetting, setContingencySetting] = React.useState<bigint | null>(null);

  const { loading, refreshing, beginLoad, markLoaded, finishLoad } = useLoadState();
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  // Filters
  const [search, setSearch] = React.useState('');
  const [categoryFilter, setCategoryFilter] = React.useState<string>('all');
  const [statusFilter, setStatusFilter] = React.useState<CostStatusFilter>('all');

  // Modals
  const [categoryModalTarget, setCategoryModalTarget] = React.useState<
    BudgetCategory | null | undefined
  >(undefined);
  const [costModalTarget, setCostModalTarget] = React.useState<
    BudgetCost | null | undefined
  >(undefined);
  const [paymentModalCost, setPaymentModalCost] = React.useState<BudgetCost | null>(null);
  const [scheduleModalCost, setScheduleModalCost] = React.useState<BudgetCost | null>(null);

  const generation = React.useRef(0);

  const load = React.useCallback(async () => {
    const requestId = ++generation.current;
    beginLoad('budget');
    setError(null);
    try {
      const [groupsRes, costList, paymentList, configRes] = await Promise.all([
        api<{ data: BudgetCategory[] }>('/api/v1/finance/categories'),
        allPages<BudgetCost>('/api/v1/finance/costs'),
        allPages<BudgetPayment>('/api/v1/finance/payments'),
        api<{ data: { budgetTarget?: string | null; contingencyBudget?: string | null } | null }>(
          '/api/v1/configuration'
        ).catch(() => ({ data: null })),
      ]);

      if (requestId !== generation.current) return;
      setCategories(groupsRes.data);
      setCosts(costList);
      setPayments(paymentList);
      setTargetBudgetSetting(
        configRes.data?.budgetTarget ? BigInt(configRes.data.budgetTarget) : null
      );
      setContingencySetting(
        configRes.data?.contingencyBudget ? BigInt(configRes.data.contingencyBudget) : null
      );
      markLoaded('budget');
    } catch (failure) {
      if (requestId === generation.current) {
        setError((failure as Error).message || 'Không thể tải dữ liệu ngân sách.');
        finishLoad();
      }
    }
  }, [beginLoad, markLoaded, finishLoad]);

  React.useEffect(() => {
    void load();
    return () => {
      generation.current++;
    };
  }, [load]);

  const categoriesMap = React.useMemo(
    () => new Map(categories.map((cat) => [cat.id, cat])),
    [categories]
  );

  const paymentsByCostId = React.useMemo(() => {
    const map = new Map<string, BudgetPayment[]>();
    for (const p of payments) {
      const list = map.get(p.costItemId) || [];
      list.push(p);
      map.set(p.costItemId, list);
    }
    return map;
  }, [payments]);

  const scopedCosts = React.useMemo(
    () => scopeCosts(costs, currentScope, activeEventIds),
    [costs, currentScope, activeEventIds]
  );

  const stats = React.useMemo(
    () =>
      computeBudgetDashboardStats(
        categories,
        scopedCosts,
        paymentsByCostId,
        targetBudgetSetting,
        contingencySetting
      ),
    [categories, scopedCosts, paymentsByCostId, targetBudgetSetting, contingencySetting]
  );

  const categoryBreakdown = React.useMemo(
    () => computeCategoryBreakdown(categories, scopedCosts, paymentsByCostId),
    [categories, scopedCosts, paymentsByCostId]
  );

  const filteredCosts = React.useMemo(
    () =>
      filterBudgetCosts(scopedCosts, categoriesMap, paymentsByCostId, {
        search,
        categoryId: categoryFilter,
        statusFilter,
      }),
    [scopedCosts, categoriesMap, paymentsByCostId, search, categoryFilter, statusFilter]
  );

  const pagination = usePagination(filteredCosts, {
    defaultPageSize: 15,
    resetKey: `budget:${currentScope}:${categoryFilter}:${statusFilter}:${search}`,
  });

  const handleSaved = async (msg: string) => {
    setNotice(msg);
    await load();
  };

  const hasActiveFilters = Boolean(
    search.trim() || categoryFilter !== 'all' || statusFilter !== 'all'
  );

  const clearFilters = () => {
    setSearch('');
    setCategoryFilter('all');
    setStatusFilter('all');
  };

  const scopeLabel =
    currentScope === 'common'
      ? 'Chi phí chung'
      : activeEventIds.includes(currentScope)
      ? eventMap.get(currentScope) || 'Buổi lễ'
      : 'Tất cả buổi';

  const defaultEventIdForNewCost =
    currentScope === 'common'
      ? null
      : activeEventIds.includes(currentScope)
      ? currentScope
      : activeEvents.find((e) => e.isRepresentative)?.id || activeEvents[0]?.id || null;

  const paymentModalMetrics = React.useMemo(
    () =>
      paymentModalCost
        ? computeCostRowMetrics(paymentModalCost, paymentsByCostId.get(paymentModalCost.id) || [])
        : null,
    [paymentModalCost, paymentsByCostId]
  );

  return (
    <section className="space-y-4" aria-busy={refreshing}>
      {/* Compact Luxury Overview & Progress Strip */}
      <div className="surface-card p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 min-w-0">
            <h2 className="font-serif text-xl sm:text-[22px] font-medium text-primary-luxury tracking-tight">
              Ngân Sách & Chi Tiêu
            </h2>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-page border border-border-subtle text-[11px] font-medium text-text-muted">
              {scopeLabel}
            </span>
            {!loading && !error && stats.missingPricesCount > 0 && (
              <button
                type="button"
                onClick={() => setStatusFilter('missing_price')}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-warning-bg border border-warning/25 text-[11px] font-semibold text-warning hover:opacity-90 transition-opacity"
              >
                <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                Tạm tính · {stats.missingPricesCount} khoản thiếu giá
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<Layers className="w-3.5 h-3.5" aria-hidden="true" />}
              disabled={loading}
              onClick={() => setCategoryModalTarget(null)}
              className="h-9 min-h-[36px] px-3 text-xs"
            >
              Thêm danh mục
            </Button>
            <Button
              size="sm"
              variant="primary"
              leftIcon={<Plus className="w-3.5 h-3.5" aria-hidden="true" />}
              disabled={loading || categories.length === 0}
              onClick={() => setCostModalTarget(null)}
              className="h-9 min-h-[36px] px-3.5 text-xs"
            >
              Thêm khoản chi
            </Button>
          </div>
        </div>

        {/* 4 Editorial KPI Tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="rounded-xl bg-[#FAF8F4] border border-[#ECE7DC] px-3.5 py-3">
            <span className="text-[11px] font-medium text-text-muted block">
              Ngân sách dự kiến
            </span>
            <span className="text-base sm:text-lg font-semibold text-primary-luxury tabular-nums block mt-0.5">
              {loading || error ? '—' : formatVND(stats.totalAllocated)}
            </span>
            <span className="text-[11px] text-text-muted block mt-0.5">
              {stats.targetBudget !== null && stats.targetBudget > 0n
                ? `Mục tiêu: ${formatVND(stats.targetBudget)}`
                : `${categories.length} danh mục phân bổ`}
            </span>
          </div>

          <div className="rounded-xl bg-[#FAF8F4] border border-[#ECE7DC] px-3.5 py-3">
            <span className="text-[11px] font-medium text-text-muted block">
              Tổng chi dự báo
            </span>
            <span className="text-base sm:text-lg font-semibold text-text-main tabular-nums block mt-0.5">
              {loading || error ? '—' : formatVND(stats.totalProjectedCost)}
            </span>
            <span className="text-[11px] text-text-muted block mt-0.5 tabular-nums">
              {scopedCosts.length} khoản chi ghi nhận
            </span>
          </div>

          <div
            data-testid="net-paid"
            className="rounded-xl bg-[#F3F8F5] border border-[#D4E3DA] px-3.5 py-3"
          >
            <span className="text-[11px] font-medium text-[#2E5A4C] block">
              Đã thanh toán
            </span>
            <span className="text-base sm:text-lg font-semibold text-[#173C33] tabular-nums block mt-0.5">
              {loading || error ? '—' : formatVND(stats.totalNetPaid)}
            </span>
            <span className="text-[11px] text-[#3B6B5C] block mt-0.5 tabular-nums">
              {stats.paidPercent}% tổng khung
            </span>
          </div>

          <div className="rounded-xl bg-[#FAF8F4] border border-[#ECE7DC] px-3.5 py-3">
            <span className="text-[11px] font-medium text-text-muted block">
              Còn cần chuẩn bị
            </span>
            <span className="text-base sm:text-lg font-semibold text-text-main tabular-nums block mt-0.5">
              {loading || error ? '—' : formatVND(stats.totalProjectedRemaining)}
            </span>
            <span className="text-[11px] text-text-muted block mt-0.5 tabular-nums">
              {stats.totalSurplusPaid > 0n
                ? `Trả dư: ${formatVND(stats.totalSurplusPaid)}`
                : 'Nghĩa vụ dự báo còn lại'}
            </span>
          </div>
        </div>

        {/* Hairline Multi-Segment Progress Bar */}
        {!loading && !error && stats.budgetCap > 0n && (
          <div className="space-y-1.5">
            <div className="relative h-2 w-full rounded-full bg-[#EFECE5] overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-[#D4BF8F] transition-all duration-300"
                style={{ width: `${stats.projectedPercent}%` }}
              />
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-[#173C33] transition-all duration-300"
                style={{ width: `${stats.paidPercent}%` }}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-muted tabular-nums">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#173C33]" aria-hidden="true" />
                  Đã thanh toán ({stats.paidPercent}%)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#D4BF8F]" aria-hidden="true" />
                  Đã cam kết ({stats.projectedPercent}%)
                </span>
              </div>
              {stats.overBudgetAmount > 0n ? (
                <span className="font-semibold text-danger">
                  Vượt dự kiến {formatVND(stats.overBudgetAmount)}
                </span>
              ) : stats.totalAllocated > 0n ? (
                <span className="font-medium text-primary">
                  Còn trống khung {formatVND(stats.totalAllocated - stats.totalProjectedCost)}
                </span>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* Interactive Compact Category Strip */}
      {!loading && !error && categories.length > 0 && (
        <div className="surface-card p-3.5 sm:p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
              Hạng mục ngân sách ({categories.length})
            </h3>
            {categoryFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setCategoryFilter('all')}
                className="text-xs font-medium text-primary hover:underline"
              >
                Xem tất cả hạng mục
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {categoryBreakdown.map((entry) => {
              const active = categoryFilter === entry.category.id;
              return (
                <div
                  key={entry.category.id}
                  className={`group rounded-xl border p-2.5 transition-all flex flex-col justify-between gap-2 ${
                    active
                      ? 'bg-[#173C33] text-[#F6F3E9] border-[#173C33] shadow-sm'
                      : 'bg-[#FAF8F4]/60 text-text-main border-border-subtle hover:border-primary/40 hover:bg-[#FAF8F4]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setCategoryFilter(active ? 'all' : entry.category.id)
                      }
                      className="text-left min-w-0 flex-1"
                    >
                      <span
                        className={`text-xs font-semibold leading-snug block truncate ${
                          active ? 'text-[#F6F3E9]' : 'text-primary-luxury'
                        }`}
                      >
                        {entry.category.name}
                      </span>
                      <span
                        className={`text-[11px] tabular-nums block mt-0.5 ${
                          active ? 'text-[#D4BF8F]' : 'text-text-muted'
                        }`}
                      >
                        {formatVND(entry.projected)}
                        {entry.allocated > 0n ? ` / ${formatVND(entry.allocated)}` : ''}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCategoryModalTarget(entry.category)}
                      aria-label={`Sửa danh mục ${entry.category.name}`}
                      title="Sửa danh mục"
                      className={`p-1 rounded transition-colors shrink-0 ${
                        active
                          ? 'text-[#D4BF8F] hover:bg-white/15'
                          : 'text-text-muted hover:text-text-main hover:bg-page'
                      }`}
                    >
                      <Edit3 className="w-3 h-3" aria-hidden="true" />
                    </button>
                  </div>

                  <div
                    className={`h-1 w-full rounded-full overflow-hidden ${
                      active ? 'bg-white/20' : 'bg-[#EAE6DC]'
                    }`}
                  >
                    <div
                      className={`h-full rounded-full transition-all ${
                        entry.isOverBudget
                          ? 'bg-danger'
                          : active
                          ? 'bg-[#D4BF8F]'
                          : 'bg-primary'
                      }`}
                      style={{ width: `${entry.percentUsed}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Feedback Notice */}
      {notice && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-card bg-success-bg/80 border border-success/20 text-xs sm:text-sm text-success"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            {notice}
          </span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Đóng thông báo"
            className="p-1 rounded hover:bg-success/10"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 px-4 py-3 rounded-card bg-danger-bg border border-danger/20 text-sm text-danger"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void load()}
            className="underline font-medium min-h-8 px-2"
          >
            Tải lại
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div role="status" className="surface-card divide-y divide-border-subtle animate-pulse">
          <span className="sr-only">Đang tải ngân sách…</span>
          {[1, 2, 3, 4].map((row) => (
            <div key={row} className="px-5 py-4 flex items-center justify-between gap-4">
              <div className="space-y-2 flex-1">
                <div className="h-4 w-48 bg-border-subtle rounded" />
                <div className="h-3 w-32 bg-border-subtle/70 rounded" />
              </div>
              <div className="h-6 w-28 bg-border-subtle rounded-full" />
            </div>
          ))}
        </div>
      )}

      {/* Cost Items Ledger */}
      {!loading && !error && (
        <div className="surface-card overflow-hidden">
          {/* Integrated Filter Bar */}
          <div className="px-4 py-3 border-b border-border-subtle bg-[#FAF8F4]/70 flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5">
            <div className="relative flex-1 min-w-0">
              <Search
                className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                aria-label="Tìm khoản chi"
                placeholder="Tìm theo tên khoản chi, nhà cung cấp, ghi chú..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-8 text-sm bg-surface border border-border-control rounded-control focus:outline-none focus:border-primary"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Xóa tìm kiếm khoản chi"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-main"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {STATUS_TABS.map((tab) => {
                const active = statusFilter === tab.value;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setStatusFilter(tab.value)}
                    className={`h-8 px-3 rounded-full text-xs font-medium border transition-colors ${
                      active
                        ? 'bg-[#173C33] text-[#F6F3E9] border-[#173C33]'
                        : 'bg-surface text-text-muted border-border-subtle hover:text-text-main hover:bg-page'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="h-8 px-2.5 text-xs font-medium text-danger hover:bg-danger-bg/60 rounded-control border border-danger/20 whitespace-nowrap transition-colors"
                >
                  Xóa lọc
                </button>
              )}
            </div>
          </div>

          {filteredCosts.length === 0 ? (
            <div className="p-6">
              <EmptyState
                type={hasActiveFilters ? 'no_filter_match' : 'no_data'}
                title={
                  hasActiveFilters
                    ? 'Không tìm thấy khoản chi phù hợp'
                    : 'Một kế hoạch rõ ràng cho từng khoản chi'
                }
                description={
                  hasActiveFilters
                    ? 'Thử đổi từ khóa hoặc xóa bộ lọc để xem toàn bộ ngân sách.'
                    : 'Bắt đầu thêm các danh mục và khoản chi để theo dõi chi tiêu cưới nhẹ nhàng.'
                }
                icon={<Wallet className="w-7 h-7 text-accent" strokeWidth={1.4} />}
                action={
                  hasActiveFilters
                    ? { label: 'Xóa bộ lọc', onClick: clearFilters }
                    : {
                        label: categories.length ? 'Tạo khoản chi đầu tiên' : 'Tạo danh mục đầu tiên',
                        onClick: () =>
                          categories.length
                            ? setCostModalTarget(null)
                            : setCategoryModalTarget(null),
                      }
                }
              />
            </div>
          ) : (
            <>
              {/* Desktop Editorial Header */}
              <div className="hidden md:grid md:grid-cols-[minmax(220px,1.7fr)_1fr_1.15fr_104px_auto] gap-3 px-4 py-2.5 border-b border-border-subtle bg-[#FAF8F4] text-[11px] font-semibold uppercase tracking-[0.05em] text-text-muted select-none">
                <span>Khoản chi & Nhà cung cấp</span>
                <span>Chi phí chốt / dự kiến</span>
                <span>Tiến độ thanh toán</span>
                <span>Trạng thái</span>
                <span className="text-right">Thao tác</span>
              </div>

              {/* Unified Responsive Row Articles */}
              <div className="divide-y divide-border-subtle/80">
                {pagination.pagedItems.map((cost) => {
                  const itemPayments = paymentsByCostId.get(cost.id) || [];
                  const metrics = computeCostRowMetrics(cost, itemPayments);
                  const categoryName =
                    cost.categoryName || categoriesMap.get(cost.categoryId)?.name || 'Hạng mục';
                  const badge = COST_STATUS_META[cost.status] || COST_STATUS_META.draft;
                  const eventName = cost.eventId ? eventMap.get(cost.eventId) : 'Chi phí chung';
                  const isCancelled = cost.status === 'cancelled';

                  return (
                    <article
                      key={cost.id}
                      className="px-4 py-3 grid grid-cols-1 md:grid-cols-[minmax(220px,1.7fr)_1fr_1.15fr_104px_auto] gap-2.5 md:gap-3 items-start md:items-center hover:bg-[#FAF8F4]/70 transition-colors"
                    >
                      {/* Col 1: Title & metadata */}
                      <div className="min-w-0">
                        <div className="flex items-start justify-between gap-2 md:block">
                          <h3 className="font-medium text-primary-luxury text-[14px] leading-snug break-words">
                            {cost.name}
                          </h3>
                          <div className="md:hidden shrink-0">
                            <StatusBadge variant={badge.variant} text={badge.label} size="sm" />
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-text-muted">
                          <span className="px-2 py-0.5 rounded-full bg-page border border-border-subtle text-text-main font-medium">
                            {categoryName}
                          </span>
                          {eventName && !activeEventIds.includes(currentScope) && (
                            <span>· {eventName}</span>
                          )}
                          {cost.vendorName && (
                            <span className="truncate max-w-[200px]">· {cost.vendorName}</span>
                          )}
                        </div>
                        {cost.notes && (
                          <p className="text-[11px] italic text-text-muted/85 mt-0.5 truncate max-w-md">
                            {cost.notes}
                          </p>
                        )}
                      </div>

                      {/* Col 2: Price Basis */}
                      <div className="flex items-center justify-between md:block text-sm tabular-nums">
                        <span className="text-xs text-text-muted md:hidden">Dự kiến / Chốt</span>
                        {metrics.isPriceMissing ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning-bg text-warning text-[11px] font-medium">
                            <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                            Thiếu giá
                          </span>
                        ) : (
                          <div className="text-right md:text-left">
                            <span className="font-semibold text-text-main block">
                              {formatVND(metrics.forecastAmount)}
                            </span>
                            <span className="text-[11px] text-text-muted block">
                              {metrics.priceSourceLabel}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Col 3: Paid & Remaining */}
                      <div className="space-y-1 text-xs tabular-nums">
                        <div className="flex items-center justify-between md:justify-start md:gap-2 flex-wrap">
                          <span className="text-[#2E7D32] font-semibold">
                            Đã chi: {formatVND(metrics.netPaid)}
                          </span>
                          {metrics.remaining !== null && metrics.remaining > 0n ? (
                            <span className="text-text-muted">
                              · Còn {formatVND(metrics.remaining)}
                            </span>
                          ) : !metrics.isPriceMissing && metrics.netPaid > 0n ? (
                            <span className="text-primary font-medium">· Đủ</span>
                          ) : null}
                        </div>
                        {!metrics.isPriceMissing &&
                          metrics.forecastAmount !== null &&
                          metrics.forecastAmount > 0n && (
                            <div className="h-1 w-full max-w-[160px] rounded-full bg-[#EAE6DC] overflow-hidden hidden md:block">
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: `${metrics.paidPercent}%` }}
                              />
                            </div>
                          )}
                      </div>

                      {/* Col 4: Status Badge (Desktop) */}
                      <div className="hidden md:block">
                        <StatusBadge variant={badge.variant} text={badge.label} size="sm" />
                      </div>

                      {/* Col 5: Actions */}
                      <div className="flex items-center justify-end gap-1.5 pt-1 md:pt-0">
                        {!isCancelled && (
                          <button
                            type="button"
                            onClick={() => setPaymentModalCost(cost)}
                            className="inline-flex items-center gap-1 h-8 px-2.5 rounded-control text-xs font-medium text-primary border border-primary/25 bg-primary/[0.04] hover:bg-primary hover:text-white transition-colors"
                          >
                            <Banknote className="w-3.5 h-3.5" aria-hidden="true" />
                            Chi tiền
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setScheduleModalCost(cost)}
                          title="Lịch thanh toán"
                          aria-label={`Lịch thanh toán ${cost.name}`}
                          className="inline-flex items-center gap-1 h-8 px-2 rounded-control text-xs font-medium text-text-muted hover:text-text-main hover:bg-page border border-border-subtle transition-colors"
                        >
                          <CalendarClock className="w-3.5 h-3.5" aria-hidden="true" />
                          <span className="hidden xl:inline">Đợt</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCostModalTarget(cost)}
                          className="inline-flex items-center gap-1 h-8 px-2.5 rounded-control text-xs font-medium text-text-muted hover:text-text-main hover:bg-page border border-border-subtle transition-colors"
                        >
                          Sửa khoản chi
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {!loading && !error && filteredCosts.length > 0 && (
        <Pagination
          currentPage={pagination.currentPage}
          pageSize={pagination.pageSize}
          totalItems={pagination.totalItems}
          onPageChange={pagination.setCurrentPage}
          onPageSizeChange={pagination.setPageSize}
          pageSizeOptions={[15, 30, 50, 100]}
          unitLabel="khoản chi"
        />
      )}

      {/* Modals */}
      <BudgetCategoryModal
        isOpen={categoryModalTarget !== undefined}
        onClose={() => setCategoryModalTarget(undefined)}
        category={categoryModalTarget ?? null}
        nextOrder={categories.length}
        onSaved={handleSaved}
      />

      <BudgetCostModal
        isOpen={costModalTarget !== undefined}
        onClose={() => setCostModalTarget(undefined)}
        cost={costModalTarget ?? null}
        categories={categories}
        events={activeEvents.map((e) => ({ id: e.id, name: e.name }))}
        defaultCategoryId={categoryFilter}
        defaultEventId={defaultEventIdForNewCost}
        hasPayments={
          Boolean(costModalTarget) &&
          (paymentsByCostId.get(costModalTarget!.id)?.length ?? 0) > 0
        }
        onSaved={handleSaved}
      />

      <BudgetPaymentModal
        isOpen={Boolean(paymentModalCost)}
        onClose={() => setPaymentModalCost(null)}
        cost={paymentModalCost}
        metrics={paymentModalMetrics}
        onSaved={handleSaved}
      />

      <BudgetScheduleModal
        isOpen={Boolean(scheduleModalCost)}
        onClose={() => setScheduleModalCost(null)}
        cost={scheduleModalCost}
        onSaved={handleSaved}
      />
    </section>
  );
}
