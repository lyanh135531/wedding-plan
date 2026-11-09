'use client';

import * as React from 'react';
import { useRole } from '@/context/RoleContext';
import { PrototypeState } from '@/components/testing/PrototypeToolbar';
import { StateWrapper } from '@/components/testing/StateWrapper';
import { Button } from '@/components/ui/button';
import { BudgetOverviewCards } from './BudgetOverviewCards';
import { OpeningCutoffBanner } from './OpeningCutoffBanner';
import { CostItemsTable, CostItemRow } from './CostItemsTable';
import { CreateCostModal } from './CreateCostModal';
import { RecordPaymentModal } from './RecordPaymentModal';
import { Plus } from 'lucide-react';

const h = React.createElement;

export const INITIAL_COST_ITEMS: CostItemRow[] = [
  { id: 'cost-1', name: 'Sảnh tiệc cưới & Thực đơn món ăn', category: 'Tiệc cưới', contractedAmount: 180000000n, paidAmount: 80000000n, status: 'contracted', isMissingPrice: false },
  { id: 'cost-2', name: 'Gói chụp ảnh pre-wedding & phóng sự', category: 'Chụp ảnh', contractedAmount: 35000000n, paidAmount: 20000000n, status: 'contracted', isMissingPrice: false },
  { id: 'cost-3', name: 'Trang trí hoa tươi gia tiên 2 nhà', category: 'Trang trí', contractedAmount: 20000000n, paidAmount: 10000000n, status: 'contracted', isMissingPrice: false },
  { id: 'cost-4', name: 'Váy cưới cô dâu & Vest chú rể', category: 'Trang phục', contractedAmount: 15000000n, paidAmount: 10000000n, status: 'contracted', isMissingPrice: false },
  { id: 'cost-5', name: 'Ban nhạc acoustic & hòa tấu đón khách', category: 'Ban nhạc & Âm thanh', contractedAmount: null, paidAmount: 0n, status: 'draft', isMissingPrice: true },
  { id: 'cost-6', name: 'Áo cưới Hoàng Gia (Đã hủy dịch vụ - FX02)', category: 'Trang phục', contractedAmount: 1500000n, paidAmount: 1500000n, status: 'settled', isMissingPrice: false },
];

export interface BudgetScreenProps {
  initialState?: PrototypeState;
}

export const BudgetScreen: React.FC<BudgetScreenProps> = ({
  initialState = 'populated',
}) => {
  const { isFamily } = useRole();
  const [state, setState] = React.useState<PrototypeState>(initialState);
  const [items, setItems] = React.useState<CostItemRow[]>(INITIAL_COST_ITEMS);
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [activePaymentItem, setActivePaymentItem] = React.useState<CostItemRow | null>(null);

  React.useEffect(() => {
    setState(initialState);
  }, [initialState]);

  // If Family View navigates here, state is strictly permission_denied (UXT16)
  const effectiveState = isFamily ? 'permission_denied' : state;

  // Aggregate metrics
  const missingPricesCount = items.filter((i) => i.isMissingPrice).length;
  const projectedCost = items.reduce(
    (acc, item) => acc + (item.contractedAmount || 0n),
    0n
  );
  const netPaid = items.reduce((acc, item) => acc + item.paidAmount, 0n);
  const remainingDue = projectedCost > netPaid ? projectedCost - netPaid : 0n;

  const handleCreateCost = (data: any) => {
    const newItem: CostItemRow = {
      id: `cost_${Date.now()}`,
      name: data.name,
      category: data.category,
      contractedAmount: data.contractedAmount,
      paidAmount: 0n,
      status: data.isMissingPrice ? 'draft' : 'contracted',
      isMissingPrice: data.isMissingPrice,
    };
    setItems((prev) => [...prev, newItem]);
  };

  const handleRecordPayment = (paymentData: any) => {
    if (!activePaymentItem) return;
    setItems((prev) =>
      prev.map((item) =>
        item.id === activePaymentItem.id
          ? { ...item, paidAmount: item.paidAmount + paymentData.amount }
          : item
      )
    );
  };

  const loadingSkeleton = h(
    'div',
    { className: 'space-y-6 animate-pulse', role: 'status', 'aria-label': 'Đang tải ngân sách' },
    h('div', { className: 'grid grid-cols-1 sm:grid-cols-4 gap-4' },
      [1, 2, 3, 4].map((i) => h('div', { key: i, className: 'h-[120px] bg-border-subtle rounded-card' }))
    ),
    h('div', { className: 'h-16 bg-border-subtle rounded-control' }),
    h('div', { className: 'h-64 bg-border-subtle rounded-card' })
  );

  return h(
    StateWrapper,
    {
      state: effectiveState,
      loadingSkeleton,
      emptyTitle: 'Chưa có khoản chi nào được tạo',
      emptyDescription:
        'Bắt đầu lập ngân sách đám cưới bằng cách thêm các khoản chi tiêu dự kiến đầu tiên.',
      emptyActionLabel: '+ Thêm khoản chi đầu tiên',
      onEmptyAction: () => {
        setItems(INITIAL_COST_ITEMS);
        setState('populated');
      },
      errorTitle: 'Không thể tải sổ ngân sách',
      errorMessage: 'Lỗi truy xuất dữ liệu sổ quỹ và các khoản chi từ cơ sở dữ liệu.',
      errorRequestId: 'REQ-20261106-BUDGET-ERR',
      onRetry: () => setState('populated'),
      filteredTitle: 'Không có khoản chi nào trong danh mục này',
      filteredDescription: 'Hãy thử chọn danh mục chi phí khác hoặc xóa bộ lọc.',
      onClearFilter: () => setState('populated'),
      permissionDeniedMessage:
        'Mục Ngân sách và Sổ quỹ chỉ dành riêng cho hai Chủ sở hữu đám cưới. Người nhà không có quyền truy cập thông tin tài chính này.',
    },
    h(
      'div',
      { className: 'space-y-6 max-w-7xl mx-auto' },
      // Header
      h(
        'div',
        { className: 'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4' },
        h(
          'div',
          null,
          h('h1', { className: 'text-2xl font-bold text-text-main tracking-tight' }, 'Sổ Ngân Sách & Chi Tiêu'),
          h('p', { className: 'text-sm text-text-muted mt-0.5' }, 'Quản lý hợp đồng nhà cung cấp, tiến độ thanh toán và quyết toán')
        ),
        h(
          Button,
          {
            variant: 'primary',
            leftIcon: h(Plus, { className: 'w-4 h-4' }),
            onClick: () => setIsCreateOpen(true),
          },
          '+ Thêm khoản chi mới'
        )
      ),

      // Overview StatCards
      h(BudgetOverviewCards, {
        targetBudget: 300000000n,
        projectedCost,
        netPaid,
        remainingDue,
        missingPricesCount,
      }),

      // Opening Cutoff Banner (UXT09)
      h(OpeningCutoffBanner, {
        openingDate: '01/10/2026',
        openingBalance: 100000000n,
        preOpeningExpensesTotal: 10000000n,
      }),

      // Cost Items Table
      h(CostItemsTable, {
        items: state === 'empty' ? [] : items,
        onRecordPayment: (item) => setActivePaymentItem(item),
      }),

      // Create Cost Modal (UXT06)
      h(CreateCostModal, {
        isOpen: isCreateOpen,
        onClose: () => setIsCreateOpen(false),
        onSubmit: handleCreateCost,
      }),

      // Record Payment Modal (UXT07)
      activePaymentItem &&
        h(RecordPaymentModal, {
          isOpen: Boolean(activePaymentItem),
          onClose: () => setActivePaymentItem(null),
          costItemName: activePaymentItem.name,
          defaultAmount: activePaymentItem.contractedAmount
            ? activePaymentItem.contractedAmount - activePaymentItem.paidAmount
            : 5000000n,
          onSubmit: handleRecordPayment,
        })
    )
  );
};
