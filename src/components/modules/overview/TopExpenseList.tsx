'use client';

import * as React from 'react';
import Link from 'next/link.js';
import { useRole } from '@/context/RoleContext';
import { formatVND } from '@/lib/utils';
import { DollarSign, ArrowRight } from 'lucide-react';

const h = React.createElement;

export interface ExpenseItem {
  id: string;
  name: string;
  category: string;
  amount: bigint;
  status: 'contracted' | 'settled' | 'estimated';
}

export const DEFAULT_TOP_EXPENSES: ExpenseItem[] = [
  { id: 'exp-1', name: 'Tiệc cưới trọn gói & Đồ uống', category: 'Tiệc cưới', amount: 180000000n, status: 'contracted' },
  { id: 'exp-2', name: 'Gói chụp ảnh pre-wedding & phóng sự', category: 'Chụp ảnh', amount: 35000000n, status: 'contracted' },
  { id: 'exp-3', name: 'Trang trí gia tiên hoa tươi 2 nhà', category: 'Trang trí', amount: 20000000n, status: 'contracted' },
  { id: 'exp-4', name: 'Áo cưới Hoàng Gia (Đã hủy & phạt)', category: 'Trang phục', amount: 1500000n, status: 'settled' },
];

export interface TopExpenseListProps {
  items?: ExpenseItem[];
}

export const TopExpenseList: React.FC<TopExpenseListProps> = ({
  items = DEFAULT_TOP_EXPENSES,
}) => {
  const { isOwner } = useRole();

  // Strictly hidden from Family View
  if (!isOwner) {
    return null;
  }

  return h(
    'div',
    { className: 'bg-surface border border-border-subtle rounded-card shadow-sm p-5 text-text-main' },
    h(
      'div',
      { className: 'flex items-center justify-between border-b border-border-subtle pb-3 mb-3' },
      h(
        'div',
        { className: 'flex items-center gap-2' },
        h(DollarSign, { className: 'w-5 h-5 text-primary' }),
        h('h3', { className: 'text-sm font-bold text-text-main' }, 'Các khoản chi lớn nhất')
      ),
      h(
        Link,
        {
          href: '/budget',
          className: 'text-xs text-primary hover:underline font-medium flex items-center gap-1',
        },
        'Chi tiết ngân sách',
        h(ArrowRight, { className: 'w-3 h-3' })
      )
    ),

    h(
      'div',
      { className: 'divide-y divide-border-subtle' },
      items.length === 0 && h('p', { className: 'py-7 text-xs text-text-muted text-center' }, 'Những khoản chi sẽ được tổng hợp tại đây.'),
      items.map((item) =>
        h(
          'div',
          {
            key: item.id,
            className: 'py-2.5 flex items-center justify-between gap-3 text-sm',
          },
          h(
            'div',
            { className: 'min-w-0 flex-1' },
            h('p', { className: 'font-medium text-text-main truncate' }, item.name),
            h('p', { className: 'text-xs text-text-muted mt-0.5' }, item.category)
          ),
          h(
            'div',
            { className: 'text-right shrink-0' },
            h(
              'span',
              { className: 'font-semibold text-text-main tabular-nums' },
              formatVND(item.amount)
            )
          )
        )
      )
    )
  );
};
