'use client';

import * as React from 'react';
import { useRole } from '@/context/RoleContext';
import { PrototypeState } from '@/components/testing/PrototypeToolbar';
import { StateWrapper } from '@/components/testing/StateWrapper';
import { Button } from '@/components/ui/button';
import { InvitationGroupTable, InvitationGroupItem } from './InvitationGroupTable';
import { BulkMarkSentDialog } from './BulkMarkSentDialog';
import { Send, MailCheck } from 'lucide-react';

const h = React.createElement;

export const INITIAL_INVITATIONS: InvitationGroupItem[] = [
  {
    id: 'inv-1',
    cardName: 'Gia đình Bác Thành',
    deliveryMethod: 'in_person',
    status: 'preparing',
    sentDate: null,
    memberNames: ['Bác Thành', 'Bác Gái', 'Anh Tuấn', 'Bé Bi'],
  },
  {
    id: 'inv-2',
    cardName: 'Họ Hàng Nhà Gái',
    deliveryMethod: 'paper',
    status: 'save_the_date',
    sentDate: null,
    memberNames: ['Cô Mai', 'Chú Hùng'],
  },
  {
    id: 'inv-3',
    cardName: 'Nhóm Bạn Cấp 3 Chú Rể',
    deliveryMethod: 'electronic',
    status: 'sent',
    sentDate: '2026-11-01',
    senderName: 'Chú rể',
    memberNames: ['Hoàng', 'Nam', 'Việt'],
  },
  {
    id: 'inv-4',
    cardName: 'Gia đình Bác Ba',
    deliveryMethod: 'in_person',
    status: 'preparing',
    sentDate: null,
    memberNames: ['Bác Ba', 'Bác Ba Gái'],
  },
  {
    id: 'inv-5',
    cardName: 'Hội Bạn Đại Học Cô Dâu',
    deliveryMethod: 'electronic',
    status: 'preparing',
    sentDate: null,
    memberNames: ['Hương', 'Lan', 'Trang'],
  },
];

export interface InvitationsManagerProps {
  initialState?: PrototypeState;
}

export const InvitationsManager: React.FC<InvitationsManagerProps> = ({
  initialState = 'populated',
}) => {
  const { isOwner } = useRole();
  const [state, setState] = React.useState<PrototypeState>(initialState);
  const [invitations, setInvitations] = React.useState<InvitationGroupItem[]>(INITIAL_INVITATIONS);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = React.useState(false);

  React.useEffect(() => {
    setState(initialState);
  }, [initialState]);

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.length === invitations.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(invitations.map((i) => i.id));
    }
  };

  const handleConfirmBulkSent = (sentDate: string, senderName: string) => {
    setInvitations((prev) =>
      prev.map((inv) =>
        selectedIds.includes(inv.id)
          ? { ...inv, status: 'sent', sentDate, senderName }
          : inv
      )
    );
    setSelectedIds([]);
  };

  // Loading skeleton
  const loadingSkeleton = h(
    'div',
    { className: 'space-y-4 animate-pulse', role: 'status', 'aria-label': 'Đang tải danh sách thiệp' },
    h('div', { className: 'h-12 bg-border-subtle rounded-card' }),
    h('div', { className: 'space-y-2' },
      [1, 2, 3, 4].map((i) =>
        h('div', { key: i, className: 'h-16 bg-border-subtle rounded-control' })
      )
    )
  );

  return h(
    StateWrapper,
    {
      state,
      loadingSkeleton,
      emptyTitle: 'Chưa có nhóm thiệp mời nào',
      emptyDescription: 'Tạo các nhóm thiệp mời từ danh sách hộ gia đình để theo dõi tiến độ gửi.',
      emptyActionLabel: '+ Tạo nhóm thiệp',
      onEmptyAction: () => {
        setInvitations(INITIAL_INVITATIONS);
        setState('populated');
      },
      errorTitle: 'Không thể tải danh sách thiệp',
      errorMessage: 'Lỗi truy xuất tiến độ chuyển phát thiệp mời.',
      errorRequestId: 'REQ-20261106-INV-ERR',
      onRetry: () => setState('populated'),
      filteredTitle: 'Không có thiệp mời nào trong bộ lọc',
      filteredDescription: 'Hãy thử chọn lại trạng thái hoặc hình thức gửi thiệp.',
      onClearFilter: () => setState('populated'),
      permissionDeniedMessage: 'Chỉ Chủ sở hữu mới có quyền quản lý danh sách thiệp mời.',
    },
    h(
      'div',
      { className: 'space-y-4 max-w-7xl mx-auto' },
      // Header
      h(
        'div',
        { className: 'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4' },
        h(
          'div',
          null,
          h('h1', { className: 'text-2xl font-bold text-text-main tracking-tight' }, 'Quản Lý Thiệp Mời'),
          h('p', { className: 'text-sm text-text-muted mt-0.5' }, 'Theo dõi in ấn và chuyển phát thiệp giấy / điện tử')
        ),
        // Bulk Action Bar (Strictly Owner Only)
        isOwner &&
          selectedIds.length > 0 &&
          h(
            Button,
            {
              variant: 'primary',
              leftIcon: h(Send, { className: 'w-4 h-4' }),
              onClick: () => setIsBulkDialogOpen(true),
            },
            `Đánh dấu đã gửi (${selectedIds.length} thiệp)`
          )
      ),

      // Table
      h(InvitationGroupTable, {
        invitations: state === 'empty' ? [] : invitations,
        selectedIds,
        onToggleSelect: handleToggleSelect,
        onToggleSelectAll: handleToggleSelectAll,
      }),

      // Bulk Dialog (UXT05)
      h(BulkMarkSentDialog, {
        isOpen: isBulkDialogOpen,
        onClose: () => setIsBulkDialogOpen(false),
        selectedCount: selectedIds.length,
        onConfirm: handleConfirmBulkSent,
      })
    )
  );
};
