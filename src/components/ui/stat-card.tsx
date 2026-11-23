import * as React from 'react';
import { AlertTriangle, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const h = React.createElement;

export interface StatCardProps {
  label: string;
  value: string | number | null;
  unit?: string;
  scopeDescription?: string;
  status?: 'ready' | 'provisional' | 'empty';
  provisionalNote?: string;
  href?: string;
  onClick?: () => void;
  icon?: React.ReactNode;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  unit,
  scopeDescription,
  status = 'ready',
  provisionalNote,
  href,
  onClick,
  icon,
  className,
}) => {
  const isClickable = Boolean(href || onClick);
  const isEmpty = value === null || status === 'empty';
  const isProvisional = status === 'provisional';

  const cardContent = h(
    'div',
    {
      className: cn(
        'stat-card p-6 rounded-card bg-surface border border-border-subtle shadow-card flex flex-col justify-between transition-all duration-200',
        isClickable &&
          'hover:border-primary/40 hover:shadow-card-elevated cursor-pointer focus-visible:outline-2 focus-visible:outline-focus',
        className
      ),
      onClick,
      role: isClickable && !href ? 'button' : undefined,
      tabIndex: isClickable && !href ? 0 : undefined,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (isClickable && !href && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick?.();
        }
      },
    },
    // Top Header: Label, Icon, Link arrow
    h(
      'div',
      { className: 'flex items-start justify-between gap-2 mb-2' },
      h('span', { className: 'text-sm font-medium text-text-muted select-none' }, label),
      h(
        'div',
        { className: 'flex items-center gap-1.5 text-text-muted' },
        icon && h('span', { className: 'inline-flex shrink-0' }, icon),
        isClickable &&
          h(ArrowUpRight, { className: 'w-4 h-4 shrink-0 text-text-muted/60' })
      )
    ),
    // Main Metric Value
    h(
      'div',
      { className: 'my-1 flex items-baseline gap-1.5 flex-wrap' },
      isEmpty
        ? h(
            'div',
            { className: 'flex items-baseline gap-2' },
            h(
              'span',
              { className: 'stat-value text-2xl font-medium text-text-muted/50 tabular-nums' },
              '—'
            ),
            h('span', { className: 'text-xs text-text-muted font-normal' }, 'Chưa có dữ liệu')
          )
        : h(
            React.Fragment,
            null,
            h(
              'span',
              {
                className:
                  'stat-value text-2xl font-medium text-text-main tabular-nums tracking-tight',
              },
              value
            ),
            unit && h('span', { className: 'text-sm font-medium text-text-muted' }, unit)
          )
    ),
    // Bottom Status / Provisional Warning / Description
    h(
      'div',
      { className: 'mt-2 flex flex-col gap-1 min-h-[20px]' },
      isProvisional &&
        h(
          'div',
          {
            className:
              'inline-flex items-center gap-1.5 text-xs font-medium text-warning bg-warning-bg px-2 py-0.5 rounded w-fit',
          },
          h(AlertTriangle, { className: 'w-3.5 h-3.5 shrink-0' }),
          h('span', null, provisionalNote || 'Tạm tính — còn khoản thiếu giá')
        ),
      scopeDescription &&
        !isProvisional &&
        h('span', { className: 'text-xs text-text-muted' }, scopeDescription)
    )
  );

  if (href) {
    return h(
      'a',
      { href, className: 'block focus-visible:outline-2 focus-visible:outline-focus rounded-card' },
      cardContent
    );
  }

  return cardContent;
};
