import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const h = React.createElement;

export interface ModalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
  className?: string;
}

export const ModalDialog: React.FC<ModalDialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 'md',
  showCloseButton = true,
  className,
}) => {
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const previouslyFocusedElementRef = React.useRef<HTMLElement | null>(null);

  const titleId = React.useId();
  const descriptionId = React.useId();

  React.useEffect(() => {
    if (isOpen) {
      previouslyFocusedElementRef.current = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';

      const timer = setTimeout(() => {
        if (dialogRef.current) {
          // The user may already be typing by the time the opening timer fires.
          // Never steal focus from an input inside this dialog.
          if (dialogRef.current.contains(document.activeElement)) return;
          const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (focusable.length > 0) {
            focusable[0].focus({ preventScroll: true });
          } else {
            dialogRef.current.focus({ preventScroll: true });
          }
        }
      }, 50);

      return () => {
        clearTimeout(timer);
        document.body.style.overflow = '';
        previouslyFocusedElementRef.current?.focus({ preventScroll: true });
      };
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }

    if (e.key === 'Tab' && dialogRef.current) {
      const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;

      const firstElement = focusables[0];
      const lastElement = focusables[focusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    }
  };

  if (!isOpen) return null;

  const maxWidthStyles = {
    sm: 'max-w-md sm:max-w-lg',
    md: 'max-w-lg sm:max-w-[600px]',
    lg: 'max-w-2xl sm:max-w-3xl',
    xl: 'max-w-4xl sm:max-w-5xl',
    full: 'max-w-[calc(100%-2rem)]',
  };

  return h(
    'div',
    {
      role: 'presentation',
      className:
        'app-overlay fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150',
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
    },
    h(
      'div',
      {
        ref: dialogRef,
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': titleId,
        'aria-describedby': description ? descriptionId : undefined,
        tabIndex: -1,
        onClick: (e: React.MouseEvent) => e.stopPropagation(),
        onKeyDown: handleKeyDown,
        className: cn(
          'w-full bg-surface border border-border-control rounded-card shadow-overlay flex flex-col max-h-[90vh] overflow-hidden',
          'animate-in zoom-in-95 duration-150',
          maxWidthStyles[maxWidth],
          className
        ),
      },
      // Header
      h(
        'div',
        {
          className:
            'shrink-0 px-7 py-5 sm:px-8 sm:py-5.5 border-b border-[#ECE7DC] flex items-center justify-between gap-4 bg-gradient-to-b from-[#FFFDF9] via-[#FAF8F3] to-[#F5F2EA]/70',
        },
        h(
          'div',
          { className: 'flex flex-col min-w-0 pr-2' },
          h('h2', { id: titleId, className: 'text-xl sm:text-[22px] font-serif font-medium text-primary-luxury tracking-tight leading-snug' }, title),
          description &&
            h('p', { id: descriptionId, className: 'text-xs sm:text-[13px] text-text-muted mt-1 leading-relaxed' }, description)
        ),
        showCloseButton &&
          h(
            'button',
            {
              type: 'button',
              onClick: onClose,
              'aria-label': 'Đóng hộp thoại',
              className:
                'min-h-[36px] min-w-[36px] h-9 w-9 inline-flex items-center justify-center rounded-full text-text-muted hover:text-text-main hover:bg-[#173C33]/8 transition-colors focus-visible:outline-2 focus-visible:outline-focus shrink-0',
            },
            h(X, { className: 'w-4 h-4' })
          )
      ),
      // Content
      h('div', { className: 'dialog-scroll min-h-0 p-6 sm:p-8 overflow-y-auto overscroll-contain flex-1' }, children),
      // Sticky Footer
      footer &&
        h(
          'div',
          {
            className:
              'shrink-0 px-7 py-4 sm:px-8 sm:py-4.5 border-t border-[#ECE7DC] bg-[#FAF8F3] flex items-center justify-end gap-3 rounded-b-card',
          },
          footer
        )
    )
  );
};

export const Dialog = ModalDialog;
