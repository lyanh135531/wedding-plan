'use client';

import * as React from 'react';
import { TableItem, GuestSeatingItem } from './types';
import { useRole } from '@/context/RoleContext';
import {
  Circle,
  Square,
  Edit,
  Trash2,
  X,
  Baby,
  Phone,
  FileText,
  GripVertical,
  UserPlus,
} from 'lucide-react';

const h = React.createElement;

export interface TableCardProps {
  table: TableItem;
  guests: GuestSeatingItem[];
  selectedGuestId?: string | null;
  onSeatGuest?: (tableId: string) => void;
  onUnseatGuest?: (tableId: string, guestId: string) => void;
  onEditTable?: (table: TableItem) => void;
  onDeleteTable?: (tableId: string) => void;
  onDropGuest?: (tableId: string, guestId: string) => void;
  className?: string;
}

export const TableCard: React.FC<TableCardProps> = ({
  table,
  guests,
  selectedGuestId,
  onSeatGuest,
  onUnseatGuest,
  onEditTable,
  onDeleteTable,
  onDropGuest,
  className = '',
}) => {
  let roleContext = { isOwner: true, isFamily: false, canMutate: true };
  try {
    const ctx = useRole();
    roleContext = { isOwner: ctx.isOwner, isFamily: ctx.isFamily, canMutate: ctx.canMutate };
  } catch {
    // Default to owner when rendered in isolation
  }
  const { isOwner, canMutate } = roleContext;
  const [isDragOver, setIsDragOver] = React.useState(false);

  // Compute occupied seats (excluding infants with needsSeat === false per AT07)
  const seatedGuests = table.seatedGuestIds
    .map((id) => guests.find((g) => g.id === id))
    .filter(Boolean) as GuestSeatingItem[];

  const seatConsumingCount = seatedGuests.filter((g) => g.needsSeat !== false).length;
  const infantCount = seatedGuests.filter((g) => g.needsSeat === false).length;
  const isFull = seatConsumingCount >= table.capacity;
  const selectionNeedsSeat = guests.find((guest) => guest.id === selectedGuestId)?.needsSeat !== false;
  const cannotSeatSelection = isFull && selectionNeedsSeat;
  const remainingSeats = Math.max(0, table.capacity - seatConsumingCount);
  const fillPercent = table.capacity > 0 ? Math.min(100, Math.round((seatConsumingCount / table.capacity) * 100)) : 0;

  const handleDragOver = (e: React.DragEvent) => {
    if (!canMutate) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!canMutate) return;
    e.preventDefault();
    setIsDragOver(false);
    const guestId = e.dataTransfer.getData('text/plain');
    if (guestId && onDropGuest && !table.seatedGuestIds.includes(guestId)) {
      onDropGuest(table.id, guestId);
    }
  };

  return h(
    'div',
    {
      'data-testid': `table-card-${table.id}`,
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
      className: `surface-card p-4 flex flex-col gap-3 transition-all ${
        isDragOver
          ? 'border-primary ring-2 ring-primary/35 bg-primary/[0.03]'
          : selectedGuestId && !cannotSeatSelection
          ? 'border-primary/45 hover:border-primary shadow-sm'
          : isFull
          ? 'border-border-subtle bg-surface/90'
          : 'border-border-subtle hover:border-border-control'
      } ${className}`,
    },
    // Header: Shape emblem + Table Name + Capacity badge
    h(
      'div',
      { className: 'space-y-2' },
      h(
        'div',
        { className: 'flex items-start justify-between gap-2' },
        h(
          'div',
          { className: 'flex items-start gap-2.5 min-w-0' },
          h(
            'div',
            {
              className: `w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${
                table.shape === 'round'
                  ? 'bg-primary/10 border-primary/20 text-primary'
                  : 'bg-[#FFF8E1] border-[#E6C97A]/50 text-[#967638]'
              }`,
            },
            table.shape === 'round'
              ? h(Circle, { className: 'w-4 h-4', 'aria-hidden': 'true' })
              : h(Square, { className: 'w-4 h-4', 'aria-hidden': 'true' })
          ),
          h(
            'div',
            { className: 'min-w-0' },
            h(
              'div',
              { className: 'flex items-center gap-1.5 flex-wrap' },
              h('h3', { className: 'font-semibold text-[15px] text-text-main leading-snug truncate' }, table.name),
              table.tableNumber &&
                h(
                  'span',
                  { className: 'text-[10px] font-mono px-1.5 py-0.5 rounded bg-page border border-border-subtle text-text-muted' },
                  `#${table.tableNumber}`
                )
            ),
            h(
              'div',
              { className: 'flex items-center gap-2 mt-0.5 flex-wrap' },
              h(
                'span',
                {
                  className: `text-[11px] font-medium ${
                    table.shape === 'round' ? 'text-primary/80' : 'text-[#967638]'
                  }`,
                },
                table.shape === 'round' ? 'Bàn tròn' : 'Bàn chữ nhật'
              ),
              infantCount > 0 &&
                h(
                  'span',
                  { className: 'text-[11px] text-info flex items-center gap-0.5 font-medium' },
                  h(Baby, { className: 'w-3 h-3', 'aria-hidden': 'true' }),
                  `+${infantCount} em bé`
                )
            )
          )
        ),
        h(
          'div',
          { className: 'flex flex-col items-end gap-1 shrink-0' },
          h(
            'span',
            {
              className: `text-xs px-2.5 py-0.5 rounded-full font-mono font-semibold tabular-nums border ${
                isFull
                  ? 'bg-danger-bg text-danger border-danger/20'
                  : 'bg-primary/10 text-primary border-primary/15'
              }`,
            },
            `${seatConsumingCount} / ${table.capacity} chỗ`
          ),
          isFull &&
            h(
              'span',
              { className: 'text-[10px] font-semibold text-danger uppercase tracking-wider' },
              'Bàn đã đầy'
            )
        )
      ),
      // Progress bar
      h(
        'div',
        { className: 'h-1.5 w-full rounded-full bg-page overflow-hidden border border-border-subtle/50' },
        h('div', {
          className: `h-full rounded-full transition-all duration-300 ${
            isFull ? 'bg-danger' : fillPercent >= 80 ? 'bg-[#BFA16E]' : 'bg-primary'
          }`,
          style: { width: `${fillPercent}%` },
        })
      )
    ),

    // Notes (owner only, redacted for family_view per AT03/AT26)
    isOwner &&
      table.notes &&
      h(
        'div',
        { className: 'text-[11px] text-text-muted bg-page/80 px-2.5 py-1.5 rounded-control border border-border-subtle flex items-start gap-1.5' },
        h(FileText, { className: 'w-3 h-3 shrink-0 mt-0.5 text-text-muted', 'aria-hidden': 'true' }),
        h('span', { className: 'line-clamp-2' }, table.notes)
      ),

    // Seated guest list
    h(
      'div',
      { className: 'space-y-1.5' },
      seatedGuests.length === 0
        ? h(
            'div',
            {
              className: `py-4 px-3 border border-dashed rounded-control flex items-center justify-center text-xs italic transition-colors ${
                isDragOver
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-border-control/70 text-text-muted bg-page/40'
              }`,
            },
            'Kéo hoặc chạm để xếp khách vào bàn'
          )
        : seatedGuests.map((g) =>
            h(
              'div',
              {
                key: g.id,
                'data-testid': `seated-guest-${g.id}`,
                draggable: canMutate,
                onDragStart: (e: React.DragEvent) => {
                  if (!canMutate) return;
                  e.dataTransfer.setData('text/plain', g.id);
                  e.dataTransfer.effectAllowed = 'move';
                },
                className: `px-2.5 py-1.5 bg-page/75 border border-border-subtle rounded-lg text-xs text-text-main flex items-center justify-between gap-2 transition-colors ${
                  canMutate ? 'cursor-grab active:cursor-grabbing hover:border-primary/45 hover:bg-page' : ''
                }`,
              },
              h(
                'div',
                { className: 'flex items-start gap-1.5 min-w-0' },
                canMutate &&
                  h(GripVertical, {
                    className: 'w-3.5 h-3.5 text-text-muted/55 shrink-0 mt-0.5',
                    'aria-hidden': 'true',
                  }),
                h(
                  'div',
                  { className: 'min-w-0' },
                  h(
                    'div',
                    { className: 'flex items-center gap-1.5 flex-wrap' },
                    h('span', { className: 'font-medium text-text-main truncate' }, g.name),
                    g.needsSeat === false &&
                      h(
                        'span',
                        {
                          className:
                            'text-[10px] px-1.5 py-0.2 rounded-full bg-info-bg text-info font-medium',
                        },
                        'Không chiếm ghế'
                      )
                  ),
                  isOwner &&
                    (g.phone || g.notes) &&
                    h(
                      'div',
                      { className: 'text-[10px] text-text-muted mt-0.5 flex flex-wrap items-center gap-x-2.5' },
                      g.phone &&
                        h(
                          'span',
                          { className: 'inline-flex items-center gap-1 tabular-nums' },
                          h(Phone, { className: 'w-2.5 h-2.5', 'aria-hidden': 'true' }),
                          g.phone
                        ),
                      g.notes && h('span', { className: 'italic text-[#967638] truncate max-w-[200px]' }, g.notes)
                    )
                )
              ),
              isOwner &&
                onUnseatGuest &&
                h(
                  'button',
                  {
                    type: 'button',
                    'aria-label': `Gỡ ${g.name} khỏi bàn`,
                    onClick: () => onUnseatGuest(table.id, g.id),
                    className:
                      'text-text-muted hover:text-danger p-1 rounded hover:bg-danger-bg transition-colors shrink-0',
                    title: 'Gỡ khách khỏi bàn',
                  },
                  h(X, { className: 'w-3.5 h-3.5', 'aria-hidden': 'true' })
                )
            )
          )
    ),

    // Compact Footer
    (canMutate && onSeatGuest) || (isOwner && (onEditTable || onDeleteTable))
      ? h(
          'div',
          { className: 'pt-2.5 border-t border-border-subtle/80 flex items-center justify-between gap-2 flex-wrap' },
          canMutate &&
            onSeatGuest &&
            h(
              'button',
              {
                type: 'button',
                disabled: !selectedGuestId || cannotSeatSelection,
                onClick: () => onSeatGuest(table.id),
                className: `inline-flex items-center justify-center gap-1.5 text-xs h-8 px-3 rounded-control font-medium transition-all flex-1 min-w-[140px] ${
                  cannotSeatSelection
                    ? 'bg-page border border-border-subtle text-text-muted cursor-not-allowed opacity-70'
                    : selectedGuestId
                    ? 'bg-primary text-white hover:bg-primary-hover shadow-xs'
                    : 'bg-page border border-border-subtle text-text-muted'
                }`,
              },
              selectedGuestId && !cannotSeatSelection && h(UserPlus, { className: 'w-3.5 h-3.5', 'aria-hidden': 'true' }),
              cannotSeatSelection
                ? 'Bàn đã đầy'
                : selectedGuestId
                ? `Xếp vào bàn này (còn ${remainingSeats} chỗ)`
                : `Còn trống ${remainingSeats} chỗ`
            ),

          isOwner &&
            (onEditTable || onDeleteTable) &&
            h(
              'div',
              { className: 'flex items-center gap-1 shrink-0 ml-auto' },
              onEditTable &&
                h(
                  'button',
                  {
                    type: 'button',
                    onClick: () => onEditTable(table),
                    className:
                      'inline-flex items-center gap-1 text-xs text-text-muted hover:text-primary px-2 py-1.5 rounded-control hover:bg-page transition-colors',
                  },
                  h(Edit, { className: 'w-3.5 h-3.5', 'aria-hidden': 'true' }),
                  'Sửa bàn'
                ),
              onDeleteTable &&
                h(
                  'button',
                  {
                    type: 'button',
                    onClick: () => onDeleteTable(table.id),
                    className:
                      'inline-flex items-center gap-1 text-xs text-text-muted hover:text-danger px-2 py-1.5 rounded-control hover:bg-danger-bg/60 transition-colors',
                  },
                  h(Trash2, { className: 'w-3.5 h-3.5', 'aria-hidden': 'true' }),
                  'Xóa bàn'
                )
            )
        )
      : null
  );
};
