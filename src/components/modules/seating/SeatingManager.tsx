'use client';

import * as React from 'react';
import { PrototypeState } from '@/components/testing/PrototypeToolbar';
import { StateWrapper } from '@/components/testing/StateWrapper';
import { Button } from '@/components/ui/button';
import { useRole } from '@/context/RoleContext';
import {
  Users,
  AlertTriangle,
  Check,
  ArrowRight,
  ShieldAlert,
  Camera,
  Plus,
  Printer,
  Download,
  Filter,
} from 'lucide-react';
import { TableItem, GuestSeatingItem, TableShape } from './types';
import { INITIAL_TABLES, INITIAL_SEATING_GUESTS } from './fixtures';
import { TableCard } from './TableCard';
import { SeatingConflictAlerts } from './SeatingConflictAlerts';
import { SeatingExportModal } from './SeatingExportModal';
import { AddEditTableModal } from './AddEditTableModal';

export * from './types';
export * from './fixtures';
export * from './TableCard';
export * from './SeatingConflictAlerts';
export * from './SeatingExportModal';
export * from './AddEditTableModal';

const h = React.createElement;

export interface SeatingManagerProps {
  initialState?: PrototypeState;
  initialConflictMessage?: string | null;
  initialTables?: TableItem[];
  initialGuests?: GuestSeatingItem[];
}

export const SeatingManager: React.FC<SeatingManagerProps> = ({
  initialState = 'populated',
  initialConflictMessage = null,
  initialTables = INITIAL_TABLES,
  initialGuests = INITIAL_SEATING_GUESTS,
}) => {
  // Role context with fallback for tests rendered outside RoleProvider
  let roleContext = { isOwner: true, isFamily: false, canMutate: true };
  try {
    const ctx = useRole();
    roleContext = { isOwner: ctx.isOwner, isFamily: ctx.isFamily, canMutate: ctx.canMutate };
  } catch {
    // Default to owner when rendered in isolation
  }
  const { isOwner, isFamily, canMutate } = roleContext;
  const [state, setState] = React.useState<PrototypeState>(initialState);
  const [tables, setTables] = React.useState<TableItem[]>(initialTables);
  const [guests, setGuests] = React.useState<GuestSeatingItem[]>(initialGuests);

  // Tap-to-seat selection (UXT12)
  const [selectedGuestId, setSelectedGuestId] = React.useState<string | null>(null);

  // 409 Race Conflict state (UXT13)
  const [conflictMessage, setConflictMessage] = React.useState<string | null>(initialConflictMessage);

  // Snapshot status (UXT14)
  const [isSnapshotFinalized, setIsSnapshotFinalized] = React.useState(true);
  const [unassignedNewGuestCount, setUnassignedNewGuestCount] = React.useState(1);

  // Modals state
  const [isExportModalOpen, setIsExportModalOpen] = React.useState(false);
  const [isAddEditModalOpen, setIsAddEditModalOpen] = React.useState(false);
  const [editingTable, setEditingTable] = React.useState<TableItem | null>(null);

  // Filter state
  const [shapeFilter, setShapeFilter] = React.useState<'all' | 'round' | 'rectangular'>('all');

  React.useEffect(() => {
    setState(initialState);
  }, [initialState]);

  // Seating assignment logic
  const handleSeatGuest = (tableId: string, guestIdToSeat = selectedGuestId) => {
    if (!guestIdToSeat || !canMutate) return;

    // Simulate 409 Conflict if table is 'tbl_a2' when simulated
    if (tableId === 'tbl_a2' && conflictMessage === null && guestIdToSeat === 'anh_tuan') {
      setConflictMessage('Bàn A2 vừa hết chỗ do người dùng khác đã xếp trước. Đã cập nhật sức chứa mới.');
      setTables((prev) =>
        prev.map((t) =>
          t.id === 'tbl_a2' ? { ...t, capacity: t.seatedGuestIds.length } : t
        )
      );
      return;
    }

    setTables((prev) =>
      prev.map((t) => {
        if (t.id === tableId) {
          if (t.seatedGuestIds.includes(guestIdToSeat)) return t;
          return { ...t, seatedGuestIds: [...t.seatedGuestIds, guestIdToSeat] };
        }
        return {
          ...t,
          seatedGuestIds: t.seatedGuestIds.filter((id) => id !== guestIdToSeat),
        };
      })
    );

    setGuests((prev) =>
      prev.map((g) => (g.id === guestIdToSeat ? { ...g, tableId } : g))
    );

    setSelectedGuestId(null);
    setConflictMessage(null);
  };

  const handleUnseatGuest = (tableId: string, guestId: string) => {
    if (!canMutate) return;
    setTables((prev) =>
      prev.map((t) =>
        t.id === tableId
          ? { ...t, seatedGuestIds: t.seatedGuestIds.filter((id) => id !== guestId) }
          : t
      )
    );
    setGuests((prev) =>
      prev.map((g) => (g.id === guestId ? { ...g, tableId: null } : g))
    );
  };

  const handleSaveTable = (tableData: {
    id?: string;
    name: string;
    tableNumber?: string;
    shape: TableShape;
    capacity: number;
    notes?: string;
  }) => {
    if (!canMutate) return;
    if (tableData.id) {
      setTables((prev) =>
        prev.map((t) =>
          t.id === tableData.id
            ? {
                ...t,
                name: tableData.name,
                tableNumber: tableData.tableNumber,
                shape: tableData.shape,
                capacity: tableData.capacity,
                notes: tableData.notes,
              }
            : t
        )
      );
    } else {
      const newTable: TableItem = {
        id: `tbl_${Date.now()}`,
        name: tableData.name,
        tableNumber: tableData.tableNumber,
        shape: tableData.shape,
        capacity: tableData.capacity,
        notes: tableData.notes,
        seatedGuestIds: [],
        version: 1,
      };
      setTables((prev) => [...prev, newTable]);
    }
  };

  const handleDeleteTable = (tableId: string) => {
    if (!canMutate) return;
    // Unseat all guests on this table
    setGuests((prev) =>
      prev.map((g) => (g.tableId === tableId ? { ...g, tableId: null } : g))
    );
    setTables((prev) => prev.filter((t) => t.id !== tableId));
  };

  // Drag start for guests
  const handleDragStart = (e: React.DragEvent, guestId: string) => {
    if (!canMutate) return;
    e.dataTransfer.setData('text/plain', guestId);
    e.dataTransfer.effectAllowed = 'move';
  };

  // Filtered tables
  const displayedTables = tables.filter((t) => {
    if (shapeFilter === 'all') return true;
    return t.shape === shapeFilter;
  });

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
      emptyActionLabel: isOwner ? '+ Thêm bàn đầu tiên' : undefined,
      onEmptyAction: isOwner
        ? () => {
            setTables(INITIAL_TABLES);
            setState('populated');
          }
        : undefined,
      errorTitle: 'Không thể tải sơ đồ xếp bàn',
      errorMessage: 'Lỗi đồng bộ sơ đồ xếp chỗ từ máy chủ.',
      errorRequestId: 'REQ-20261106-SEATING-ERR',
      onRetry: () => setState('populated'),
      filteredTitle: 'Không có bàn nào thuộc khu vực lọc',
      filteredDescription: 'Hãy thử chọn khu vực sảnh tiệc hoặc kiểu dáng bàn khác.',
      onClearFilter: () => {
        setShapeFilter('all');
        setState('populated');
      },
      permissionDeniedMessage: 'Bạn không có quyền chỉnh sửa sơ đồ xếp bàn.',
    },
    h(
      'div',
      { className: 'space-y-6 max-w-7xl mx-auto' },

      // Header Toolbar
      h(
        'div',
        { className: 'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4' },
        h(
          'div',
          null,
          h('h1', { className: 'text-2xl font-bold text-text-main tracking-tight' }, 'Sơ Đồ Xếp Bàn Tiệc'),
          h(
            'p',
            { className: 'text-sm text-text-muted mt-0.5' },
            isFamily
              ? 'Chế độ Người nhà (family_view): Chỉ xem sơ đồ và danh sách phân bổ chỗ ngồi'
              : 'Phân bổ bàn tiệc cho từng khách mời, kiểm soát sức chứa và xuất danh sách'
          )
        ),
        h(
          'div',
          { className: 'flex items-center flex-wrap gap-2' },
          // Simulation trigger for 409
          h(
            'button',
            {
              type: 'button',
              onClick: () => {
                setConflictMessage('Bàn A2 vừa hết chỗ do người dùng khác đã xếp trước. Đã cập nhật sức chứa mới.');
              },
              className:
                'text-xs text-[#B45309] bg-[#FFF8E1] border border-[#F59E0B] px-2.5 py-1.5 rounded font-medium hover:bg-[#FEF3C7]',
            },
            '⚡ Mô phỏng lỗi 409 Conflict'
          ),

          // Export button (Sanitized A4 Printable per AT26)
          h(
            Button,
            {
              type: 'button',
              variant: 'secondary',
              onClick: () => setIsExportModalOpen(true),
              className: 'text-xs h-9 flex items-center gap-1.5',
            },
            h(Printer, { className: 'w-3.5 h-3.5' }),
            'Xuất danh sách A4'
          ),

          // Add Table button (Owner only per AT03/AT26)
          isOwner &&
            h(
              Button,
              {
                type: 'button',
                variant: 'primary',
                onClick: () => {
                  setEditingTable(null);
                  setIsAddEditModalOpen(true);
                },
                className: 'text-xs h-9 flex items-center gap-1.5',
              },
              h(Plus, { className: 'w-3.5 h-3.5' }),
              'Thêm bàn mới'
            )
        )
      ),

      // Snapshot status warning banner (UXT14)
      isSnapshotFinalized &&
        unassignedNewGuestCount > 0 &&
        h(
          'div',
          {
            className:
              'p-3 bg-[#EFF6FF] border border-[#93C5FD] rounded-control flex items-center justify-between gap-3 text-xs text-[#1E40AF]',
          },
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
          isOwner &&
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
              'p-4 bg-danger-bg border border-danger/40 rounded-card flex items-start justify-between gap-3 text-sm text-danger',
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
                h(
                  'p',
                  { className: 'text-xs font-semibold mt-1 text-[#991B1B]' },
                  `Khách đang chọn vẫn được giữ nguyên. Vui lòng chọn bàn khác còn chỗ bên dưới.`
                )
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

      // Seating Conflict Alerts: Unseated, Split Family (AT06/AT09), Overcapacity (AT21)
      h(SeatingConflictAlerts, { tables, guests }),

      // Tap-to-seat workflow helper (UXT12) & Shape Filter Bar
      h(
        'div',
        {
          className:
            'p-3 bg-page border border-border-subtle rounded-control flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-text-main',
        },
        h(
          'div',
          { className: 'flex items-center gap-2' },
          h('span', { className: 'font-semibold text-primary' }, 'Bước 1:'),
          h(
            'span',
            null,
            selectedGuestId
              ? `Đã chọn: ${guests.find((g) => g.id === selectedGuestId)?.name}`
              : canMutate
              ? 'Chạm hoặc kéo 1 khách chưa xếp bàn'
              : 'Danh sách khách chưa xếp bàn'
          ),
          h(ArrowRight, { className: 'w-3.5 h-3.5 text-text-muted' }),
          h('span', { className: 'font-semibold text-primary' }, 'Bước 2:'),
          h('span', null, canMutate ? 'Chạm hoặc thả vào bàn tiệc muốn gán' : 'Xem sơ đồ bàn')
        ),

        // Filter by shape
        h(
          'div',
          { className: 'flex items-center gap-2' },
          h(Filter, { className: 'w-3.5 h-3.5 text-text-muted' }),
          h(
            'select',
            {
              value: shapeFilter,
              onChange: (e: any) => setShapeFilter(e.target.value),
              className:
                'h-8 px-2 border border-border-control rounded text-xs bg-surface text-text-main focus:outline-none focus:ring-1 focus:ring-primary',
            },
            h('option', { value: 'all' }, 'Tất cả kiểu bàn'),
            h('option', { value: 'round' }, 'Chỉ bàn tròn'),
            h('option', { value: 'rectangular' }, 'Chỉ bàn chữ nhật')
          ),
          selectedGuestId &&
            h(
              'button',
              {
                onClick: () => setSelectedGuestId(null),
                className: 'text-xs text-text-muted hover:text-text-main underline ml-2',
              },
              'Bỏ chọn khách'
            )
        )
      ),

      // Layout: Left column = unseated guests, Right column = tables grid
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
              {
                className:
                  'text-xs font-semibold px-2 py-0.5 rounded-full bg-page text-text-muted tabular-nums',
              },
              guests.filter((g) => !g.tableId).length
            )
          ),

          h(
            'div',
            { className: 'space-y-2 max-h-[460px] overflow-y-auto pr-1' },
            guests.filter((g) => !g.tableId).length === 0
              ? h(
                  'div',
                  { className: 'py-8 text-center text-text-muted text-xs italic' },
                  'Tất cả khách đã được xếp vào bàn tiệc.'
                )
              : guests
                  .filter((g) => !g.tableId)
                  .map((guest) => {
                    const isSelected = selectedGuestId === guest.id;
                    return h(
                      'div',
                      {
                        key: guest.id,
                        draggable: canMutate,
                        onDragStart: (e: React.DragEvent) => handleDragStart(e, guest.id),
                        onClick: () => {
                          if (canMutate) {
                            setSelectedGuestId(isSelected ? null : guest.id);
                          }
                        },
                        className: `w-full text-left p-3 rounded-control border transition-all text-xs flex items-center justify-between ${
                          canMutate ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
                        } ${
                          isSelected
                            ? 'border-primary bg-primary/10 font-bold ring-2 ring-primary'
                            : 'border-border-subtle bg-surface hover:border-border-control'
                        }`,
                      },
                      h(
                        'div',
                        null,
                        h(
                          'div',
                          { className: 'flex items-center gap-1.5' },
                          h('p', { className: 'font-semibold text-text-main text-sm' }, guest.name),
                          guest.needsSeat === false &&
                            h(
                              'span',
                              {
                                className:
                                  'text-[10px] px-1 py-0.2 bg-[#EFF6FF] text-[#1D4ED8] rounded',
                              },
                              'Em bé'
                            )
                        ),
                        h('p', { className: 'text-text-muted text-[11px]' }, guest.groupName),
                        // Sensitive fields only for owner per AT03/AT26
                        isOwner &&
                          guest.phone &&
                          h(
                            'p',
                            { className: 'text-[10px] text-text-muted flex items-center gap-1 mt-0.5' },
                            guest.phone
                          )
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
          displayedTables.map((tbl) =>
            h(TableCard, {
              key: tbl.id,
              table: tbl,
              guests,
              selectedGuestId,
              onSeatGuest: handleSeatGuest,
              onUnseatGuest: handleUnseatGuest,
              onEditTable: (tableToEdit) => {
                setEditingTable(tableToEdit);
                setIsAddEditModalOpen(true);
              },
              onDeleteTable: handleDeleteTable,
              onDropGuest: (tblId, guestId) => handleSeatGuest(tblId, guestId),
            })
          )
        )
      ),

      // Modals
      isExportModalOpen &&
        h(SeatingExportModal, {
          isOpen: isExportModalOpen,
          onClose: () => setIsExportModalOpen(false),
          tables,
          guests,
        }),

      isAddEditModalOpen &&
        isOwner &&
        h(AddEditTableModal, {
          isOpen: isAddEditModalOpen,
          onClose: () => setIsAddEditModalOpen(false),
          onSave: handleSaveTable,
          editingTable,
        })
    )
  );
};
