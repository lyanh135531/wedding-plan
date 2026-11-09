'use client';

import * as React from 'react';
import { useRole } from '@/context/RoleContext';
import { StatusBadge } from '@/components/ui/status-badge';
import { MoreVertical, Check, Phone, Utensils } from 'lucide-react';

const h = React.createElement;

export interface GuestItemDisplay {
  id: string;
  displayName: string;
  side: 'groom' | 'bride' | 'mutual' | 'unassigned';
  groupName: string;
  ageTier: 'adult' | 'child' | 'baby';
  phone?: string | null;
  rsvpStatus: 'not_contacted' | 'pending_reply' | 'tentative' | 'accepted' | 'declined';
  needsSeat: boolean;
  needsMeal: boolean;
  mealDietaryTier?: string;
  tableName?: string | null;
  isRepresentative?: boolean;
}

export interface GuestCardMobileProps {
  guest: GuestItemDisplay;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  onClickCard?: (id: string) => void;
  onQuickRsvp?: (id: string, status: 'accepted' | 'declined') => void;
}

export const GuestCardMobile: React.FC<GuestCardMobileProps> = ({
  guest,
  isSelected = false,
  onSelect,
  onClickCard,
  onQuickRsvp,
}) => {
  const { isFamily } = useRole();

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

  const rsvp = rsvpBadgeMap[guest.rsvpStatus] || { variant: 'info', text: 'Chưa rõ' };

  // Mask private phone for Family View
  const displayPhone = isFamily
    ? guest.phone ? '***-***-****' : null
    : guest.phone;

  return h(
    'div',
    {
      className: `w-full min-h-[64px] p-3.5 bg-surface border rounded-card shadow-sm flex items-start gap-3 transition-colors ${
        isSelected ? 'border-primary bg-primary/5' : 'border-border-subtle hover:border-border-control'
      }`,
    },
    // Checkbox selector (min 44x44px touch target)
    onSelect &&
      h(
        'button',
        {
          type: 'button',
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            onSelect(guest.id);
          },
          className:
            'w-11 h-11 -ml-1 -mt-1 flex items-center justify-center shrink-0 text-text-muted hover:text-primary focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]',
          'aria-label': `Chọn khách ${guest.displayName}`,
        },
        h(
          'div',
          {
            className: `w-5 h-5 rounded border flex items-center justify-center ${
              isSelected ? 'bg-primary border-primary text-white' : 'border-[#7A8881] bg-white'
            }`,
          },
          isSelected && h(Check, { className: 'w-3.5 h-3.5 stroke-[3]' })
        )
      ),

    // Main Card Body (Clickable to open detail sheet)
    h(
      'div',
      {
        className: 'flex-1 min-w-0 cursor-pointer',
        onClick: () => onClickCard?.(guest.id),
      },
      // Name and side badge
      h(
        'div',
        { className: 'flex items-baseline justify-between gap-2 mb-1 flex-wrap' },
        h(
          'div',
          { className: 'flex items-center gap-1.5 min-w-0' },
          h('span', { className: 'text-base font-bold text-text-main truncate' }, guest.displayName),
          guest.isRepresentative &&
            h(
              'span',
              { className: 'text-[11px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0' },
              'Đại diện'
            )
        ),
        h(StatusBadge, { variant: rsvp.variant, text: rsvp.text, className: 'shrink-0' })
      ),

      // Group and side tag
      h(
        'div',
        { className: 'flex items-center gap-2 text-xs text-text-muted flex-wrap mb-1.5' },
        h('span', { className: 'font-medium text-text-main' }, guest.groupName),
        h('span', null, '•'),
        h('span', null, sideLabelMap[guest.side]),
        guest.tableName && h('span', null, '•'),
        guest.tableName && h('span', { className: 'font-semibold text-primary' }, `Bàn: ${guest.tableName}`)
      ),

      // Contact & dietary info
      h(
        'div',
        { className: 'flex items-center gap-3 text-xs text-text-muted' },
        displayPhone &&
          h(
            'span',
            { className: 'flex items-center gap-1' },
            h(Phone, { className: 'w-3 h-3 text-text-muted/70' }),
            displayPhone
          ),
        guest.mealDietaryTier && guest.mealDietaryTier !== 'regular' &&
          h(
            'span',
            { className: 'flex items-center gap-1 text-[#D97706]' },
            h(Utensils, { className: 'w-3 h-3' }),
            guest.mealDietaryTier === 'vegetarian' ? 'Ăn chay' : 'Khẩu phần trẻ em'
          )
      )
    ),

    // Quick Actions Menu button
    h(
      'button',
      {
        type: 'button',
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          onClickCard?.(guest.id);
        },
        className:
          'w-11 h-11 -mr-1 -mt-1 flex items-center justify-center text-text-muted hover:text-text-main shrink-0',
        'aria-label': 'Tùy chọn khách mời',
      },
      h(MoreVertical, { className: 'w-4 h-4' })
    )
  );
};
