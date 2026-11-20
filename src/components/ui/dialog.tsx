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
            focusable[0].focus();
          } else {
            dialogRef.current.focus();
          }
        }
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
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[calc(100%-2rem)]',
  };

  return h(
    'div',
    {
      role: 'presentation',
      className:
        'app-overlay fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150',
      onClick: onClose,
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
            'shrink-0 px-6 py-5 border-b border-border-subtle flex items-start justify-between gap-4',
        },
        h(
          'div',
          { className: 'flex flex-col' },
          h('h2', { id: titleId, className: 'text-lg font-semibold text-text-main' }, title),
          description &&
            h('p', { id: descriptionId, className: 'text-sm text-text-muted mt-1' }, description)
        ),
        showCloseButton &&
          h(
            'button',
            {
              type: 'button',
              onClick: onClose,
              'aria-label': 'Đóng hộp thoại',
              className:
                'min-h-[44px] min-w-[44px] h-11 w-11 -mr-2 -mt-2 inline-flex items-center justify-center rounded-full text-text-muted hover:text-text-main hover:bg-black/5 transition-colors focus-visible:outline-2 focus-visible:outline-focus',
            },
            h(X, { className: 'w-5 h-5' })
          )
      ),
      // Content
      h('div', { className: 'dialog-scroll min-h-0 p-6 overflow-y-auto overscroll-contain' }, children)
    )
  );
};

export const Dialog = ModalDialog;
