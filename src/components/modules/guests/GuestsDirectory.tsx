'use client';

import * as React from 'react';
import { useRole } from '@/context/RoleContext';
import { PrototypeState } from '@/components/testing/PrototypeToolbar';
import { StateWrapper } from '@/components/testing/StateWrapper';
import { removeVietnameseDiacritics } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { GuestCountersBar } from './GuestCountersBar';
import { GuestFilterBar } from './GuestFilterBar';
import { GuestCardMobile, GuestItemDisplay } from './GuestCardMobile';
import { GuestListDesktop } from './GuestListDesktop';
import { AddFamilyModal } from './AddFamilyModal';
import { RsvpUpdateDrawer } from './RsvpUpdateDrawer';
import { UserPlus, Users } from 'lucide-react';

const h = React.createElement;

// Default fixtures based on FX01_FAMILY_GROUP and extended mock data
export const INITIAL_GUESTS: GuestItemDisplay[] = [
  {
    id: 'bac_thanh',
    displayName: 'Bác Thành',
    side: 'groom',
    groupName: 'Gia đình Bác Thành',
    ageTier: 'adult',
    phone: '0901234567',
    rsvpStatus: 'accepted',
    needsSeat: true,
    needsMeal: true,
    mealDietaryTier: 'regular',
    tableName: 'A1',
    isRepresentative: true,
  },
  {
    id: 'bac_gai',
    displayName: 'Bác Gái',
    side: 'groom',
    groupName: 'Gia đình Bác Thành',
    ageTier: 'adult',
    phone: '0901234567',
    rsvpStatus: 'accepted',
    needsSeat: true,
    needsMeal: true,
    mealDietaryTier: 'regular',
    tableName: 'A1',
    isRepresentative: false,
  },
  {
    id: 'anh_tuan',
    displayName: 'Anh Tuấn',
    side: 'groom',
    groupName: 'Gia đình Bác Thành',
    ageTier: 'adult',
    phone: '0912345678',
    rsvpStatus: 'pending_reply',
    needsSeat: true,
    needsMeal: true,
    mealDietaryTier: 'vegetarian',
    tableName: null,
    isRepresentative: false,
  },
  {
    id: 'be_bi',
    displayName: 'Bé Bi',
    side: 'groom',
    groupName: 'Gia đình Bác Thành',
    ageTier: 'baby',
    phone: null,
    rsvpStatus: 'pending_reply',
    needsSeat: false,
    needsMeal: true,
    mealDietaryTier: 'child_portion',
    tableName: null,
    isRepresentative: false,
  },
  {
    id: 'co_mai',
    displayName: 'Cô Mai',
    side: 'bride',
    groupName: 'Họ Hàng Nhà Gái',
    ageTier: 'adult',
    phone: '0988776655',
    rsvpStatus: 'accepted',
    needsSeat: true,
    needsMeal: true,
    mealDietaryTier: 'regular',
    tableName: 'B2',
    isRepresentative: true,
  },
  {
    id: 'chu_hung',
    displayName: 'Chú Hùng',
    side: 'bride',
    groupName: 'Họ Hàng Nhà Gái',
    ageTier: 'adult',
    phone: '0988776654',
    rsvpStatus: 'declined',
    needsSeat: false,
    needsMeal: false,
    tableName: null,
    isRepresentative: false,
  },
];

export interface GuestsDirectoryProps {
  initialState?: PrototypeState;
}

export const GuestsDirectory: React.FC<GuestsDirectoryProps> = ({
  initialState = 'populated',
}) => {
  const { isOwner } = useRole();
  const [state, setState] = React.useState<PrototypeState>(initialState);
  const [guests, setGuests] = React.useState<GuestItemDisplay[]>(INITIAL_GUESTS);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  // Search & filter state
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedSide, setSelectedSide] = React.useState('all');
  const [selectedRsvp, setSelectedRsvp] = React.useState('all');

  // Modals state
  const [isAddFamilyOpen, setIsAddFamilyOpen] = React.useState(false);
  const [isRsvpDrawerOpen, setIsRsvpDrawerOpen] = React.useState(false);
  const [activeGuestId, setActiveGuestId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setState(initialState);
  }, [initialState]);

  // Filter calculations
  const filteredGuests = React.useMemo(() => {
    if (state === 'empty') return [];
    if (state === 'filtered') return []; // simulate empty filter match

    return guests.filter((g) => {
      // Search
      if (searchQuery.trim()) {
        const normQuery = removeVietnameseDiacritics(searchQuery.toLowerCase());
        const normName = removeVietnameseDiacritics(g.displayName.toLowerCase());
        const normGroup = removeVietnameseDiacritics(g.groupName.toLowerCase());
        const normPhone = g.phone ? g.phone.toLowerCase() : '';
        if (
          !normName.includes(normQuery) &&
          !normGroup.includes(normQuery) &&
          !normPhone.includes(normQuery)
        ) {
          return false;
        }
      }
      // Side
      if (selectedSide !== 'all' && g.side !== selectedSide) {
        return false;
      }
      // RSVP
      if (selectedRsvp !== 'all' && g.rsvpStatus !== selectedRsvp) {
        return false;
      }
      return true;
    });
  }, [guests, searchQuery, selectedSide, selectedRsvp, state]);

  // Counters
  const totalInvited = guests.length;
  const acceptedCount = guests.filter((g) => g.rsvpStatus === 'accepted').length;
  const pendingCount = guests.filter((g) => g.rsvpStatus === 'pending_reply' || g.rsvpStatus === 'not_contacted').length;
  const declinedCount = guests.filter((g) => g.rsvpStatus === 'declined').length;
  const confirmedSeats = guests.filter((g) => g.rsvpStatus === 'accepted' && g.needsSeat).length;

  const activeFilterCount =
    (searchQuery ? 1 : 0) +
    (selectedSide !== 'all' ? 1 : 0) +
    (selectedRsvp !== 'all' ? 1 : 0);

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedSide('all');
    setSelectedRsvp('all');
    if (state === 'filtered') {
      setState('populated');
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.length === filteredGuests.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredGuests.map((g) => g.id));
    }
  };

  const handleAddFamilySubmit = (data: any) => {
    const newGuests: GuestItemDisplay[] = data.members.map((m: any) => ({
      id: `guest_${Date.now()}_${m.id}`,
      displayName: m.name,
      side: data.side,
      groupName: data.groupName,
      ageTier: m.ageTier,
      phone: m.phone || null,
      rsvpStatus: 'pending_reply',
      needsSeat: m.ageTier !== 'baby',
      needsMeal: true,
      tableName: null,
      isRepresentative: m.isRepresentative,
    }));
    setGuests((prev) => [...prev, ...newGuests]);
  };

  // Skeleton for loading state
  const loadingSkeleton = h(
    'div',
    { className: 'space-y-4 animate-pulse', role: 'status', 'aria-label': 'Đang tải danh sách khách' },
    h('div', { className: 'h-24 bg-border-subtle rounded-card' }),
    h('div', { className: 'h-12 bg-border-subtle rounded-control' }),
    h('div', { className: 'space-y-2' },
      [1, 2, 3, 4, 5].map((i) =>
        h('div', { key: i, className: 'h-16 bg-border-subtle rounded-control' })
      )
    )
  );

  return h(
    StateWrapper,
    {
      state,
      loadingSkeleton,
      emptyTitle: 'Chưa có khách mời nào trong danh sách',
      emptyDescription:
        'Bạn có thể thêm từng khách mời, tạo nhanh cả hộ gia đình hoặc nhập hàng loạt từ tệp Excel/CSV.',
      emptyActionLabel: '+ Thêm khách đầu tiên',
      onEmptyAction: () => {
        setGuests(INITIAL_GUESTS);
        setState('populated');
      },
      errorTitle: 'Không thể tải danh sách khách mời',
      errorMessage: 'Lỗi kết nối máy chủ hoặc mất kết nối mạng. Vui lòng thử lại.',
      errorRequestId: 'REQ-20261106-GUESTS-ERR',
      onRetry: () => setState('populated'),
      filteredTitle: 'Không có khách mời nào khớp với bộ lọc',
      filteredDescription: 'Hãy thử thay đổi từ khóa tìm kiếm hoặc xóa các điều kiện lọc.',
      onClearFilter: handleClearFilters,
      permissionDeniedMessage:
        'Người nhà chỉ có quyền xem danh sách khách mời cơ bản. Thông tin liên hệ riêng tư bị ẩn.',
    },
    h(
      'div',
      { className: 'space-y-4 max-w-7xl mx-auto' },
      // Header Actions
      h(
        'div',
        { className: 'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4' },
        h(
          'div',
          null,
          h('h1', { className: 'text-2xl font-bold text-text-main tracking-tight' }, 'Danh Sách Khách Mời'),
          h('p', { className: 'text-sm text-text-muted mt-0.5' }, 'Quản lý khách, hộ gia đình và phản hồi tham dự')
        ),
        isOwner &&
          h(
            'div',
            { className: 'flex items-center gap-2' },
            h(
              Button,
              {
                variant: 'primary',
                leftIcon: h(Users, { className: 'w-4 h-4' }),
                onClick: () => setIsAddFamilyOpen(true),
              },
              '+ Thêm gia đình (1 thiệp)'
            )
          )
      ),

      // Counters Bar
      h(GuestCountersBar, {
        totalInvited,
        acceptedCount,
        pendingCount,
        declinedCount,
        confirmedSeats,
      }),

      // Filters Bar
      h(GuestFilterBar, {
        searchQuery,
        onSearchChange: setSearchQuery,
        selectedSide,
        onSideChange: setSelectedSide,
        selectedRsvp,
        onRsvpChange: setSelectedRsvp,
        onClearFilters: handleClearFilters,
        activeFilterCount,
      }),

      // Desktop View (Hidden on mobile)
      h(
        'div',
        { className: 'hidden md:block', 'data-testid': 'guest-table-desktop' },
        h(GuestListDesktop, {
          guests: filteredGuests,
          selectedIds,
          onToggleSelect: handleToggleSelect,
          onToggleSelectAll: handleToggleSelectAll,
          onClickGuest: (id) => {
            setActiveGuestId(id);
            setIsRsvpDrawerOpen(true);
          },
        })
      ),

      // Mobile View (Reflow cards, hidden on desktop)
      h(
        'div',
        { className: 'md:hidden space-y-3', 'data-testid': 'guest-cards-mobile' },
        filteredGuests.map((guest) =>
          h(GuestCardMobile, {
            key: guest.id,
            guest,
            isSelected: selectedIds.includes(guest.id),
            onSelect: handleToggleSelect,
            onClickCard: (id) => {
              setActiveGuestId(id);
              setIsRsvpDrawerOpen(true);
            },
          })
        )
      ),

      // Add Family Modal (UXT02)
      h(AddFamilyModal, {
        isOpen: isAddFamilyOpen,
        onClose: () => setIsAddFamilyOpen(false),
        onSubmit: handleAddFamilySubmit,
      }),

      // RSVP Drawer (UXT03)
      h(RsvpUpdateDrawer, {
        isOpen: isRsvpDrawerOpen,
        onClose: () => {
          setIsRsvpDrawerOpen(false);
          setActiveGuestId(null);
        },
      })
    )
  );
};
