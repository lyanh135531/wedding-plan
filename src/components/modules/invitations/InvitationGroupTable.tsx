'use client';

import * as React from 'react';
import { StatusBadge } from '@/components/ui/status-badge';
import { Check, Mail, Send, FileText } from 'lucide-react';

const h = React.createElement;

export interface InvitationGroupItem {
  id: string;
  cardName: string;
  deliveryMethod: 'paper' | 'electronic' | 'in_person';
  status: 'save_the_date' | 'preparing' | 'sent';
  sentDate: string | null;
  senderName?: string | null;
  memberNames: string[];
}

export interface InvitationGroupTableProps {
  invitations: InvitationGroupItem[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
}

export const InvitationGroupTable: React.FC<InvitationGroupTableProps> = ({
  invitations,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
}) => {
  const allSelected = invitations.length > 0 && selectedIds.length === invitations.length;

  const deliveryMethodMap: Record<string, { label: string; icon: any }> = {
    paper: { label: 'Thiệp giấy', icon: FileText },
    electronic: { label: 'Thiệp điện tử', icon: Mail },
    in_person: { label: 'Trao tận tay', icon: Send },
  };

  const statusBadgeMap: Record<string, { variant: 'success' | 'warning' | 'info'; text: string }> = {
    sent: { variant: 'success', text: 'Đã gửi' },
    preparing: { variant: 'warning', text: 'Đang chuẩn bị' },
    save_the_date: { variant: 'info', text: 'Save The Date' },
  };

  return h(
    'div',
    { className: 'w-full overflow-x-auto bg-surface border border-border-subtle rounded-card shadow-sm' },
    h(
      'table',
      { className: 'w-full text-left border-collapse text-sm', 'aria-label': 'Danh sách nhóm thiệp mời' },
      h(
        'thead',
        { className: 'bg-page border-b border-border-subtle text-xs font-semibold uppercase text-text-muted select-none' },
        h(
          'tr',
          null,
          h(
            'th',
            { className: 'w-12 px-4 py-3.5' },
            h(
              'button',
              {
                type: 'button',
                onClick: onToggleSelectAll,
                className:
                  'w-5 h-5 rounded border border-border-control flex items-center justify-center bg-surface hover:border-primary',
                'aria-label': allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả',
              },
              allSelected && h(Check, { className: 'w-3.5 h-3.5 stroke-[3] text-primary' })
            )
          ),
          h('th', { className: 'px-4 py-3.5' }, 'Tên thiệp / Hộ nhận'),
          h('th', { className: 'px-4 py-3.5' }, 'Thành viên nhận thiệp'),
          h('th', { className: 'px-4 py-3.5' }, 'Hình thức'),
          h('th', { className: 'px-4 py-3.5' }, 'Tiến độ chuyển phát'),
          h('th', { className: 'px-4 py-3.5' }, 'Ngày gửi')
        )
      ),

      h(
        'tbody',
        { className: 'divide-y divide-border-subtle' },
        invitations.map((inv) => {
          const isSelected = selectedIds.includes(inv.id);
          const delivery = deliveryMethodMap[inv.deliveryMethod] || { label: 'Khác', icon: FileText };
          const DeliveryIcon = delivery.icon;
          const statusInfo = statusBadgeMap[inv.status] || { status: 'info', label: 'Chưa rõ' };

          return h(
            'tr',
            {
              key: inv.id,
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
                  onClick: () => onToggleSelect(inv.id),
                  className: `w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                    isSelected ? 'bg-primary border-primary text-white' : 'border-border-control bg-surface'
                  }`,
                  'aria-label': `Chọn thiệp ${inv.cardName}`,
                },
                isSelected && h(Check, { className: 'w-3.5 h-3.5 stroke-[3]' })
              )
            ),

            // Card name
            h(
              'td',
              { className: 'px-4 py-3 font-semibold text-text-main' },
              inv.cardName
            ),

            // Members
            h(
              'td',
              { className: 'px-4 py-3 text-text-muted' },
              h('span', { className: 'text-text-main font-medium' }, `${inv.memberNames.length} người:`),
              h('p', { className: 'text-xs text-text-muted mt-0.5' }, inv.memberNames.join(', '))
            ),

            // Method
            h(
              'td',
              { className: 'px-4 py-3 text-text-muted' },
              h(
                'span',
                { className: 'flex items-center gap-1.5 text-xs' },
                h(DeliveryIcon, { className: 'w-3.5 h-3.5 text-text-muted' }),
                delivery.label
              )
            ),

            // Status
            h(
              'td',
              { className: 'px-4 py-3' },
              h(StatusBadge, { variant: statusInfo.variant, text: statusInfo.text })
            ),

            // Sent Date
            h(
              'td',
              { className: 'px-4 py-3 text-text-muted text-xs' },
              inv.sentDate
                ? h('span', { className: 'font-mono' }, `${inv.sentDate} (${inv.senderName || 'Đã gửi'})`)
                : h('span', { className: 'italic text-text-muted/60' }, 'Chưa gửi')
            )
          );
        })
      )
    )
  );
};
