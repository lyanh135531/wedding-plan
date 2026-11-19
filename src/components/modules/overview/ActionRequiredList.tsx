'use client';

import * as React from 'react';
import Link from 'next/link.js';
import { useRole } from '@/context/RoleContext';
import { StatusBadge } from '@/components/ui/status-badge';
import { AlertTriangle, Clock, ArrowRight, DollarSign } from 'lucide-react';

const h = React.createElement;

export interface ActionItem {
  id: string;
  type: 'overdue_task' | 'urgent_payment' | 'missing_price';
  title: string;
  subtitle: string;
  badgeText: string;
  badgeStatus: 'danger' | 'warning' | 'info';
  href: string;
  isFinancial?: boolean;
}

export const DEFAULT_ACTION_ITEMS: ActionItem[] = [
  {
    id: 'act-1',
    type: 'overdue_task',
    title: 'Chốt danh sách khách mời Nhà Gái đợt 1',
    subtitle: 'Quá hạn 2 ngày • Người phụ trách: Cô dâu',
    badgeText: 'Quá hạn',
    badgeStatus: 'danger',
    href: '/tasks',
    isFinancial: false,
  },
  {
    id: 'act-2',
    type: 'urgent_payment',
    title: 'Thanh toán đợt 2: Tiền đặt cọc Trung tâm tiệc cưới',
    subtitle: 'Hạn chót: Trong 3 ngày tới • Số tiền: 40.000.000 ₫',
    badgeText: 'Cần chi',
    badgeStatus: 'warning',
    href: '/payments',
    isFinancial: true,
  },
  {
    id: 'act-3',
    type: 'missing_price',
    title: 'Hợp đồng ban nhạc acoustic & hòa tấu',
    subtitle: 'Chưa nhập giá chốt hợp đồng • Đang để trống',
    badgeText: 'Thiếu giá',
    badgeStatus: 'warning',
    href: '/budget',
    isFinancial: true,
  },
];

export interface ActionRequiredListProps {
  items?: ActionItem[];
}

export const ActionRequiredList: React.FC<ActionRequiredListProps> = ({
  items = DEFAULT_ACTION_ITEMS,
}) => {
  const { isOwner } = useRole();

  // If Family View, filter out financial items
  const visibleItems = isOwner ? items : items.filter((i) => !i.isFinancial);

  return h(
    'div',
    {
      className:
        'bg-surface border border-border-subtle rounded-card shadow-sm p-5 flex flex-col justify-between h-full',
    },
    h(
      'div',
      null,
      h(
        'div',
        { className: 'flex items-center justify-between border-b border-border-subtle pb-3 mb-4' },
        h(
          'div',
          { className: 'flex items-center gap-2' },
          h(AlertTriangle, { className: 'w-5 h-5 text-warning' }),
          h('h2', { className: 'text-base font-bold text-text-main' }, 'Cần xử lý ngay'),
          h(
            'span',
            {
              className:
                'text-xs font-semibold px-2 py-0.5 rounded-full bg-danger-bg text-danger tabular-nums',
            },
            visibleItems.length
          )
        ),
        h(
          Link,
          {
            href: '/tasks',
            className: 'text-xs text-primary hover:underline font-medium flex items-center gap-1',
          },
          'Xem tất cả',
          h(ArrowRight, { className: 'w-3 h-3' })
        )
      ),

      visibleItems.length === 0
        ? h(
            'div',
            { className: 'py-8 text-center text-sm text-text-muted' },
            'Chưa có công việc quá hạn hoặc cần xử lý gấp.'
          )
        : h(
            'div',
            { className: 'space-y-3' },
            visibleItems.map((item) =>
              h(
                Link,
                {
                  key: item.id,
                  href: item.href,
                  className:
                    'p-3 rounded-control border border-border-subtle hover:border-border-control transition-colors bg-page flex items-center justify-between gap-3 group block',
                },
                h(
                  'div',
                  { className: 'flex items-start gap-2.5 min-w-0' },
                  item.isFinancial
                    ? h(DollarSign, { className: 'w-4 h-4 text-primary shrink-0 mt-0.5' })
                    : h(Clock, { className: 'w-4 h-4 text-danger shrink-0 mt-0.5' }),
                  h(
                    'div',
                    { className: 'min-w-0' },
                    h(
                      'p',
                      {
                        className:
                          'text-sm font-semibold text-text-main group-hover:text-primary truncate transition-colors',
                      },
                      item.title
                    ),
                    h('p', { className: 'text-xs text-text-muted mt-0.5' }, item.subtitle)
                  )
                ),
                h(StatusBadge, {
                  variant: item.badgeStatus,
                  text: item.badgeText,
                  className: 'shrink-0',
                })
              )
            )
          )
    )
  );
};
