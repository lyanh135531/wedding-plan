'use client';

import * as React from 'react';
import { useRole } from '@/context/RoleContext';
import { StatusBadge } from '@/components/ui/status-badge';
import { GuestItemDisplay } from './GuestCardMobile';
import { Check, Edit, MoreHorizontal, Phone } from 'lucide-react';

const h = React.createElement;

export interface GuestListDesktopProps {
  guests: GuestItemDisplay[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onClickGuest: (id: string) => void;
}

export const GuestListDesktop: React.FC<GuestListDesktopProps> = ({
  guests,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onClickGuest,
}) => {
  const { isFamily } = useRole();
  const allSelected = guests.length > 0 && selectedIds.length === guests.length;

  const sideLabelMap = {
    groom: 'Nhà trai',
    bride: 'Nhà gái',
    mutual: 'Bạn chung',
    unassigned: 'Chưa phân',
  };

  const rsvpBadgeMap: Record<string, { variant: 'success' | 'warning' | 'danger' | 'info'; text: string }> = {
    accepted: { variant: 'success', text: 'Sẽ tham dự' },
    pending_reply: { variant: 'warning', text: 'Chưa phản hồi' },
    not_contacted: { variant: 'info', text: 'Chưa liên hệ' },
    tentative: { variant: 'warning', text: 'Cân nhắc' },
    declined: { variant: 'danger', text: 'Không tham dự' },
  };

  return h(
    'div',
    { className: 'w-full overflow-x-auto bg-surface border border-border-subtle rounded-card shadow-sm' },
    h(
      'table',
      { className: 'w-full text-left border-collapse text-sm', 'aria-label': 'Danh sách khách mời chi tiết' },
      h(
        'thead',
        { className: 'bg-page border-b border-border-subtle text-xs font-semibold uppercase text-text-muted select-none' },
        h(
          'tr',
          null,
          // Select All Checkbox
          h(
            'th',
            { className: 'w-12 px-4 py-3.5' },
            h(
              'button',
              {
                type: 'button',
                onClick: onToggleSelectAll,
                className:
                  'w-5 h-5 rounded border border-border-control flex items-center justify-center bg-surface hover:border-primary focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]',
                'aria-label': allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả',
              },
              allSelected && h(Check, { className: 'w-3.5 h-3.5 stroke-[3] text-primary' })
            )
          ),
          h('th', { className: 'px-4 py-3.5' }, 'Họ và tên'),
          h('th', { className: 'px-4 py-3.5' }, 'Nhóm / Hộ gia đình'),
          h('th', { className: 'px-4 py-3.5' }, 'Bên mời'),
          h('th', { className: 'px-4 py-3.5' }, 'Phản hồi (RSVP)'),
          h('th', { className: 'px-4 py-3.5' }, 'Xếp bàn'),
          h('th', { className: 'px-4 py-3.5 text-right' }, 'Thao tác')
        )
      ),

      h(
        'tbody',
        { className: 'divide-y divide-border-subtle' },
        guests.map((guest) => {
          const isSelected = selectedIds.includes(guest.id);
          const rsvp = rsvpBadgeMap[guest.rsvpStatus] || { status: 'info', label: 'Chưa rõ' };
          const displayPhone = isFamily ? (guest.phone ? '***-***-****' : null) : guest.phone;

          return h(
            'tr',
            {
              key: guest.id,
              className: `hover:bg-page/70 transition-colors ${
                isSelected ? 'bg-primary/5' : ''
              }`,
            },
            // Checkbox
            h(
              'td',
              { className: 'px-4 py-3' },
              h(
                'button',
                {
                  type: 'button',
                  onClick: (e: React.MouseEvent) => {
                    e.stopPropagation();
                    onToggleSelect(guest.id);
                  },
                  className: `w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                    isSelected ? 'bg-primary border-primary text-white' : 'border-border-control bg-surface'
                  }`,
                  'aria-label': `Chọn khách ${guest.displayName}`,
                },
                isSelected && h(Check, { className: 'w-3.5 h-3.5 stroke-[3]' })
              )
            ),

            // Name
            h(
              'td',
              { className: 'px-4 py-3 font-medium text-text-main' },
              h(
                'button',
                {
                  type: 'button',
                  onClick: () => onClickGuest(guest.id),
                  className: 'text-left hover:text-primary hover:underline font-semibold flex items-center gap-2',
                },
                guest.displayName,
                guest.isRepresentative &&
                  h(
                    'span',
                    { className: 'text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded' },
                    'Đại diện'
                  )
              ),
              displayPhone &&
                h(
                  'span',
                  { className: 'text-xs text-text-muted flex items-center gap-1 mt-0.5 font-normal' },
                  h(Phone, { className: 'w-3 h-3 text-text-muted/60' }),
                  displayPhone
                )
            ),

            // Group
            h(
              'td',
              { className: 'px-4 py-3 text-text-muted' },
              h('span', { className: 'font-medium text-text-main' }, guest.groupName),
              h('span', { className: 'block text-xs text-text-muted mt-0.5' }, `Độ tuổi: ${guest.ageTier === 'adult' ? 'Người lớn' : guest.ageTier === 'child' ? 'Trẻ em' : 'Em bé'}`)
            ),

            // Side
            h(
              'td',
              { className: 'px-4 py-3 text-text-muted' },
              h(
                'span',
                { className: 'px-2 py-0.5 rounded text-xs bg-page border border-border-subtle font-medium text-text-main' },
                sideLabelMap[guest.side]
              )
            ),

            // RSVP
            h(
              'td',
              { className: 'px-4 py-3' },
              h(StatusBadge, { variant: rsvp.variant, text: rsvp.text }),
              guest.mealDietaryTier && guest.mealDietaryTier !== 'regular' &&
                h(
                  'span',
                  { className: 'block text-[11px] text-[#D97706] mt-0.5' },
                  guest.mealDietaryTier === 'vegetarian' ? 'Chế độ ăn chay' : 'Khẩu phần trẻ em'
                )
            ),

            // Table
            h(
              'td',
              { className: 'px-4 py-3 text-text-muted' },
              guest.tableName
                ? h(
                    'span',
                    { className: 'font-semibold text-primary px-2 py-0.5 rounded bg-primary/10 text-xs' },
                    `Bàn ${guest.tableName}`
                  )
                : h('span', { className: 'text-xs text-text-muted italic' }, 'Chưa xếp bàn')
            ),

            // Actions
            h(
              'td',
              { className: 'px-4 py-3 text-right' },
              h(
                'button',
                {
                  type: 'button',
                  onClick: () => onClickGuest(guest.id),
                  className: 'p-1.5 rounded hover:bg-black/5 text-text-muted hover:text-text-main',
                  title: 'Xem và sửa thông tin',
                  'aria-label': 'Xem và sửa thông tin',
                },
                h(Edit, { className: 'w-4 h-4' })
              )
            )
          );
        })
      )
    )
  );
};
