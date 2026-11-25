import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const h = React.createElement;

export interface DrawerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  width?: 'md' | 'lg' | 'xl';
  side?: 'right' | 'left' | 'bottom';
  className?: string;
}

export const DrawerSheet: React.FC<DrawerSheetProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'md',
  side = 'right',
  className,
}) => {
  const sheetRef = React.useRef<HTMLDivElement>(null);
  const previouslyFocusedElementRef = React.useRef<HTMLElement | null>(null);

  const titleId = React.useId();
  const descriptionId = React.useId();

  React.useEffect(() => {
    if (isOpen) {
      previouslyFocusedElementRef.current = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';

      const timer = setTimeout(() => {
        sheetRef.current?.focus();
      }, 50);

      return () => {
        clearTimeout(timer);
        document.body.style.overflow = '';
        previouslyFocusedElementRef.current?.focus();
      };
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    }
  };

  if (!isOpen) return null;

  const widthStyles = {
    md: 'md:max-w-[480px]',
    lg: 'md:max-w-[560px]',
    xl: 'md:max-w-[640px]',
  };

  return h(
    'div',
    {
      role: 'presentation',
      className:
        'app-overlay fixed inset-0 z-50 flex justify-end animate-in fade-in duration-150',
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
    },
    h(
      'div',
      {
        ref: sheetRef,
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': titleId,
        'aria-describedby': description ? descriptionId : undefined,
        tabIndex: -1,
        onClick: (e: React.MouseEvent) => e.stopPropagation(),
        onKeyDown: handleKeyDown,
        className: cn(
          'w-full h-full bg-surface border-l border-border-control shadow-overlay flex flex-col',
          'animate-in slide-in-from-right duration-150',
          widthStyles[width],
          className
        ),
      },
      // Header
      h(
        'div',
        {
          className:
            'px-6 py-4.5 border-b border-border-subtle/80 flex items-start justify-between gap-4 shrink-0 bg-[#FFFEFA]',
        },
        h(
          'div',
          { className: 'flex flex-col' },
          h('h2', { id: titleId, className: 'text-lg font-serif font-medium text-primary-luxury tracking-tight' }, title),
          description &&
            h('p', { id: descriptionId, className: 'text-xs text-text-muted mt-1 leading-relaxed' }, description)
        ),
        h(
          'button',
          {
            type: 'button',
            onClick: onClose,
            'aria-label': 'Đóng bảng điều hướng',
            className:
              'min-h-[40px] min-w-[40px] h-10 w-10 -mr-2 -mt-1 inline-flex items-center justify-center rounded-full text-text-muted hover:text-text-main hover:bg-[#173C33]/5 transition-colors focus-visible:outline-2 focus-visible:outline-focus',
          },
          h(X, { className: 'w-4.5 h-4.5' })
        )
      ),
      // Content
      h('div', { className: 'dialog-scroll flex-1 p-6 overflow-y-auto overscroll-contain' }, children),
      // Footer
      footer &&
        h(
          'div',
          { className: 'px-6 py-3.5 border-t border-border-subtle/80 bg-[#FAF9F5] shrink-0' },
          footer
        )
    )
  );
};

export const Sheet = DrawerSheet;
