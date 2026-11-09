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
import { AddGuestModal, AddGuestDraft } from './AddGuestModal';
import { AddFamilyModal } from './AddFamilyModal';
import { RsvpUpdateDrawer, MemberRsvpState } from './RsvpUpdateDrawer';
import { GuestDetailDrawer, GuestDetailData } from './GuestDetailDrawer';
import { DuplicateBanner } from './DuplicateBanner';
import { MergeGuestsModal, DuplicatePairSummary } from './MergeGuestsModal';
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
  {
    id: 'tuan_duplicate',
    displayName: 'Nguyễn Anh Tuấn',
    side: 'groom',
    groupName: 'Bạn Cấp 3',
    ageTier: 'adult',
    phone: '0912345678',
    rsvpStatus: 'pending_reply',
    needsSeat: true,
    needsMeal: true,
    mealDietaryTier: 'regular',
    tableName: null,
    isRepresentative: false,
  },
];

export const INITIAL_DUPLICATES: DuplicatePairSummary[] = [
  {
    guest_a: {
      id: 'anh_tuan',
      displayName: 'Anh Tuấn',
      side: 'groom',
      groupName: 'Gia đình Bác Thành',
      ageTier: 'adult',
      phone: '0912345678',
      email: 'anhtuan@example.com',
      address: 'Hà Nội',
      privateNotes: 'Ăn chay trường',
      subTags: ['Nhà trai'],
    },
    guest_b: {
      id: 'tuan_duplicate',
      displayName: 'Nguyễn Anh Tuấn',
      side: 'groom',
      groupName: 'Bạn Cấp 3',
      ageTier: 'adult',
      phone: '0912345678',
      email: 'tuan.nguyen@example.com',
      address: 'Hà Nội',
      privateNotes: 'Bạn học cấp 3 của chú rể',
      subTags: ['Bạn bè'],
    },
    similarity_score: 0.85,
    match_reasons: ['Tên tương đồng cao và trùng số điện thoại (0912345678)'],
  },
];

export interface GuestsDirectoryProps {
  initialState?: PrototypeState;
  initialGuests?: GuestItemDisplay[];
  initialDuplicates?: DuplicatePairSummary[];
  enableApiFetch?: boolean;
}

export const GuestsDirectory: React.FC<GuestsDirectoryProps> = ({
  initialState = 'populated',
  initialGuests = INITIAL_GUESTS,
  initialDuplicates = INITIAL_DUPLICATES,
  enableApiFetch = false,
}) => {
  const { isOwner } = useRole();
  const [state, setState] = React.useState<PrototypeState>(initialState);
  const [guests, setGuests] = React.useState<GuestItemDisplay[]>(initialGuests);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [duplicateCandidates, setDuplicateCandidates] =
    React.useState<DuplicatePairSummary[]>(initialDuplicates);

  // Search & filter state
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedSide, setSelectedSide] = React.useState('all');
  const [selectedRsvp, setSelectedRsvp] = React.useState('all');

  // Modals state
  const [isAddGuestOpen, setIsAddGuestOpen] = React.useState(false);
  const [isAddFamilyOpen, setIsAddFamilyOpen] = React.useState(false);
  const [isRsvpDrawerOpen, setIsRsvpDrawerOpen] = React.useState(false);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = React.useState(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = React.useState(false);

  const [activeGuestId, setActiveGuestId] = React.useState<string | null>(null);
  const [activeGuestDetail, setActiveGuestDetail] = React.useState<GuestDetailData | null>(null);
  const [activeDuplicatePair, setActiveDuplicatePair] =
    React.useState<DuplicatePairSummary | null>(null);

  React.useEffect(() => {
    setState(initialState);
  }, [initialState]);

  // Live API Fetch (if enabled)
  React.useEffect(() => {
    if (!enableApiFetch) return;

    let isMounted = true;
    async function loadData() {
      try {
        const [guestsRes, dupesRes] = await Promise.all([
          fetch('/api/v1/guests'),
          isOwner ? fetch('/api/v1/duplicate-candidates') : Promise.resolve(null),
        ]);

        if (guestsRes.ok) {
          const guestsData = await guestsRes.json();
          if (isMounted && Array.isArray(guestsData.data)) {
            setGuests(
              guestsData.data.map((g: any) => ({
                id: g.id,
                displayName: g.display_name,
                side: g.side,
                groupName: g.group_name || 'Khách mời',
                ageTier: g.age_tier,
                phone: g.phone || null,
                rsvpStatus: 'pending_reply',
                needsSeat: g.age_tier !== 'baby',
                needsMeal: true,
                mealDietaryTier: 'regular',
                tableName: null,
                isRepresentative: false,
              }))
            );
          }
        }

        if (dupesRes && dupesRes.ok) {
          const dupesData = await dupesRes.json();
          if (isMounted && Array.isArray(dupesData.data)) {
            setDuplicateCandidates(dupesData.data);
          }
        }
      } catch (err) {
        console.warn('[GuestsDirectory live fetch error]:', err);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [enableApiFetch, isOwner]);

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
  const pendingCount = guests.filter(
    (g) => g.rsvpStatus === 'pending_reply' || g.rsvpStatus === 'not_contacted'
  ).length;
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

  // Convert GuestItemDisplay to GuestDetailData for S06 drawer
  const buildGuestDetail = (g: GuestItemDisplay): GuestDetailData => ({
    id: g.id,
    displayName: g.displayName,
    side: g.side,
    groupName: g.groupName,
    ageTier: g.ageTier,
    phone: g.phone,
    email: g.phone
      ? `${removeVietnameseDiacritics(g.displayName).replace(/\s+/g, '').toLowerCase()}@example.com`
      : null,
    address: 'Hà Nội, Việt Nam',
    privateNotes: 'Khách mời thân thiết của gia đình.',
    subTags: [g.side === 'groom' ? 'Nhà trai' : 'Nhà gái'],
    attendances: [
      {
        eventId: 'event_wedding_party',
        eventName: 'Tiệc Thành Hôn (Tối)',
        eventDate: 'Chủ Nhật, 15/11/2026 - 18:00',
        rsvpStatus: g.rsvpStatus as any,
        needsSeat: g.needsSeat,
        needsMeal: g.needsMeal,
        mealDietaryTier: (g.mealDietaryTier as any) || 'regular',
        tableName: g.tableName,
        invitationCardName: g.groupName,
        invitationStatus: 'sent',
      },
      {
        eventId: 'event_morning_ceremony',
        eventName: 'Lễ Vu Quy (Sáng)',
        eventDate: 'Chủ Nhật, 15/11/2026 - 09:00',
        rsvpStatus: g.rsvpStatus === 'accepted' ? 'accepted' : 'not_contacted',
        needsSeat: g.needsSeat,
        needsMeal: false,
        tableName: null,
        invitationCardName: g.groupName,
        invitationStatus: 'sent',
      },
    ],
  });

  const handleOpenGuestDetail = (id: string) => {
    const found = guests.find((g) => g.id === id);
    if (found) {
      setActiveGuestId(id);
      setActiveGuestDetail(buildGuestDetail(found));
      setIsDetailDrawerOpen(true);
    }
  };

  // Add Single Guest
  const handleAddGuestSubmit = (data: AddGuestDraft) => {
    const newGuest: GuestItemDisplay = {
      id: `guest_${Date.now()}`,
      displayName: data.displayName,
      side: data.side,
      groupName: data.isPlaceholder ? `Đi cùng ${data.placeholderFor || 'khách'}` : 'Khách riêng lẻ',
      ageTier: data.ageTier,
      phone: data.phone || null,
      rsvpStatus: 'pending_reply',
      needsSeat: data.ageTier !== 'baby',
      needsMeal: true,
      mealDietaryTier: 'regular',
      tableName: null,
      isRepresentative: false,
    };
    setGuests((prev) => [newGuest, ...prev]);

    if (enableApiFetch) {
      fetch('/api/v1/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: data.displayName,
          side: data.side,
          age_tier: data.ageTier,
          phone: data.phone || undefined,
          email: data.email || undefined,
          address: data.address || undefined,
          private_notes: data.privateNotes || undefined,
          is_placeholder: data.isPlaceholder,
          placeholder_for: data.placeholderFor || undefined,
          sub_tags: data.subTags,
        }),
      }).catch((err) => console.warn('[Add Guest API Error]:', err));
    }
  };

  // Add Family
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

  // RSVP Drawer update callback
  const handleRsvpSave = (updatedMembers: MemberRsvpState[]) => {
    setGuests((prev) =>
      prev.map((g) => {
        const updated = updatedMembers.find((m) => m.guestId === g.id);
        if (updated) {
          return {
            ...g,
            rsvpStatus: updated.rsvpStatus,
            needsSeat: updated.needsSeat,
            needsMeal: updated.needsMeal,
            mealDietaryTier: updated.mealTier,
            tableName: updated.assignedTable || null,
          };
        }
        return g;
      })
    );
  };

  // Merge Success callback
  const handleMergeSuccess = (result: any) => {
    if (activeDuplicatePair) {
      const mergedId = activeDuplicatePair.guest_b.id;
      setGuests((prev) => prev.filter((g) => g.id !== mergedId));
      setDuplicateCandidates((prev) =>
        prev.filter((c) => c.guest_a.id !== mergedId && c.guest_b.id !== mergedId)
      );
    }
    setIsMergeModalOpen(false);
    setActiveDuplicatePair(null);
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
                variant: 'secondary',
                leftIcon: h(UserPlus, { className: 'w-4 h-4' }),
                onClick: () => setIsAddGuestOpen(true),
              },
              '+ Thêm khách'
            ),
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

      // Duplicate Banner (AT09)
      duplicateCandidates.length > 0 &&
        h(DuplicateBanner, {
          candidateCount: duplicateCandidates.length,
          onOpenMergeModal: () => {
            setActiveDuplicatePair(duplicateCandidates[0] || null);
            setIsMergeModalOpen(true);
          },
        }),

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
          onClickGuest: handleOpenGuestDetail,
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
            onClickCard: handleOpenGuestDetail,
          })
        )
      ),

      // Add Guest Modal
      h(AddGuestModal, {
        isOpen: isAddGuestOpen,
        onClose: () => setIsAddGuestOpen(false),
        onSubmit: handleAddGuestSubmit,
      }),

      // Add Family Modal (UXT02)
      h(AddFamilyModal, {
        isOpen: isAddFamilyOpen,
        onClose: () => setIsAddFamilyOpen(false),
        onSubmit: handleAddFamilySubmit,
      }),

      // Guest Detail Drawer (Screen S06)
      h(GuestDetailDrawer, {
        isOpen: isDetailDrawerOpen,
        onClose: () => {
          setIsDetailDrawerOpen(false);
          setActiveGuestDetail(null);
        },
        guest: activeGuestDetail,
        onUpdateRsvp: (g) => {
          setActiveGuestId(g.id);
          setIsRsvpDrawerOpen(true);
        },
        onTriggerMerge: (g) => {
          const pair = duplicateCandidates.find(
            (c) => c.guest_a.id === g.id || c.guest_b.id === g.id
          );
          if (pair) {
            setActiveDuplicatePair(pair);
          } else {
            const other = guests.find((x) => x.id !== g.id);
            if (other) {
              setActiveDuplicatePair({
                guest_a: g,
                guest_b: {
                  id: other.id,
                  displayName: other.displayName,
                  side: other.side,
                  phone: other.phone,
                  groupName: other.groupName,
                  ageTier: other.ageTier,
                },
                match_reasons: ['Chọn thủ công để gộp'],
              });
            }
          }
          setIsMergeModalOpen(true);
        },
      }),

      // RSVP Drawer (UXT03)
      h(RsvpUpdateDrawer, {
        isOpen: isRsvpDrawerOpen,
        onClose: () => {
          setIsRsvpDrawerOpen(false);
          setActiveGuestId(null);
        },
        onSave: handleRsvpSave,
      }),

      // Merge Guests Modal (AT09)
      h(MergeGuestsModal, {
        isOpen: isMergeModalOpen,
        onClose: () => {
          setIsMergeModalOpen(false);
          setActiveDuplicatePair(null);
        },
        candidatePair: activeDuplicatePair,
        onMergeSuccess: handleMergeSuccess,
      })
    )
  );
};
