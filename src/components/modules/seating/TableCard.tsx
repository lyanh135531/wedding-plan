'use client';

import * as React from 'react';
import { TableItem, GuestSeatingItem } from './types';
import { useRole } from '@/context/RoleContext';
import { Circle, Square, Edit, Trash2, X, Baby, Phone, FileText } from 'lucide-react';

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
  const { isOwner, isFamily, canMutate } = roleContext;
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

  // Drag and drop handlers
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
      className: `p-4 bg-surface border rounded-card shadow-sm flex flex-col justify-between transition-all ${
        isDragOver
          ? 'border-primary ring-2 ring-primary/40 bg-primary/5'
          : isFull
          ? 'border-border-subtle bg-white/80'
          : 'border-border-control/60 hover:border-primary'
      } ${className}`,
    },
    h(
      'div',
      null,
      // Header: Table name, shape badge, capacity & full status
      h(
        'div',
        { className: 'flex items-start justify-between gap-2 mb-2' },
        h(
          'div',
          null,
          h(
            'div',
            { className: 'flex items-center gap-1.5' },
            table.shape === 'round'
              ? h(Circle, { className: 'w-4 h-4 text-primary shrink-0' })
              : h(Square, { className: 'w-4 h-4 text-[#D97706] shrink-0' }),
            h('h3', { className: 'font-bold text-sm text-text-main' }, table.name)
          ),
          h(
            'div',
            { className: 'flex items-center gap-2 mt-1' },
            h(
              'span',
              {
                className: `text-[11px] px-1.5 py-0.5 rounded font-medium ${
                  table.shape === 'round'
                    ? 'bg-primary/10 text-primary'
                    : 'bg-[#FFFBEB] text-[#B45309]'
                }`,
              },
              table.shape === 'round' ? 'Bàn tròn' : 'Bàn chữ nhật'
            ),
            infantCount > 0 &&
              h(
                'span',
                { className: 'text-[11px] text-text-muted flex items-center gap-0.5' },
                h(Baby, { className: 'w-3 h-3 text-[#2563EB]' }),
                `+${infantCount} em bé`
              )
          )
        ),
        h(
          'div',
          { className: 'flex flex-col items-end gap-1' },
          h(
            'span',
            {
              className: `text-xs px-2 py-0.5 rounded font-mono font-semibold ${
                isFull
                  ? 'bg-danger-bg text-danger'
                  : 'bg-primary/10 text-primary'
              }`,
            },
            `${seatConsumingCount} / ${table.capacity} chỗ`
          ),
          isFull &&
            h(
              'span',
              { className: 'text-[10px] font-bold text-danger uppercase tracking-wider' },
              'Bàn đã đầy'
            )
        )
      ),

      // Notes (only for owner, sanitized/hidden for family_view per AT03/AT26)
      isOwner &&
        table.notes &&
        h(
          'div',
          { className: 'text-[11px] text-text-muted bg-page p-1.5 rounded mb-2 border border-border-subtle flex items-start gap-1' },
          h(FileText, { className: 'w-3 h-3 shrink-0 mt-0.5 text-text-muted' }),
          h('span', null, table.notes)
        ),

      // Seated guest list
      h(
        'div',
        { className: 'space-y-1.5 my-3 min-h-[64px]' },
        seatedGuests.length === 0
          ? h(
              'div',
              { className: 'h-14 border border-dashed border-border-subtle rounded flex items-center justify-center text-xs text-text-muted italic' },
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
                  className: `px-2.5 py-1.5 bg-page border border-border-subtle rounded text-xs text-text-main flex items-center justify-between gap-2 transition-all ${
                    canMutate ? 'cursor-grab active:cursor-grabbing hover:border-primary/50' : ''
                  }`,
                },
                h(
                  'div',
                  { className: 'flex flex-col' },
                  h(
                    'div',
                    { className: 'flex items-center gap-1.5' },
                    h('span', { className: 'font-semibold' }, g.name),
                    g.needsSeat === false &&
                      h(
                        'span',
                        {
                          className:
                            'text-[10px] px-1 py-0.2 rounded bg-[#EFF6FF] text-[#1D4ED8] font-normal',
                        },
                        'Không chiếm ghế'
                      )
                  ),
                  // Contact & notes: strictly owner-only per AT03 / AT26
                  isOwner &&
                    (g.phone || g.notes) &&
                    h(
                      'div',
                      { className: 'text-[10px] text-text-muted mt-0.5 space-y-0.5' },
                      g.phone &&
                        h(
                          'span',
                          { className: 'flex items-center gap-1' },
                          h(Phone, { className: 'w-2.5 h-2.5' }),
                          g.phone
                        ),
                      g.notes &&
                        h(
                          'span',
                          { className: 'italic text-[#B45309] block' },
                          g.notes
                        )
                    )
                ),
                // Unseat button: owner only, hidden for family_view
                isOwner &&
                  onUnseatGuest &&
                  h(
                    'button',
                    {
                      type: 'button',
                      'aria-label': `Gỡ ${g.name} khỏi bàn`,
                      onClick: () => onUnseatGuest(table.id, g.id),
                      className:
                        'text-text-muted hover:text-danger p-1 rounded hover:bg-danger-bg text-xs shrink-0',
                      title: 'Gỡ khách khỏi bàn',
                    },
                    h(X, { className: 'w-3.5 h-3.5' })
                  )
              )
            )
      )
    ),

    // Footer actions
    h(
      'div',
      { className: 'mt-3 pt-2 border-t border-border-subtle space-y-2' },
      // Tap-to-seat button (UXT12)
      canMutate &&
        onSeatGuest &&
        h(
          'button',
          {
            type: 'button',
            disabled: !selectedGuestId || cannotSeatSelection,
            onClick: () => onSeatGuest(table.id),
            className: `w-full text-xs h-9 rounded-control font-medium transition-all ${
              cannotSeatSelection
                ? 'bg-border-subtle/50 text-text-muted cursor-not-allowed'
                : selectedGuestId
                ? 'bg-primary text-white hover:bg-primary/90 shadow-sm'
                : 'bg-page border border-border-subtle text-text-muted hover:border-primary'
            }`,
          },
          cannotSeatSelection
            ? 'Bàn đã đầy'
            : selectedGuestId
            ? `Xếp vào bàn này (còn ${remainingSeats} chỗ)`
            : `Còn trống ${remainingSeats} chỗ`
        ),

      // Edit/Delete table buttons: Owner only, hidden for family_view
      isOwner &&
        (onEditTable || onDeleteTable) &&
        h(
          'div',
          { className: 'flex items-center justify-end gap-2 text-xs pt-1' },
          onEditTable &&
            h(
              'button',
              {
                type: 'button',
                onClick: () => onEditTable(table),
                className:
                  'flex items-center gap-1 text-text-muted hover:text-primary px-2 py-1 rounded hover:bg-page',
              },
              h(Edit, { className: 'w-3 h-3' }),
              'Sửa bàn'
            ),
          onDeleteTable &&
            h(
              'button',
              {
                type: 'button',
                onClick: () => onDeleteTable(table.id),
                className:
                  'flex items-center gap-1 text-text-muted hover:text-danger px-2 py-1 rounded hover:bg-danger-bg',
              },
              h(Trash2, { className: 'w-3 h-3' }),
              'Xóa bàn'
            )
        )
    )
  );
};
