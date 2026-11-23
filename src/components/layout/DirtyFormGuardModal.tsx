'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';

export interface DirtyFormGuardModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  message?: string;
}

export const DirtyFormGuardModal: React.FC<DirtyFormGuardModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  title = 'Biểu mẫu chưa lưu',
  message = 'Dữ liệu bạn vừa nhập chưa được lưu. Nếu chuyển phạm vi buổi lễ ngay bây giờ, các thay đổi chưa lưu sẽ bị hủy bỏ hoàn toàn. Bạn có chắc chắn muốn bỏ thay đổi?',
}) => {
  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const h = React.createElement;

  return h(
    'div',
    {
      className: 'fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'dirty-guard-title',
      'aria-describedby': 'dirty-guard-desc',
    },
    // Backdrop
    h('div', {
      className: 'app-overlay fixed inset-0 transition-opacity',
      onClick: onCancel,
      'aria-hidden': 'true',
    }),
    // Dialog Card
    h(
      'div',
      {
        className:
          'relative bg-surface rounded-card max-w-md sm:max-w-lg w-full shadow-overlay border border-border-control z-10 overflow-hidden animate-in zoom-in-95 duration-150',
      },
      h(
        'div',
        { className: 'p-6' },
        h(
          'div',
          { className: 'flex items-start gap-4' },
          h(
            'div',
            {
              className:
                'w-10 h-10 rounded-full bg-[#FFF8E1] text-[#854D0E] flex items-center justify-center shrink-0 border border-[#FDE68A]',
            },
            h(AlertTriangle, { className: 'w-5 h-5 text-[#854D0E]', 'aria-hidden': 'true' })
          ),
          h(
            'div',
            { className: 'flex-1' },
            h('h3', { id: 'dirty-guard-title', className: 'text-lg font-serif font-medium text-primary-luxury tracking-tight mb-2' }, title),
            h('p', { id: 'dirty-guard-desc', className: 'text-sm text-text-muted leading-relaxed' }, message)
          )
        )
      ),
      // Sticky Action Buttons
      h(
        'div',
        { className: 'px-6 py-3.5 border-t border-border-subtle/80 bg-[#FAF9F5] flex items-center justify-end gap-3' },
        h(
          'button',
          {
            type: 'button',
            onClick: onCancel,
            className:
              'px-4 py-2 border border-border-control text-text-main text-sm font-medium rounded-control hover:bg-page min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-[#1D4ED8] focus:ring-offset-2',
          },
          'Ở lại biểu mẫu'
        ),
        h(
          'button',
          {
            type: 'button',
            onClick: onConfirm,
            className:
              'px-4 py-2 bg-[#B42318] text-white text-sm font-medium rounded-control hover:bg-[#912015] min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-[#1D4ED8] focus:ring-offset-2 shadow-xs active:scale-[0.99]',
          },
          'Bỏ thay đổi & Chuyển buổi'
        )
      )
    )
  );
};
