import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';

const h = React.createElement;

export interface StickyActionBarProps {
  onSave: () => void;
  onCancel: () => void;
  saveLabel?: string;
  cancelLabel?: string;
  isSaving?: boolean;
  isDirty?: boolean;
  extraActions?: React.ReactNode;
  className?: string;
}

export const StickyActionBar: React.FC<StickyActionBarProps> = ({
  onSave,
  onCancel,
  saveLabel = 'Lưu thay đổi',
  cancelLabel = 'Hủy bỏ',
  isSaving = false,
  isDirty = true,
  extraActions,
  className,
}) => {
  return h(
    'div',
    {
      role: 'region',
      'aria-label': 'Thanh tác vụ cố định',
      className: cn(
        'fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-md border-t border-border-subtle shadow-overlay',
        'p-4 pb-[max(1rem,env(safe-area-inset-bottom))]',
        className
      ),
    },
    h(
      'div',
      { className: 'max-w-7xl mx-auto flex items-center justify-between gap-4' },
      h('div', { className: 'flex items-center gap-2' }, extraActions),
      h(
        'div',
        { className: 'flex items-center gap-3' },
        h(
          Button,
          {
            type: 'button',
            variant: 'secondary',
            onClick: onCancel,
            disabled: isSaving,
          },
          cancelLabel
        ),
        h(
          Button,
          {
            type: 'button',
            variant: 'primary',
            size: 'lg',
            onClick: onSave,
            loading: isSaving,
            disabled: !isDirty || isSaving,
            loadingText: 'Đang lưu...',
          },
          saveLabel
        )
      )
    )
  );
};
