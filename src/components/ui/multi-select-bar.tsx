import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

const h = React.createElement;

export interface BatchAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  onClick: (selectedIds: string[]) => void;
}

export interface MultiSelectBarProps {
  selectedIds: string[];
  totalInView?: number;
  totalMatching?: number;
  actions: BatchAction[];
  onSelectAllMatching?: () => void;
  onClearSelection: () => void;
  isAllMatchingSelected?: boolean;
  unitLabel?: string;
  className?: string;
}

export const MultiSelectBar: React.FC<MultiSelectBarProps> = ({
  selectedIds,
  totalInView,
  totalMatching,
  actions,
  onSelectAllMatching,
  onClearSelection,
  isAllMatchingSelected = false,
  unitLabel = 'người',
  className,
}) => {
  if (selectedIds.length === 0) {
    return null;
  }

  const selectedCount = selectedIds.length;
  const canSelectAllMatching =
    Boolean(onSelectAllMatching) &&
    totalMatching !== undefined &&
    totalMatching > selectedCount &&
    !isAllMatchingSelected;

  return h(
    'div',
    {
      role: 'toolbar',
      'aria-label': 'Thanh tác vụ hàng loạt',
      className: cn(
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-40',
        'w-[calc(100%-2rem)] max-w-3xl p-3 sm:p-4',
        'bg-surface/95 backdrop-blur-md border border-border-control rounded-card shadow-overlay',
        'flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-4 duration-150',
        className
      ),
    },
    // Left info
    h(
      'div',
      { className: 'flex items-center gap-2 sm:gap-3 flex-wrap' },
      h(
        'button',
        {
          type: 'button',
          onClick: onClearSelection,
          'aria-label': 'Hủy chọn tất cả',
          className:
            'p-1 rounded-full text-text-muted hover:text-text-main hover:bg-black/5 transition-colors focus-visible:outline-2 focus-visible:outline-focus',
        },
        h(X, { className: 'w-5 h-5' })
      ),
      h(
        'div',
        { className: 'text-sm' },
        h(
          'span',
          { className: 'font-semibold text-text-main tabular-nums' },
          `Đã chọn ${selectedCount} ${unitLabel}`
        ),
        totalInView !== undefined &&
          h(
            'span',
            { className: 'text-xs text-text-muted ml-1 hidden sm:inline' },
            '(trên trang này)'
          )
      ),
      canSelectAllMatching &&
        h(
          'button',
          {
            type: 'button',
            onClick: onSelectAllMatching,
            className:
              'text-xs font-semibold text-primary underline hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-focus rounded ml-1',
          },
          `Chọn toàn bộ ${totalMatching} ${unitLabel} khớp bộ lọc`
        ),
      isAllMatchingSelected &&
        h(
          'span',
          { className: 'text-xs font-medium text-success bg-success-bg px-2 py-0.5 rounded' },
          `Đã chọn toàn bộ ${totalMatching} ${unitLabel}`
        )
    ),
    // Right actions
    h(
      'div',
      { className: 'flex items-center gap-2 flex-wrap w-full sm:w-auto justify-end' },
      actions.map((act) =>
        h(
          Button,
          {
            key: act.id,
            variant: act.variant ?? 'secondary',
            size: 'sm',
            onClick: () => act.onClick(selectedIds),
            leftIcon: act.icon,
          },
          act.label
        )
      )
    )
  );
};
