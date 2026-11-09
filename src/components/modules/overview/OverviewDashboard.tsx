'use client';

import * as React from 'react';
import { useRole } from '@/context/RoleContext';
import { PrototypeState } from '@/components/testing/PrototypeToolbar';
import { StateWrapper } from '@/components/testing/StateWrapper';
import { ExecutiveHeader } from './ExecutiveHeader';
import { StatCardsRow } from './StatCardsRow';
import { FamilyOverviewCard } from './FamilyOverviewCard';
import { ActionRequiredList } from './ActionRequiredList';
import { SevenDayAgenda } from './SevenDayAgenda';
import { TaskProgressSummary } from './TaskProgressSummary';
import { TopExpenseList } from './TopExpenseList';

const h = React.createElement;

export interface OverviewDashboardProps {
  initialState?: PrototypeState;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  initialState = 'populated',
}) => {
  const { isOwner, isFamily } = useRole();
  const [state, setState] = React.useState<PrototypeState>(initialState);

  React.useEffect(() => {
    setState(initialState);
  }, [initialState]);

  // Loading skeleton matching exact widget bounding boxes (Zero Layout Shift)
  const loadingSkeleton = h(
    'div',
    { className: 'space-y-6 animate-pulse', role: 'status', 'aria-label': 'Đang tải trang tổng quan' },
    // Header skeleton
    h(
      'div',
      { className: 'flex justify-between items-center pb-6 border-b border-border-subtle' },
      h('div', { className: 'h-8 w-64 bg-border-subtle rounded' }),
      h('div', { className: 'h-10 w-32 bg-border-subtle rounded' })
    ),
    // Stat cards skeleton (4 cards, height 120px each)
    isOwner &&
      h(
        'div',
        { className: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6' },
        [1, 2, 3, 4].map((i) =>
          h('div', { key: i, className: 'h-[120px] bg-border-subtle rounded-card' })
        )
      ),
    // Two columns skeleton
    h(
      'div',
      { className: 'grid grid-cols-1 lg:grid-cols-3 gap-6' },
      h('div', { className: 'lg:col-span-2 space-y-6' },
        h('div', { className: 'h-[280px] bg-border-subtle rounded-card' }),
        isOwner && h('div', { className: 'h-[200px] bg-border-subtle rounded-card' })
      ),
      h('div', { className: 'space-y-6' },
        h('div', { className: 'h-[280px] bg-border-subtle rounded-card' }),
        h('div', { className: 'h-[160px] bg-border-subtle rounded-card' })
      )
    )
  );

  return h(
    StateWrapper,
    {
      state,
      loadingSkeleton,
      emptyTitle: 'Chào mừng bạn đến với Sổ Quản Lý Đám Cưới!',
      emptyDescription:
        'Chưa có dữ liệu nào được khởi tạo. Hãy bắt đầu bằng cách thêm danh sách khách mời hoặc tạo các hạng mục chi tiêu đầu tiên.',
      emptyActionLabel: '+ Thêm khách mời đầu tiên',
      onEmptyAction: () => setState('populated'),
      errorTitle: 'Không thể tải bảng tổng quan',
      errorMessage: 'Lỗi truy xuất số liệu tổng hợp từ cơ sở dữ liệu. Vui lòng thử lại.',
      errorRequestId: 'REQ-20261106-OVERVIEW-01',
      onRetry: () => setState('populated'),
      filteredTitle: 'Không có dữ liệu cho phạm vi buổi lễ đã chọn',
      filteredDescription: 'Buổi lễ hiện tại chưa có danh sách khách hoặc chi phí riêng.',
      onClearFilter: () => setState('populated'),
      permissionDeniedMessage:
        'Bạn không có quyền truy cập vào thông tin tài chính của đám cưới này.',
    },
    h(
      'div',
      { className: 'space-y-6 max-w-7xl mx-auto' },
      // Executive Header
      h(ExecutiveHeader, {
        coupleNames: 'Minh & Linh',
        weddingDateNote: 'Dự kiến sau Tết âm lịch 2028',
      }),

      // Mode-specific top widget:
      // If Owner: 4 financial StatCards
      // If Family: FamilyOverviewCard (100% free of financial numbers)
      isOwner && h(StatCardsRow, null),
      isFamily && h(FamilyOverviewCard, null),

      // Main content grid
      h(
        'div',
        { className: 'grid grid-cols-1 lg:grid-cols-3 gap-6' },
        // Left Column (2/3 width)
        h(
          'div',
          { className: 'lg:col-span-2 space-y-6' },
          h(ActionRequiredList, null),
          isOwner && h(TopExpenseList, null)
        ),

        // Right Column (1/3 width)
        h(
          'div',
          { className: 'space-y-6' },
          h(SevenDayAgenda, null),
          h(TaskProgressSummary, null)
        )
      )
    )
  );
};
