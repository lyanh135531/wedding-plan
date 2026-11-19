'use client';

import * as React from 'react';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatVND } from '@/lib/utils';
import { PlusCircle, DollarSign, AlertCircle } from 'lucide-react';

const h = React.createElement;

export interface CostItemRow {
  id: string;
  name: string;
  category: string;
  contractedAmount: bigint | null;
  paidAmount: bigint;
  status: 'draft' | 'contracted' | 'settled' | 'cancelled';
  isMissingPrice: boolean;
}

export interface CostItemsTableProps {
  items: CostItemRow[];
  onRecordPayment?: (item: CostItemRow) => void;
  onItemClick?: (id: string) => void;
}

export const CostItemsTable: React.FC<CostItemsTableProps> = ({
  items,
  onRecordPayment,
  onItemClick,
}) => {
  return h(
    'div',
    { className: 'w-full overflow-x-auto bg-surface border border-border-subtle rounded-card shadow-sm' },
    h(
      'table',
      { className: 'w-full text-left border-collapse text-sm', 'aria-label': 'Danh sách các khoản chi ngân sách' },
      h(
        'thead',
        { className: 'bg-page border-b border-border-subtle text-xs font-semibold uppercase text-text-muted select-none' },
        h(
          'tr',
          null,
          h('th', { className: 'px-4 py-3.5' }, 'Khoản chi / Dịch vụ'),
          h('th', { className: 'px-4 py-3.5' }, 'Danh mục'),
          h('th', { className: 'px-4 py-3.5 text-right' }, 'Giá chốt / Dự toán'),
          h('th', { className: 'px-4 py-3.5 text-right' }, 'Đã thanh toán'),
          h('th', { className: 'px-4 py-3.5 text-right' }, 'Còn phải trả'),
          h('th', { className: 'px-4 py-3.5' }, 'Trạng thái'),
          h('th', { className: 'px-4 py-3.5 text-right' }, 'Thao tác')
        )
      ),

      h(
        'tbody',
        { className: 'divide-y divide-border-subtle' },
        items.map((item) => {
          const remaining = item.contractedAmount !== null
            ? (item.contractedAmount - item.paidAmount > 0n ? item.contractedAmount - item.paidAmount : 0n)
            : null;

          return h(
            'tr',
            {
              key: item.id,
              className: 'hover:bg-page/70 transition-colors',
            },
            // Name
            h(
              'td',
              { className: 'px-4 py-3 font-medium text-text-main' },
              h(
                'button',
                {
                  type: 'button',
                  onClick: () => onItemClick?.(item.id),
                  className: 'text-left font-semibold text-text-main hover:text-primary hover:underline block',
                },
                item.name
              )
            ),

            // Category
            h(
              'td',
              { className: 'px-4 py-3 text-text-muted text-xs' },
              item.category
            ),

            // Contracted Amount (or Thiếu giá badge)
            h(
              'td',
              { className: 'px-4 py-3 text-right tabular-nums' },
              item.contractedAmount !== null
                ? h('span', { className: 'font-semibold text-text-main' }, formatVND(item.contractedAmount))
                : h(
                    'span',
                    {
                      className:
                        'inline-flex items-center gap-1 text-xs font-medium text-[#D97706] bg-[#FFF8E1] px-2 py-0.5 rounded',
                    },
                    h(AlertCircle, { className: 'w-3 h-3 shrink-0' }),
                    'Thiếu giá'
                  )
            ),

            // Paid
            h(
              'td',
              { className: 'px-4 py-3 text-right tabular-nums font-medium text-[#2E7D32]' },
              formatVND(item.paidAmount)
            ),

            // Remaining
            h(
              'td',
              { className: 'px-4 py-3 text-right tabular-nums font-semibold text-text-main' },
              remaining !== null ? formatVND(remaining) : '—'
            ),

            // Status
            h(
              'td',
              { className: 'px-4 py-3' },
              item.status === 'settled' && h(StatusBadge, { variant: 'success', text: 'Đã tất toán' }),
              item.status === 'contracted' && h(StatusBadge, { variant: 'info', text: 'Đã ký HĐ' }),
              item.status === 'draft' && h(StatusBadge, { variant: 'warning', text: 'Dự toán' }),
              item.status === 'cancelled' && h(StatusBadge, { variant: 'danger', text: 'Đã hủy dịch vụ' })
            ),

            // Action
            h(
              'td',
              { className: 'px-4 py-3 text-right' },
              h(
                'button',
                {
                  type: 'button',
                  onClick: () => onRecordPayment?.(item),
                  className:
                    'inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline px-2 py-1 rounded hover:bg-primary/5',
                },
                h(DollarSign, { className: 'w-3.5 h-3.5' }),
                'Chi tiền'
              )
            )
          );
        })
      )
    )
  );
};
