'use client';

import * as React from 'react';
import { PrototypeState } from '@/components/testing/PrototypeToolbar';
import { StateWrapper } from '@/components/testing/StateWrapper';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Users, AlertTriangle, Check, ArrowRight, ShieldAlert, Camera } from 'lucide-react';

const h = React.createElement;

export interface TableItem {
  id: string;
  name: string;
  capacity: number;
  seatedGuestIds: string[];
}

export interface GuestSeatingItem {
  id: string;
  name: string;
  groupName: string;
  tableId: string | null;
}

export const INITIAL_TABLES: TableItem[] = [
  { id: 'tbl_a1', name: 'Bàn A1 (Họ hàng nhà trai)', capacity: 10, seatedGuestIds: ['bac_thanh', 'bac_gai'] },
  { id: 'tbl_a2', name: 'Bàn A2 (Bạn bè chú rể)', capacity: 10, seatedGuestIds: [] },
  { id: 'tbl_b1', name: 'Bàn B1 (Họ hàng nhà gái)', capacity: 10, seatedGuestIds: ['co_mai'] },
  { id: 'tbl_b2', name: 'Bàn B2 (Bạn bè cô dâu)', capacity: 10, seatedGuestIds: [] },
];

export const INITIAL_SEATING_GUESTS: GuestSeatingItem[] = [
  { id: 'bac_thanh', name: 'Bác Thành', groupName: 'Gia đình Bác Thành', tableId: 'tbl_a1' },
  { id: 'bac_gai', name: 'Bác Gái', groupName: 'Gia đình Bác Thành', tableId: 'tbl_a1' },
  { id: 'anh_tuan', name: 'Anh Tuấn', groupName: 'Gia đình Bác Thành', tableId: null },
  { id: 'be_bi', name: 'Bé Bi', groupName: 'Gia đình Bác Thành', tableId: null },
  { id: 'co_mai', name: 'Cô Mai', groupName: 'Họ hàng nhà gái', tableId: 'tbl_b1' },
  { id: 'chu_hung', name: 'Chú Hùng', groupName: 'Họ hàng nhà gái', tableId: null },
];

export interface SeatingManagerProps {
  initialState?: PrototypeState;
  initialConflictMessage?: string | null;
}

export const SeatingManager: React.FC<SeatingManagerProps> = ({
  initialState = 'populated',
  initialConflictMessage = null,
}) => {
  const [state, setState] = React.useState<PrototypeState>(initialState);
  const [tables, setTables] = React.useState<TableItem[]>(INITIAL_TABLES);
  const [guests, setGuests] = React.useState<GuestSeatingItem[]>(INITIAL_SEATING_GUESTS);

  // Tap-to-seat selection (UXT12)
  const [selectedGuestId, setSelectedGuestId] = React.useState<string | null>(null);
  const [selectedTableId, setSelectedTableId] = React.useState<string | null>(null);

  // 409 Race Conflict state (UXT13)
  const [conflictMessage, setConflictMessage] = React.useState<string | null>(initialConflictMessage);

  // Snapshot status (UXT14)
  const [isSnapshotFinalized, setIsSnapshotFinalized] = React.useState(true);
  const [unassignedNewGuestCount, setUnassignedNewGuestCount] = React.useState(1);

  React.useEffect(() => {
    setState(initialState);
  }, [initialState]);

  const handleSeatGuest = (tableId: string) => {
    if (!selectedGuestId) return;

    // Simulate 409 Conflict if table is 'tbl_a2' when simulated
    if (tableId === 'tbl_a2' && conflictMessage === null && selectedGuestId === 'anh_tuan') {
      // Trigger 409 simulation per UXT13
      setConflictMessage('Bàn A2 vừa hết chỗ do người dùng khác đã xếp trước. Đã cập nhật sức chứa mới.');
      // Update capacity of tbl_a2 to full
      setTables((prev) =>
        prev.map((t) =>
          t.id === 'tbl_a2' ? { ...t, capacity: t.seatedGuestIds.length } : t
        )
      );
      // Retain active guest selection (UXT13)
      return;
    }

    // Success seat flow
    setTables((prev) =>
      prev.map((t) => {
        if (t.id === tableId) {
          return { ...t, seatedGuestIds: [...t.seatedGuestIds, selectedGuestId] };
        }
        return {
          ...t,
          seatedGuestIds: t.seatedGuestIds.filter((id) => id !== selectedGuestId),
        };
      })
    );

    setGuests((prev) =>
      prev.map((g) => (g.id === selectedGuestId ? { ...g, tableId } : g))
    );

    setSelectedGuestId(null);
    setSelectedTableId(null);
    setConflictMessage(null);
  };

  const loadingSkeleton = h(
    'div',
    { className: 'space-y-4 animate-pulse', role: 'status', 'aria-label': 'Đang tải sơ đồ xếp bàn' },
    h('div', { className: 'h-12 bg-border-subtle rounded-control' }),
    h('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
      [1, 2, 3, 4].map((i) => h('div', { key: i, className: 'h-36 bg-border-subtle rounded-card' }))
    )
  );

  return h(
    StateWrapper,
    {
      state,
      loadingSkeleton,
      emptyTitle: 'Chưa có bàn tiệc nào được tạo',
      emptyDescription: 'Tạo danh sách các bàn tiệc để bắt đầu phân bổ chỗ ngồi cho khách mời.',
      emptyActionLabel: '+ Thêm bàn đầu tiên',
      onEmptyAction: () => {
        setTables(INITIAL_TABLES);
        setState('populated');
      },
      errorTitle: 'Không thể tải sơ đồ xếp bàn',
      errorMessage: 'Lỗi đồng bộ sơ đồ xếp chỗ từ máy chủ.',
      errorRequestId: 'REQ-20261106-SEATING-ERR',
      onRetry: () => setState('populated'),
      filteredTitle: 'Không có bàn nào thuộc khu vực lọc',
      filteredDescription: 'Hãy thử chọn khu vực sảnh tiệc khác.',
      onClearFilter: () => setState('populated'),
      permissionDeniedMessage: 'Bạn không có quyền chỉnh sửa sơ đồ xếp bàn.',
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
          h('h1', { className: 'text-2xl font-bold text-text-main tracking-tight' }, 'Sơ Đồ Xếp Bàn Tiệc'),
          h('p', { className: 'text-sm text-text-muted mt-0.5' }, 'Phân bổ bàn tiệc cho từng khách mời và gia đình')
        ),
        h(
          'div',
          { className: 'flex items-center gap-2' },
          h(
            'button',
            {
              type: 'button',
              onClick: () => {
                setConflictMessage('Bàn A2 vừa hết chỗ do người dùng khác đã xếp trước. Đã cập nhật sức chứa mới.');
              },
              className: 'text-xs text-[#B45309] bg-[#FFF8E1] border border-[#F59E0B] px-2.5 py-1.5 rounded font-medium hover:bg-[#FEF3C7]',
            },
            '⚡ Mô phỏng lỗi 409 Conflict'
          )
        )
      ),

      // Snapshot status warning banner (UXT14)
      isSnapshotFinalized && unassignedNewGuestCount > 0 &&
        h(
          'div',
          { className: 'p-3 bg-[#EFF6FF] border border-[#93C5FD] rounded-control flex items-center justify-between gap-3 text-xs text-[#1E40AF]' },
          h(
            'div',
            { className: 'flex items-center gap-2' },
            h(Camera, { className: 'w-4 h-4 text-[#2563EB] shrink-0' }),
            h(
              'span',
              null,
              `Bản chốt sơ đồ v1 đã khóa (Snapshot). Hiện có `,
              h('span', { className: 'font-bold' }, `${unassignedNewGuestCount} khách mới thêm`),
              ` chưa bàn giao lại cho nhà hàng.`
            )
          ),
          h(
            'button',
            {
              onClick: () => setUnassignedNewGuestCount(0),
              className: 'font-semibold underline shrink-0 hover:text-[#1D4ED8]',
            },
            'Đồng bộ snapshot mới'
          )
        ),

      // 409 Capacity Conflict Alert (UXT13)
      conflictMessage &&
        h(
          'div',
          {
            className:
              'p-4 bg-danger-bg border border-danger/40 rounded-card flex items-start justify-between gap-3 text-sm text-danger animate-bounce-once',
            role: 'alert',
          },
          h(
            'div',
            { className: 'flex items-start gap-2.5' },
            h(ShieldAlert, { className: 'w-5 h-5 shrink-0 mt-0.5' }),
            h(
              'div',
              null,
              h('p', { className: 'font-bold' }, 'Xung đột sức chứa bàn (Lỗi 409 Conflict)'),
              h('p', { className: 'text-xs mt-0.5' }, conflictMessage),
              selectedGuestId &&
                h('p', { className: 'text-xs font-semibold mt-1 text-[#991B1B]' }, `Khách đang chọn vẫn được giữ nguyên. Vui lòng chọn bàn khác còn chỗ bên dưới.`)
            )
          ),
          h(
            'button',
            {
              onClick: () => setConflictMessage(null),
              className: 'p-1 hover:bg-black/5 rounded text-xs',
            },
            '✕'
          )
        ),

      // Tap-to-seat workflow helper (UXT12)
      h(
        'div',
        { className: 'p-3 bg-[#FAF9F5] border border-border-subtle rounded-control flex items-center justify-between text-xs text-text-main' },
        h(
          'div',
          { className: 'flex items-center gap-2' },
          h('span', { className: 'font-semibold text-primary' }, 'Bước 1:'),
          h('span', null, selectedGuestId ? `Đã chọn: ${guests.find((g) => g.id === selectedGuestId)?.name}` : 'Chạm chọn 1 khách chưa xếp bàn'),
          h(ArrowRight, { className: 'w-3.5 h-3.5 text-text-muted' }),
          h('span', { className: 'font-semibold text-primary' }, 'Bước 2:'),
          h('span', null, 'Chạm vào bàn tiệc muốn gán')
        ),
        selectedGuestId &&
          h(
            'button',
            {
              onClick: () => setSelectedGuestId(null),
              className: 'text-xs text-text-muted hover:text-text-main underline',
            },
            'Bỏ chọn'
          )
      ),

      // Two columns: Left = Unseated Guests, Right = Tables
      h(
        'div',
        { className: 'grid grid-cols-1 lg:grid-cols-3 gap-6' },
        // Left Column: Unseated Guests List
        h(
          'div',
          { className: 'bg-surface border border-border-subtle rounded-card shadow-sm p-4 space-y-3' },
          h(
            'div',
            { className: 'flex items-center justify-between border-b border-border-subtle pb-2' },
            h('h2', { className: 'text-sm font-bold text-text-main' }, 'Khách chưa xếp bàn'),
            h(
              'span',
              { className: 'text-xs font-semibold px-2 py-0.5 rounded-full bg-[#FAF9F5] text-text-muted tabular-nums' },
              guests.filter((g) => !g.tableId).length
            )
          ),

          h(
            'div',
            { className: 'space-y-2 max-h-[400px] overflow-y-auto pr-1' },
            guests
              .filter((g) => !g.tableId)
              .map((guest) => {
                const isSelected = selectedGuestId === guest.id;
                return h(
                  'button',
                  {
                    key: guest.id,
                    type: 'button',
                    onClick: () => setSelectedGuestId(guest.id),
                    className: `w-full text-left p-3 rounded-control border transition-all text-xs flex items-center justify-between ${
                      isSelected
                        ? 'border-primary bg-primary/10 font-bold ring-2 ring-primary'
                        : 'border-border-subtle bg-white hover:border-border-control'
                    }`,
                  },
                  h(
                    'div',
                    null,
                    h('p', { className: 'font-semibold text-text-main text-sm' }, guest.name),
                    h('p', { className: 'text-text-muted text-[11px]' }, guest.groupName)
                  ),
                  isSelected && h(Check, { className: 'w-4 h-4 text-primary shrink-0' })
                );
              })
          )
        ),

        // Right Column: Tables Grid
        h(
          'div',
          { className: 'lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4' },
          tables.map((tbl) => {
            const isFull = tbl.seatedGuestIds.length >= tbl.capacity;
            const remainingSeats = tbl.capacity - tbl.seatedGuestIds.length;

            return h(
              'div',
              {
                key: tbl.id,
                className: `p-4 bg-surface border rounded-card shadow-sm flex flex-col justify-between transition-all ${
                  isFull ? 'border-border-subtle opacity-75' : 'border-border-control/60 hover:border-primary'
                }`,
              },
              h(
                'div',
                null,
                h(
                  'div',
                  { className: 'flex items-center justify-between mb-2' },
                  h('h3', { className: 'font-bold text-sm text-text-main' }, tbl.name),
                  h(
                    'span',
                    {
                      className: `text-xs px-2 py-0.5 rounded font-mono font-semibold ${
                        isFull
                          ? 'bg-danger-bg text-danger'
                          : 'bg-primary/10 text-primary'
                      }`,
                    },
                    `${tbl.seatedGuestIds.length} / ${tbl.capacity} chỗ`
                  )
                ),

                // Seated guest list
                h(
                  'div',
                  { className: 'space-y-1.5 my-3 min-h-[60px]' },
                  tbl.seatedGuestIds.length === 0
                    ? h('p', { className: 'text-xs text-text-muted italic' }, 'Bàn trống chưa có khách')
                    : tbl.seatedGuestIds.map((guestId) => {
                        const g = guests.find((x) => x.id === guestId);
                        return h(
                          'div',
                          {
                            key: guestId,
                            className: 'px-2 py-1 bg-[#FAF9F5] border border-border-subtle rounded text-xs text-text-main flex items-center justify-between',
                          },
                          h('span', null, g?.name || guestId),
                          h(
                            'button',
                            {
                              type: 'button',
                              onClick: () => {
                                setTables((prev) =>
                                  prev.map((t) =>
                                    t.id === tbl.id
                                      ? { ...t, seatedGuestIds: t.seatedGuestIds.filter((x) => x !== guestId) }
                                      : t
                                  )
                                );
                                setGuests((prev) =>
                                  prev.map((x) => (x.id === guestId ? { ...x, tableId: null } : x))
                                );
                              },
                              className: 'text-text-muted hover:text-danger text-[11px] ml-2',
                              title: 'Gỡ khỏi bàn',
                            },
                            '✕'
                          )
                        );
                      })
                )
              ),

              // Action button
              h(
                Button,
                {
                  variant: selectedGuestId && !isFull ? 'primary' : 'secondary',
                  disabled: !selectedGuestId || isFull,
                  onClick: () => handleSeatGuest(tbl.id),
                  className: 'w-full text-xs h-9',
                },
                isFull
                  ? 'Bàn đã đầy'
                  : selectedGuestId
                  ? `Xếp vào bàn này (còn ${remainingSeats} chỗ)`
                  : `Còn trống ${remainingSeats} chỗ`
              )
            );
          })
        )
      )
    )
  );
};
