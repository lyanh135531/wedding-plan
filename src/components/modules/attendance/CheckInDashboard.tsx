'use client';
import { useMutationFetch } from '@/components/common/useMutationFetch';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { ModalDialog } from '@/components/ui/dialog';
import { Pagination } from '@/components/ui/pagination';
import { usePagination } from '@/components/common/usePagination';
import { useRole } from '@/context/RoleContext';
import {
  Users,
  Search,
  CheckCircle,
  RotateCcw,
  UserPlus,
  Gift,
  AlertTriangle,
  ToggleLeft,
  ToggleRight,
  Armchair,
} from 'lucide-react';

const h = React.createElement;

export interface CheckInGuestItem {
  guestId: string;
  eventId: string;
  fullName: string;
  phone: string | null;
  rsvpStatus: string;
  isCheckedIn: boolean;
  checkInTime: string | null;
  checkedInByUserId: string | null;
  checkInNotes: string | null;
  isOriginOnsite: boolean;
  tableName: string | null;
  tableNumber: number | null;
  seatNumber: number | null;
}

export interface CheckInDashboardProps {
  eventId: string;
  onNavigateToGifts?: (guestId: string, guestName: string) => void;
}

export const CheckInDashboard: React.FC<CheckInDashboardProps> = ({
  eventId,
  onNavigateToGifts,
}) => {
  const { isOwner } = useRole();
  const mutationFetch = useMutationFetch();
  const writeLock = React.useRef(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [guests, setGuests] = React.useState<CheckInGuestItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [isCheckInEnabled, setIsCheckInEnabled] = React.useState(true);

  // Modals state
  const [declinedGuest, setDeclinedGuest] = React.useState<CheckInGuestItem | null>(null);
  const [isWalkInModalOpen, setIsWalkInModalOpen] = React.useState(false);
  const [walkInName, setWalkInName] = React.useState('');
  const [walkInPhone, setWalkInPhone] = React.useState('');
  const [walkInRelation, setWalkInRelation] = React.useState('');
  const [walkInNotes, setWalkInNotes] = React.useState('');
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const fetchGeneration = React.useRef(0);
  // Fetch guests
  const fetchGuests = React.useCallback(async (q = '') => {
    const generation = ++fetchGeneration.current;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await mutationFetch(`/api/v1/attendance/check-in?eventId=${eventId}&q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const json = await res.json();
        if (generation !== fetchGeneration.current) return;
        setGuests(json.data || []);
        setIsCheckInEnabled(json.isCheckInEnabled !== false);
      } else { const failure = await res.json(); setErrorMsg(failure.message || 'Không thể tải điểm danh.'); }
    } catch {
      if (generation === fetchGeneration.current) setErrorMsg('Không thể tải điểm danh. Kiểm tra kết nối và thử lại.');
    } finally {
      if (generation === fetchGeneration.current) setLoading(false);
    }
  }, [eventId]);

  React.useEffect(() => {
    if (eventId) {
      fetchGuests(searchQuery);
    }
  }, [eventId, fetchGuests, searchQuery]);

  // Handle one-tap check in
  const handleCheckIn = async (guest: CheckInGuestItem, confirmDeclined = false) => {
    if (guest.rsvpStatus === 'declined' && !confirmDeclined) {
      setDeclinedGuest(guest);
      return;
    }

    try {
      const res = await mutationFetch('/api/v1/attendance/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          guestId: guest.guestId,
          confirmDeclinedOverride: confirmDeclined,
        }),
      });

      if (res.ok) {
        setDeclinedGuest(null);
        fetchGuests(searchQuery);
      } else {
        const errJson = await res.json();
        setErrorMsg(errJson.message || 'Lỗi khi điểm danh');
      }
    } catch {
      setErrorMsg('Lỗi kết nối máy chủ');
    }
  };

  // Handle undo check in
  const handleUndo = async (guestId: string) => {
    try {
      const res = await mutationFetch('/api/v1/attendance/check-in/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          guestId,
          undoReason: 'Người dùng hủy điểm danh tại quầy lễ tân',
        }),
      });

      if (res.ok) {
        fetchGuests(searchQuery);
      } else { const failure = await res.json(); setErrorMsg(failure.message || 'Không thể hoàn tác điểm danh.'); }
    } catch {
      setErrorMsg('Lỗi hoàn tác điểm danh');
    }
  };

  // Handle create walk-in guest
  const handleCreateWalkIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walkInName.trim()) return;

    if (writeLock.current) return;
    writeLock.current=true;
    try {
      const res = await mutationFetch('/api/v1/attendance/walk-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          fullName: walkInName.trim(),
          phone: walkInPhone.trim() || undefined,
          relationship: walkInRelation.trim() || undefined,
          checkInNotes: walkInNotes.trim() || undefined,
        }),
      });

      if (res.ok) {
        setIsWalkInModalOpen(false);
        setWalkInName('');
        setWalkInPhone('');
        setWalkInRelation('');
        setWalkInNotes('');
        fetchGuests(searchQuery);
      } else {
        const errJson = await res.json();
        setErrorMsg(errJson.message || 'Lỗi thêm khách phát sinh');
      }
    } catch {
      setErrorMsg('Lỗi kết nối máy chủ');
    } finally { writeLock.current=false; }
  };

  // Toggle check in feature
  const handleToggle = async () => {
    const nextVal = !isCheckInEnabled;
    try {
      const res = await mutationFetch('/api/v1/attendance/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, isEnabled: nextVal }),
      });
      if (res.ok) {
        setIsCheckInEnabled(nextVal);
      } else { const failure = await res.json(); setErrorMsg(failure.message || 'Không thể bật/tắt điểm danh.'); }
    } catch {
      setErrorMsg('Lỗi bật/tắt tính năng điểm danh');
    }
  };

  const totalGuests = guests.length;
  const checkedInCount = guests.filter((g) => g.isCheckedIn).length;
  const notCheckedInCount = totalGuests - checkedInCount;
  const pagination = usePagination(guests, { defaultPageSize: 25, resetKey: `${eventId}:${searchQuery}` });

  return h(
    'div',
    { className: 'space-y-6 max-w-7xl mx-auto', 'aria-busy': loading },
    // Header & Controls
    h(
      'div',
      { className: 'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border-subtle pb-4' },
      h(
        'div',
        null,
        h('h1', { className: 'text-2xl font-bold text-text-main tracking-tight' }, 'Điểm Danh Ngày Cưới (Reception Check-in)'),
        h('p', { className: 'text-sm text-text-muted mt-0.5' }, 'Tra cứu chỗ ngồi, ghi nhận khách đến và chuyển tiếp vào sổ quà mừng')
      ),
      isOwner &&
        h(
          'div',
          { className: 'flex items-center gap-3' },
          h(
            Button,
            {
              variant: 'secondary',
              leftIcon: h(isCheckInEnabled ? ToggleRight : ToggleLeft, {
                className: `w-5 h-5 ${isCheckInEnabled ? 'text-primary' : 'text-text-muted'}`,
              }),
              onClick: handleToggle,
            },
            isCheckInEnabled ? 'Tính năng: Bật' : 'Tính năng: Tắt'
          ),
          h(
            Button,
            {
              variant: 'primary',
              leftIcon: h(UserPlus, { className: 'w-4 h-4' }),
              onClick: () => setIsWalkInModalOpen(true),
            },
            '+ Khách phát sinh'
          )
        )
    ),

    // Error notification
    errorMsg &&
      h(
        'div',
        { className: 'p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-control flex items-center justify-between' },
        h('span', null, errorMsg),
        h('button', { type: 'button', onClick: () => setErrorMsg(null), className: 'font-bold' }, '✕')
      ),

    // Stat Summary Cards
    h(
      'div',
      { className: 'grid grid-cols-2 sm:grid-cols-4 gap-3' },
      h(
        'div',
        { className: 'p-4 bg-surface border border-border-subtle rounded-card' },
        h('p', { className: 'text-xs text-text-muted font-medium' }, 'Tổng danh sách'),
        h('p', { className: 'text-2xl font-bold text-text-main mt-1' }, totalGuests)
      ),
      h(
        'div',
        { className: 'p-4 bg-emerald-50 border border-emerald-200 rounded-card' },
        h('p', { className: 'text-xs text-emerald-800 font-medium' }, 'Đã đến'),
        h('p', { className: 'text-2xl font-bold text-emerald-800 mt-1' }, checkedInCount)
      ),
      h(
        'div',
        { className: 'p-4 bg-surface border border-border-subtle rounded-card' },
        h('p', { className: 'text-xs text-text-muted font-medium' }, 'Chưa đến'),
        h('p', { className: 'text-2xl font-bold text-text-muted mt-1' }, notCheckedInCount)
      ),
      h(
        'div',
        { className: 'p-4 bg-surface border border-border-subtle rounded-card' },
        h('p', { className: 'text-xs text-text-muted font-medium' }, 'Khách phát sinh'),
        h('p', { className: 'text-2xl font-bold text-primary mt-1' }, guests.filter((g) => g.isOriginOnsite).length)
      )
    ),

    // Fast search input
    h(
      'div',
      { className: 'relative' },
      h(Search, { className: 'absolute left-3.5 top-3 w-5 h-5 text-text-muted pointer-events-none' }),
      h('input', {
        type: 'text',
        placeholder: 'Tìm nhanh theo tên khách (không dấu) hoặc số điện thoại...',
        value: searchQuery,
        onChange: (e) => setSearchQuery(e.target.value),
        className: 'w-full pl-11 pr-4 py-2.5 rounded-control border border-border-control bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary',
      })
    ),

    // Guest List
    h(
      'div',
      { className: 'bg-surface border border-border-subtle rounded-card shadow-sm overflow-hidden' },
      guests.length === 0
        ? h(
            'div',
            { className: 'p-8 text-center text-text-muted' },
            loading ? 'Đang tìm kiếm khách...' : 'Không tìm thấy khách mời nào phù hợp.'
          )
        : h(
            'div',
            { className: 'divide-y divide-border-subtle' },
            pagination.pagedItems.map((g) =>
              h(
                'div',
                {
                  key: g.guestId,
                  className: `p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                    g.isCheckedIn ? 'bg-emerald-50/40' : 'hover:bg-gray-50'
                  }`,
                },
                // Guest Info
                h(
                  'div',
                  { className: 'space-y-1 min-w-0' },
                  h(
                    'div',
                    { className: 'flex items-center gap-2 flex-wrap' },
                    h('p', { className: 'font-semibold text-base text-text-main' }, g.fullName),
                    g.isOriginOnsite &&
                      h('span', { className: 'text-[11px] bg-amber-100 text-amber-800 font-medium px-2 py-0.5 rounded' }, 'Phát sinh'),
                    g.rsvpStatus === 'declined' &&
                      h('span', { className: 'text-[11px] bg-red-100 text-red-800 font-medium px-2 py-0.5 rounded' }, 'Đã từ chối RSVP')
                  ),
                  h(
                    'div',
                    { className: 'flex items-center gap-3 text-xs text-text-muted flex-wrap' },
                    g.phone && h('span', null, `📞 ${g.phone}`),
                    // Table Assignment Pill
                    g.tableName
                      ? h(
                          'span',
                          { className: 'inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-full' },
                          h(Armchair, { className: 'w-3.5 h-3.5' }),
                          `Bàn: ${g.tableName}${g.seatNumber ? ` • Ghế ${g.seatNumber}` : ''}`
                        )
                      : h('span', { className: 'text-text-muted italic' }, 'Chưa xếp bàn')
                  )
                ),

                // Status & Actions
                h(
                  'div',
                  { className: 'flex items-center gap-2 shrink-0' },
                  g.isCheckedIn
                    ? h(
                        'div',
                        { className: 'flex items-center gap-2' },
                        h(
                          'span',
                          { className: 'inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded' },
                          h(CheckCircle, { className: 'w-4 h-4' }),
                          'Đã đến'
                        ),
                        isOwner &&
                          h(
                            Button,
                            {
                              variant: 'ghost',
                              size: 'sm',
                              leftIcon: h(RotateCcw, { className: 'w-3.5 h-3.5' }),
                              onClick: () => handleUndo(g.guestId),
                            },
                            'Hoàn tác'
                          )
                      )
                    : isOwner &&
                      h(
                        Button,
                        {
                          variant: 'primary',
                          size: 'sm',
                          onClick: () => handleCheckIn(g),
                        },
                        'Điểm danh'
                      ),

                  // Gift shortcut
                  onNavigateToGifts &&
                    isOwner &&
                    h(
                      Button,
                      {
                        variant: 'secondary',
                        size: 'sm',
                        leftIcon: h(Gift, { className: 'w-3.5 h-3.5 text-primary' }),
                        onClick: () => onNavigateToGifts(g.guestId, g.fullName),
                      },
                      'Ghi quà'
                    )
                )
              )
            )
          )
    ),

    guests.length > 0 &&
      h(Pagination, {
        currentPage: pagination.currentPage,
        pageSize: pagination.pageSize,
        totalItems: pagination.totalItems,
        onPageChange: pagination.setCurrentPage,
        onPageSizeChange: pagination.setPageSize,
        pageSizeOptions: [10, 25, 50, 100],
        unitLabel: 'khách',
      }),

    // Modal: Confirm declined guest check in
    declinedGuest &&
      h(
        'div',
        { className: 'fixed inset-0 z-50 flex items-center justify-center p-4 app-overlay' },
        h(
          'div',
          { className: 'bg-surface w-full max-w-sm rounded-card border border-border-control p-6 space-y-4' },
          h(
            'div',
            { className: 'flex items-center gap-2 text-amber-600' },
            h(AlertTriangle, { className: 'w-5 h-5' }),
            h('h3', { className: 'text-base font-bold text-text-main' }, 'Khách từng báo Từ Chối')
          ),
          h(
            'p',
            { className: 'text-xs text-text-muted leading-relaxed' },
            `Khách mời "${declinedGuest.fullName}" từng phản hồi từ chối tham dự. Bạn có chắc chắn muốn xác nhận khách đã đến và tiến hành sắp xếp chỗ ngồi?`
          ),
          h(
            'div',
            { className: 'flex justify-end gap-2 pt-3 border-t border-border-subtle' },
            h(Button, { variant: 'secondary', onClick: () => setDeclinedGuest(null) }, 'Hủy'),
            h(Button, { variant: 'primary', onClick: () => handleCheckIn(declinedGuest, true) }, 'Xác nhận Đã Đến')
          )
        )
      ),

    // Modal: Add Walk-in Guest
    isWalkInModalOpen &&
      h(
        ModalDialog,
        { isOpen: true, title: 'Thêm Khách Phát Sinh Tại Buổi Cưới', onClose: () => setIsWalkInModalOpen(false) },
        h(
          'form',
          {
            onSubmit: handleCreateWalkIn,
            className: 'space-y-4',
          },
          h(
            'div',
            { className: 'space-y-3 text-xs' },
            h(
              'div',
              null,
              h('label', { className: 'font-semibold text-text-main' }, 'Họ và tên *'),
              h('input', {
                type: 'text',
                required: true,
                value: walkInName, 'aria-label': 'Họ và tên khách phát sinh',
                onChange: (e) => setWalkInName(e.target.value),
                placeholder: 'Ví dụ: Nguyễn Văn A (Bạn chú rể)',
                className: 'w-full mt-1 p-2 border border-border-control rounded focus:ring-1 focus:ring-primary',
              })
            ),
            h(
              'div',
              null,
              h('label', { className: 'font-semibold text-text-main' }, 'Số điện thoại'),
              h('input', {
                type: 'tel',
                value: walkInPhone, 'aria-label': 'Điện thoại khách phát sinh',
                onChange: (e) => setWalkInPhone(e.target.value),
                placeholder: '0901234567',
                className: 'w-full mt-1 p-2 border border-border-control rounded focus:ring-1 focus:ring-primary',
              })
            ),
            h(
              'div',
              null,
              h('label', { className: 'font-semibold text-text-main' }, 'Mối quan hệ'),
              h('input', {
                type: 'text',
                value: walkInRelation, 'aria-label': 'Quan hệ khách phát sinh',
                onChange: (e) => setWalkInRelation(e.target.value),
                placeholder: 'Bạn đồng nghiệp, Họ hàng...',
                className: 'w-full mt-1 p-2 border border-border-control rounded focus:ring-1 focus:ring-primary',
              })
            ),
            h(
              'div',
              null,
              h('label', { className: 'font-semibold text-text-main' }, 'Ghi chú lễ tân'),
              h('textarea', {
                rows: 2,
                value: walkInNotes, 'aria-label': 'Ghi chú khách phát sinh',
                onChange: (e: any) => setWalkInNotes(e.target.value),
                placeholder: 'Ghi chú bàn tiệc hoặc yêu cầu đặc biệt...',
                className: 'w-full mt-1 p-2 border border-border-control rounded focus:ring-1 focus:ring-primary',
              })
            )
          ),
          h(
            'div',
            { className: 'flex justify-end gap-2 pt-3 border-t border-border-subtle' },
            h(Button, { variant: 'secondary', type: 'button', onClick: () => setIsWalkInModalOpen(false) }, 'Đóng'),
            h(Button, { variant: 'primary', type: 'submit' }, 'Thêm & Điểm danh ngay')
          )
        )
      )
  );
};
