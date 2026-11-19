'use client';

import * as React from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const h = React.createElement;

export interface GuestFilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedSide: string;
  onSideChange: (side: string) => void;
  selectedRsvp: string;
  onRsvpChange: (rsvp: string) => void;
  onClearFilters: () => void;
  activeFilterCount: number;
}

export const GuestFilterBar: React.FC<GuestFilterBarProps> = ({
  searchQuery,
  onSearchChange,
  selectedSide,
  onSideChange,
  selectedRsvp,
  onRsvpChange,
  onClearFilters,
  activeFilterCount,
}) => {
  return h(
    'div',
    {
      className:
        'bg-surface border border-border-subtle rounded-card p-4 mb-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shadow-sm',
    },
    // Search Box
    h(
      'div',
      { className: 'relative flex-1 min-w-[200px]' },
      h(Search, {
        className: 'w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none',
      }),
      h('input', {
        type: 'text',
        value: searchQuery,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => onSearchChange(e.target.value),
        placeholder: 'Tìm theo tên, nhóm, số điện thoại (không dấu)...',
        className:
          'w-full h-10 pl-9 pr-8 text-sm bg-surface border border-border-control rounded-control focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]',
      }),
      searchQuery &&
        h(
          'button',
          {
            onClick: () => onSearchChange(''),
            className: 'absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main p-1',
            title: 'Xóa tìm kiếm',
          },
          h(X, { className: 'w-3.5 h-3.5' })
        )
    ),

    // Filter Controls
    h(
      'div',
      { className: 'flex flex-wrap items-center gap-2' },
      // Side Select
      h(
        'select',
        {
          value: selectedSide,
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onSideChange(e.target.value),
          className:
            'h-10 px-3 text-sm bg-surface border border-border-control rounded-control focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]',
          'aria-label': 'Lọc theo bên gia đình',
        },
        h('option', { value: 'all' }, 'Tất cả bên mời'),
        h('option', { value: 'groom' }, 'Nhà trai'),
        h('option', { value: 'bride' }, 'Nhà gái'),
        h('option', { value: 'mutual' }, 'Bạn chung')
      ),

      // RSVP Status Select
      h(
        'select',
        {
          value: selectedRsvp,
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onRsvpChange(e.target.value),
          className:
            'h-10 px-3 text-sm bg-surface border border-border-control rounded-control focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]',
          'aria-label': 'Lọc theo trạng thái phản hồi',
        },
        h('option', { value: 'all' }, 'Tất cả phản hồi'),
        h('option', { value: 'accepted' }, 'Sẽ tham dự'),
        h('option', { value: 'pending_reply' }, 'Chưa phản hồi'),
        h('option', { value: 'declined' }, 'Không tham dự')
      ),

      // Reset filters button
      activeFilterCount > 0 &&
        h(
          Button,
          {
            variant: 'ghost',
            onClick: onClearFilters,
            className: 'text-xs text-[#DC2626] hover:bg-[#FEE2E2] h-10',
          },
          `Xóa bộ lọc (${activeFilterCount})`
        )
    )
  );
};
