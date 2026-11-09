'use client';

import * as React from 'react';
import Link from 'next/link.js';
import { CheckCircle2, ArrowRight } from 'lucide-react';

const h = React.createElement;

export interface TaskProgressSummaryProps {
  completedCount?: number;
  totalCount?: number;
}

export const TaskProgressSummary: React.FC<TaskProgressSummaryProps> = ({
  completedCount = 14,
  totalCount = 32,
}) => {
  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return h(
    'div',
    { className: 'bg-surface border border-border-subtle rounded-card shadow-sm p-5 text-text-main' },
    h(
      'div',
      { className: 'flex items-center justify-between mb-3' },
      h(
        'div',
        { className: 'flex items-center gap-2' },
        h(CheckCircle2, { className: 'w-5 h-5 text-primary' }),
        h('h3', { className: 'text-sm font-bold text-text-main' }, 'Tiến độ hoàn thành công việc')
      ),
      h(
        Link,
        {
          href: '/tasks',
          className: 'text-xs text-primary hover:underline font-medium flex items-center gap-1',
        },
        'Chi tiết',
        h(ArrowRight, { className: 'w-3 h-3' })
      )
    ),

    h(
      'div',
      { className: 'flex items-baseline justify-between mb-2' },
      h(
        'span',
        { className: 'text-2xl font-bold tabular-nums text-text-main' },
        `${percentage}%`
      ),
      h(
        'span',
        { className: 'text-xs text-text-muted tabular-nums' },
        `Đã xong ${completedCount} / ${totalCount} việc`
      )
    ),

    // Progress Bar
    h(
      'div',
      {
        className: 'w-full h-2.5 bg-border-subtle rounded-full overflow-hidden',
        role: 'progressbar',
        'aria-valuenow': percentage,
        'aria-valuemin': 0,
        'aria-valuemax': 100,
        'aria-label': `Tiến độ công việc ${percentage}%`,
      },
      h('div', {
        className: 'h-full bg-primary transition-all duration-300 rounded-full',
        style: { width: `${percentage}%` },
      })
    )
  );
};
