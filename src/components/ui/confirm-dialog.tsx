import * as React from 'react';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { ModalDialog } from './dialog';
import { Button } from './button';

const h = React.createElement;

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Bỏ qua',
  variant = 'danger',
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  const cancelButtonRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        cancelButtonRef.current?.focus({ preventScroll: true });
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const icons = {
    danger: h(AlertCircle, { className: 'w-6 h-6 text-danger shrink-0' }),
    warning: h(AlertTriangle, { className: 'w-6 h-6 text-warning shrink-0' }),
    primary: h(Info, { className: 'w-6 h-6 text-primary shrink-0' }),
  };

  const buttonVariant = variant === 'danger' ? 'danger' : 'primary';

  return h(
    ModalDialog,
    {
      isOpen,
      onClose: onCancel,
      title,
      maxWidth: 'sm',
      showCloseButton: !isLoading,
      footer: h(
        'div',
        { className: 'flex items-center justify-end gap-3 w-full' },
        h(
          Button,
          {
            ref: cancelButtonRef,
            type: 'button',
            variant: 'secondary',
            onClick: onCancel,
            disabled: isLoading,
          },
          cancelLabel
        ),
        h(
          Button,
          {
            type: 'button',
            variant: buttonVariant,
            onClick: onConfirm,
            loading: isLoading,
            loadingText: 'Đang xử lý...',
          },
          confirmLabel
        )
      ),
    },
    h(
      'div',
      { className: 'flex items-start gap-4 py-1' },
      icons[variant],
      h(
        'div',
        { className: 'text-sm text-text-muted leading-relaxed flex-1' },
        description
      )
    )
  );
};
