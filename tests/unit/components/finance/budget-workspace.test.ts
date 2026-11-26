import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RoleProvider } from '@/context/RoleContext';
import { EventScopeProvider } from '@/context/EventScopeContext';
import {
  type BudgetCategory,
  type BudgetCost,
  type BudgetPayment,
  computeBudgetDashboardStats,
  computeCategoryBreakdown,
  computeCostRowMetrics,
  filterBudgetCosts,
  scopeCosts,
} from '@/components/modules/finance/budgetHelpers';
import { BudgetCategoryModal } from '@/components/modules/finance/BudgetCategoryModal';
import { BudgetCostModal } from '@/components/modules/finance/BudgetCostModal';
import { BudgetPaymentModal } from '@/components/modules/finance/BudgetPaymentModal';
import { BudgetScheduleModal } from '@/components/modules/finance/BudgetScheduleModal';
import { LiveBudgetWorkspace } from '@/components/modules/finance/LiveBudgetWorkspace';

const EVENT_1 = '11111111-1111-4111-8111-111111111111';
const EVENT_2 = '22222222-2222-4222-8222-222222222222';
const CAT_VENUE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const CAT_ATTIRE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';

const CATEGORIES: BudgetCategory[] = [
  {
    id: CAT_VENUE,
    name: 'Nhà hàng & Tiệc',
    allocatedAmount: '150000000',
    updatedAt: '2026-11-26T00:00:00.000Z',
    defaultOrder: 0,
  },
  {
    id: CAT_ATTIRE,
    name: 'Trang phục cưới',
    allocatedAmount: '25000000',
    updatedAt: '2026-11-26T00:00:00.000Z',
    defaultOrder: 1,
  },
];

const COSTS: BudgetCost[] = [
  {
    id: 'c1',
    name: 'Đặt cọc sảnh tiệc',
    categoryId: CAT_VENUE,
    eventId: EVENT_1,
    vendorName: 'White Palace',
    estimatedAmount: '140000000',
    contractedAmount: '150000000',
    finalSettlementAmount: null,
    status: 'contracted',
    notes: 'Bao gồm âm thanh ánh sáng',
    version: 1,
  },
  {
    id: 'c2',
    name: 'Thuê váy cưới',
    categoryId: CAT_ATTIRE,
    eventId: null,
    vendorName: 'Linh Bridal',
    estimatedAmount: '30000000',
    contractedAmount: null,
    finalSettlementAmount: null,
    status: 'draft',
    version: 1,
  },
  {
    id: 'c3',
    name: 'Hoa cầm tay cô dâu',
    categoryId: CAT_ATTIRE,
    eventId: EVENT_2,
    vendorName: null,
    estimatedAmount: null,
    contractedAmount: null,
    finalSettlementAmount: null,
    status: 'draft',
    version: 1,
  },
];

const PAYMENTS: BudgetPayment[] = [
  {
    id: 'p1',
    costItemId: 'c1',
    paymentType: 'outflow',
    amount: '50000000',
    transactionTime: '2026-11-10T10:00:00.000Z',
    paymentMethod: 'bank_transfer',
    isVoided: false,
    version: 1,
  },
  {
    id: 'p2',
    costItemId: 'c1',
    paymentType: 'refund',
    amount: '10000000',
    transactionTime: '2026-11-12T10:00:00.000Z',
    paymentMethod: 'bank_transfer',
    isVoided: false,
    version: 1,
  },
  {
    id: 'p3',
    costItemId: 'c1',
    paymentType: 'outflow',
    amount: '20000000',
    transactionTime: '2026-11-13T10:00:00.000Z',
    paymentMethod: 'bank_transfer',
    isVoided: true,
    version: 1,
  },
];

function groupPayments(list: BudgetPayment[]) {
  const map = new Map<string, BudgetPayment[]>();
  for (const p of list) {
    const arr = map.get(p.costItemId) || [];
    arr.push(p);
    map.set(p.costItemId, arr);
  }
  return map;
}

describe('Budget Workspace Helpers & Luxury UI', () => {
  it('scopes costs cleanly across all, common, and individual ceremonies', () => {
    expect(scopeCosts(COSTS, 'all', [EVENT_1, EVENT_2]).map((c) => c.id)).toEqual(['c1', 'c2', 'c3']);
    expect(scopeCosts(COSTS, 'common', [EVENT_1, EVENT_2]).map((c) => c.id)).toEqual(['c2']);
    expect(scopeCosts(COSTS, EVENT_1, [EVENT_1, EVENT_2]).map((c) => c.id)).toEqual(['c1']);
  });

  it('computes net paid excluding voided transactions, missing price detection, and over-budget breakdown', () => {
    const payMap = groupPayments(PAYMENTS);

    const m1 = computeCostRowMetrics(COSTS[0], payMap.get('c1') || []);
    expect(m1.netPaid).toBe(40000000n);
    expect(m1.forecastAmount).toBe(150000000n);
    expect(m1.remaining).toBe(110000000n);
    expect(m1.isPriceMissing).toBe(false);
    expect(m1.priceSourceLabel).toBe('Hợp đồng');

    const m3 = computeCostRowMetrics(COSTS[2], []);
    expect(m3.isPriceMissing).toBe(true);
    expect(m3.priceSourceLabel).toBe('Thiếu giá');

    const stats = computeBudgetDashboardStats(CATEGORIES, COSTS, payMap, 200000000n);
    expect(stats.totalAllocated).toBe(175000000n);
    expect(stats.totalProjectedCost).toBe(180000000n);
    expect(stats.totalNetPaid).toBe(40000000n);
    expect(stats.totalProjectedRemaining).toBe(140000000n);
    expect(stats.missingPricesCount).toBe(1);
    expect(stats.overBudgetAmount).toBe(5000000n);

    const breakdown = computeCategoryBreakdown(CATEGORIES, COSTS, payMap);
    expect(breakdown[0].isOverBudget).toBe(false);
    expect(breakdown[1].isOverBudget).toBe(true); // 30M projected > 25M allocated
  });

  it('filters costs diacritic-insensitively by search, category, and missing_price status', () => {
    const payMap = groupPayments(PAYMENTS);
    const catMap = new Map(CATEGORIES.map((c) => [c.id, c]));

    expect(
      filterBudgetCosts(COSTS, catMap, payMap, {
        search: 'am thanh',
        categoryId: 'all',
        statusFilter: 'all',
      }).map((c) => c.id)
    ).toEqual(['c1']);

    expect(
      filterBudgetCosts(COSTS, catMap, payMap, {
        search: '',
        categoryId: CAT_ATTIRE,
        statusFilter: 'missing_price',
      }).map((c) => c.id)
    ).toEqual(['c3']);
  });

  it('renders Budget Modals cleanly with currency inputs and clear actions', () => {
    const catHtml = renderToStaticMarkup(
      React.createElement(BudgetCategoryModal, {
        isOpen: true,
        onClose: () => {},
        category: CATEGORIES[0],
        nextOrder: 2,
        onSaved: async () => {},
      })
    );
    expect(catHtml).toContain('Sửa danh mục ngân sách');
    expect(catHtml).toContain('150.000.000');

    const costHtml = renderToStaticMarkup(
      React.createElement(BudgetCostModal, {
        isOpen: true,
        onClose: () => {},
        cost: COSTS[0],
        categories: CATEGORIES,
        events: [{ id: EVENT_1, name: 'Tiệc Cưới Chính' }],
        defaultEventId: EVENT_1,
        hasPayments: true,
        onSaved: async () => {},
      })
    );
    expect(costHtml).toContain('Sửa khoản chi');
    expect(costHtml).toContain('Giá quyết toán (VND)');
    expect(costHtml).toContain('>Lưu<');
    expect(costHtml).toContain('Hủy dịch vụ');
    expect(costHtml).not.toContain('>Xóa<'); // Hidden when payments already exist

    const payMetrics = computeCostRowMetrics(COSTS[0], PAYMENTS);
    const payHtml = renderToStaticMarkup(
      React.createElement(BudgetPaymentModal, {
        isOpen: true,
        onClose: () => {},
        cost: COSTS[0],
        metrics: payMetrics,
        onSaved: async () => {},
      })
    );
    expect(payHtml).toContain('Ghi nhận chi tiền');
    expect(payHtml).toContain('110.000.000');
    expect(payHtml).toContain('Chuyển khoản');

    const schedHtml = renderToStaticMarkup(
      React.createElement(BudgetScheduleModal, {
        isOpen: true,
        onClose: () => {},
        cost: COSTS[0],
        onSaved: async () => {},
      })
    );
    expect(schedHtml).toContain('Lịch các đợt thanh toán');
    expect(schedHtml).toContain('Thêm đợt trả');
  });

  it('renders streamlined LiveBudgetWorkspace KPI header and ledger container', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        RoleProvider,
        null,
        React.createElement(
          EventScopeProvider,
          { initialEvents: [{ id: EVENT_1, name: 'Tiệc Cưới Chính', isRepresentative: true }] },
          React.createElement(LiveBudgetWorkspace)
        )
      )
    );

    expect(html).toContain('Ngân Sách &amp; Chi Tiêu');
    expect(html).toContain('Thêm danh mục');
    expect(html).toContain('Thêm khoản chi');
    expect(html).toContain('data-testid="net-paid"');
    expect(html).toContain('Ngân sách dự kiến');
    expect(html).toContain('Tổng chi dự báo');
    expect(html).toContain('Đã thanh toán');
    expect(html).toContain('Còn cần chuẩn bị');
    expect(html).toContain('Đang tải ngân sách…');
  });
});
