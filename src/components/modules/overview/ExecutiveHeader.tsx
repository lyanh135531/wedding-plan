'use client';

import * as React from 'react';
import { useRole } from '@/context/RoleContext';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Plus, UserPlus, DollarSign, CheckSquare, CalendarDays } from 'lucide-react';

const h = React.createElement;

export interface ExecutiveHeaderProps {
  coupleNames?: string;
  weddingDateNote?: string;
  onQuickAddGuest?: () => void;
  onQuickAddCost?: () => void;
  onQuickAddTask?: () => void;
}

export const ExecutiveHeader: React.FC<ExecutiveHeaderProps> = ({
  coupleNames = 'Minh & Linh',
  weddingDateNote = 'Dự kiến sau Tết âm lịch 2028',
  onQuickAddGuest,
  onQuickAddCost,
  onQuickAddTask,
}) => {
  const { isOwner, isFamily } = useRole();
  const [menuOpen, setMenuOpen] = React.useState(false);

  return h(
    'div',
    {
      className:
        'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 pb-7 border-b border-border-subtle mb-6',
    },
    h(
      'div',
      { className: 'min-w-0' },
      h('p', { className: 'eyebrow mb-3' }, 'Hành trình ngày chung đôi'),
      h(
        'div',
        { className: 'flex items-center gap-2.5 flex-wrap' },
        h(
          'h1',
          { className: 'text-[28px] sm:text-[36px] font-serif font-medium text-primary-luxury tracking-tight break-words' },
          coupleNames
        ),
        isFamily &&
          h(
            StatusBadge,
            { variant: 'warning', text: 'Chỉ xem' }
          )
      ),
      h(
        'p',
        { className: 'text-sm text-text-muted mt-1 flex items-center gap-2' },
        h(CalendarDays, { className: 'w-3.5 h-3.5 text-accent', strokeWidth: 1.5, 'aria-hidden': true }),
        h('span', null, weddingDateNote)
      )
    ),

    // Quick Add Menu (Strictly Owner Only)
    isOwner &&
      h(
        'div',
        { className: 'relative' },
        h(
          Button,
          {
            variant: 'primary',
            className: 'bg-accent hover:bg-accent-hover text-white',
            leftIcon: h(Plus, { className: 'w-4 h-4' }),
            onClick: () => setMenuOpen(!menuOpen),
            'aria-expanded': menuOpen,
            'aria-haspopup': true,
          },
          'Thêm nhanh'
        ),

        menuOpen &&
          h(
            'div',
            {
              className:
                'absolute right-0 mt-2 w-48 bg-surface border border-border-control rounded-card shadow-lg py-1.5 z-20',
              role: 'menu',
            },
            h(
              'button',
              {
                className:
                  'w-full text-left px-3.5 py-2 text-sm text-text-main hover:bg-page flex items-center gap-2.5',
                role: 'menuitem',
                onClick: () => {
                  setMenuOpen(false);
                  onQuickAddGuest?.();
                },
              },
              h(UserPlus, { className: 'w-4 h-4 text-accent' }),
              'Thêm khách mời'
            ),
            h(
              'button',
              {
                className:
                  'w-full text-left px-3.5 py-2 text-sm text-text-main hover:bg-page flex items-center gap-2.5',
                role: 'menuitem',
                onClick: () => {
                  setMenuOpen(false);
                  onQuickAddCost?.();
                },
              },
              h(DollarSign, { className: 'w-4 h-4 text-accent' }),
              'Thêm khoản chi'
            ),
            h(
              'button',
              {
                className:
                  'w-full text-left px-3.5 py-2 text-sm text-text-main hover:bg-page flex items-center gap-2.5',
                role: 'menuitem',
                onClick: () => {
                  setMenuOpen(false);
                  onQuickAddTask?.();
                },
              },
              h(CheckSquare, { className: 'w-4 h-4 text-accent' }),
              'Thêm công việc'
            )
          )
      )
  );
};
