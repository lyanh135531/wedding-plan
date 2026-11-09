'use client';

import * as React from 'react';
import { Users, UserCheck, HelpCircle, UserX } from 'lucide-react';

const h = React.createElement;

export interface GuestCountersBarProps {
  totalInvited: number;
  acceptedCount: number;
  pendingCount: number;
  declinedCount: number;
  confirmedSeats: number;
}

export const GuestCountersBar: React.FC<GuestCountersBarProps> = ({
  totalInvited = 100,
  acceptedCount = 68,
  pendingCount = 24,
  declinedCount = 8,
  confirmedSeats = 65,
}) => {
  return h(
    'div',
    {
      className:
        'grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 p-4 bg-surface border border-border-subtle rounded-card shadow-sm',
      'aria-label': 'Thống kê phản hồi tham dự của khách mời',
    },
    // Total Invited
    h(
      'div',
      { className: 'flex items-center gap-3 p-2' },
      h(
        'div',
        { className: 'w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0' },
        h(Users, { className: 'w-5 h-5' })
      ),
      h(
        'div',
        null,
        h('span', { className: 'text-xs text-text-muted block' }, 'Đã mời'),
        h('span', { className: 'text-xl font-bold text-text-main tabular-nums' }, totalInvited),
        h('span', { className: 'text-xs text-text-muted ml-1' }, 'người')
      )
    ),

    // Accepted
    h(
      'div',
      { className: 'flex items-center gap-3 p-2' },
      h(
        'div',
        { className: 'w-10 h-10 rounded-full bg-[#E8F5E9] text-[#2E7D32] flex items-center justify-center shrink-0' },
        h(UserCheck, { className: 'w-5 h-5' })
      ),
      h(
        'div',
        null,
        h('span', { className: 'text-xs text-[#2E7D32] font-medium block' }, 'Sẽ tham dự'),
        h('span', { className: 'text-xl font-bold text-[#2E7D32] tabular-nums' }, acceptedCount),
        h('span', { className: 'text-xs text-text-muted ml-1' }, `(${confirmedSeats} ghế)`)
      )
    ),

    // Pending
    h(
      'div',
      { className: 'flex items-center gap-3 p-2' },
      h(
        'div',
        { className: 'w-10 h-10 rounded-full bg-[#FFF8E1] text-[#D97706] flex items-center justify-center shrink-0' },
        h(HelpCircle, { className: 'w-5 h-5' })
      ),
      h(
        'div',
        null,
        h('span', { className: 'text-xs text-[#D97706] font-medium block' }, 'Chưa phản hồi'),
        h('span', { className: 'text-xl font-bold text-[#D97706] tabular-nums' }, pendingCount),
        h('span', { className: 'text-xs text-text-muted ml-1' }, 'người')
      )
    ),

    // Declined
    h(
      'div',
      { className: 'flex items-center gap-3 p-2' },
      h(
        'div',
        { className: 'w-10 h-10 rounded-full bg-danger-bg text-danger flex items-center justify-center shrink-0' },
        h(UserX, { className: 'w-5 h-5' })
      ),
      h(
        'div',
        null,
        h('span', { className: 'text-xs text-danger font-medium block' }, 'Không tham dự'),
        h('span', { className: 'text-xl font-bold text-danger tabular-nums' }, declinedCount),
        h('span', { className: 'text-xs text-text-muted ml-1' }, 'người')
      )
    )
  );
};
