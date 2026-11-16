'use client';

import * as React from 'react';
import { Accommodation, RoomAssignment } from './types';
import { useRole } from '@/context/RoleContext';
import { Hotel, Home, Calendar, Phone, FileText, Plus, Trash2, MapPin, User } from 'lucide-react';
import { Button } from '@/components/ui/button';

const h = React.createElement;

export interface AccommodationsTabProps {
  accommodations: Accommodation[];
  roomAssignments: RoomAssignment[];
  onAddAssignment?: () => void;
  onDeleteAssignment?: (assignmentId: string) => void;
  className?: string;
}

export const AccommodationsTab: React.FC<AccommodationsTabProps> = ({
  accommodations,
  roomAssignments,
  onAddAssignment,
  onDeleteAssignment,
  className = '',
}) => {
  let roleContext = { isOwner: true, isFamily: false, canMutate: true };
  try {
    const ctx = useRole();
    roleContext = { isOwner: ctx.isOwner, isFamily: ctx.isFamily, canMutate: ctx.canMutate };
  } catch {
    // Default to owner in isolation
  }
  const { isOwner, isFamily, canMutate } = roleContext;

  return h(
    'div',
    { className: `space-y-6 ${className}`, 'data-testid': 'accommodations-tab' },

    // Header Toolbar
    h(
      'div',
      { className: 'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border-subtle' },
      h(
        'div',
        null,
        h('h3', { className: 'text-base font-bold text-text-main' }, 'Danh Sách Địa Điểm Lưu Trú & Phòng'),
        h(
          'p',
          { className: 'text-xs text-text-muted mt-0.5' },
          'Quản lý danh sách khách ở xa, phân bổ phòng khách sạn và thời gian lưu trú'
        )
      ),

      isOwner &&
        onAddAssignment &&
        h(
          Button,
          {
            type: 'button',
            variant: 'primary',
            onClick: onAddAssignment,
            className: 'text-xs h-9 flex items-center gap-1.5 self-start sm:self-auto',
          },
          h(Plus, { className: 'w-3.5 h-3.5' }),
          'Phân phòng mới'
        )
    ),

    // Accommodations List
    accommodations.map((acc) => {
      const assignedRooms = roomAssignments.filter((ra) => ra.accommodationId === acc.id);

      return h(
        'div',
        {
          key: acc.id,
          'data-testid': `accommodation-card-${acc.id}`,
          className: 'bg-surface border border-border-subtle rounded-card shadow-sm p-4 space-y-4',
        },

        // Accommodation Header
        h(
          'div',
          { className: 'flex flex-col sm:flex-row sm:items-start justify-between gap-2 border-b border-border-subtle pb-3' },
          h(
            'div',
            { className: 'space-y-1' },
            h(
              'div',
              { className: 'flex items-center gap-2' },
              h(Hotel, { className: 'w-4 h-4 text-primary shrink-0' }),
              h('h4', { className: 'font-bold text-sm text-text-main' }, acc.name)
            ),
            acc.locationAddress &&
              h(
                'div',
                { className: 'flex items-center gap-1 text-xs text-text-muted' },
                h(MapPin, { className: 'w-3 h-3 shrink-0' }),
                acc.locationAddress
              ),
            // Contact Phone: Owner only per AT03/AT26
            isOwner &&
              acc.contactPhone &&
              h(
                'div',
                { className: 'flex items-center gap-1 text-xs text-text-muted' },
                h(Phone, { className: 'w-3 h-3 shrink-0' }),
                `Lễ tân: ${acc.contactPhone}`
              ),
            // Private notes: Owner only per AT03/AT26
            isOwner &&
              acc.notes &&
              h(
                'div',
                { className: 'flex items-center gap-1 text-xs text-[#B45309] italic' },
                h(FileText, { className: 'w-3 h-3 shrink-0' }),
                acc.notes
              )
          ),

          // Total rooms / Occupancy badge
          h(
            'div',
            { className: 'text-xs px-2.5 py-1 rounded-control bg-[#FAF9F5] border border-border-subtle font-semibold text-text-main self-start sm:self-auto' },
            `Đã xếp ${assignedRooms.length} / ${acc.totalRooms} phòng`
          )
        ),

        // Assigned Rooms List
        h(
          'div',
          { className: 'space-y-2' },
          h('h5', { className: 'text-xs font-bold uppercase tracking-wider text-text-muted' }, 'Danh Sách Phân Phòng:'),
          assignedRooms.length === 0
            ? h(
                'p',
                { className: 'text-xs text-text-muted italic py-2' },
                'Chưa có khách nào được phân phòng tại địa điểm này.'
              )
            : h(
                'div',
                { className: 'grid grid-cols-1 md:grid-cols-2 gap-3' },
                assignedRooms.map((ra) =>
                  h(
                    'div',
                    {
                      key: ra.id,
                      'data-testid': `room-assignment-${ra.id}`,
                      className:
                        'p-3 bg-[#FAF9F5] border border-border-subtle rounded-control flex items-start justify-between gap-2 text-xs',
                    },
                    h(
                      'div',
                      { className: 'space-y-1' },
                      h('p', { className: 'font-bold text-text-main text-xs' }, ra.roomNumber),
                      h(
                        'p',
                        { className: 'font-semibold text-primary flex items-center gap-1' },
                        h(User, { className: 'w-3 h-3' }),
                        ra.guestName
                      ),
                      // Check-in / out dates
                      (ra.checkInDate || ra.checkOutDate) &&
                        h(
                          'p',
                          { className: 'text-text-muted flex items-center gap-1 text-[11px]' },
                          h(Calendar, { className: 'w-3 h-3' }),
                          `Lưu trú: ${ra.checkInDate || '?'} - ${ra.checkOutDate || '?'}`
                        ),
                      // Sensitive fields: Owner only per AT03/AT26
                      isOwner &&
                        ra.guestPhone &&
                        h(
                          'p',
                          { className: 'text-text-muted flex items-center gap-1 text-[11px]' },
                          h(Phone, { className: 'w-3 h-3' }),
                          ra.guestPhone
                        ),
                      isOwner &&
                        ra.notes &&
                        h(
                          'p',
                          { className: 'text-[#B45309] italic text-[11px]' },
                          ra.notes
                        )
                    ),

                    // Unassign room button: Owner only
                    isOwner &&
                      onDeleteAssignment &&
                      h(
                        'button',
                        {
                          type: 'button',
                          onClick: () => onDeleteAssignment(ra.id),
                          className:
                            'text-text-muted hover:text-danger p-1 rounded hover:bg-danger-bg shrink-0',
                          title: 'Gỡ phân phòng',
                        },
                        h(Trash2, { className: 'w-3.5 h-3.5' })
                      )
                  )
                )
              )
        )
      );
    })
  );
};
