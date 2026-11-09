import * as React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const h = React.createElement;

export interface ToastMessage {
  id: string;
  title?: string;
  message: string;
  variant?: 'success' | 'info' | 'warning' | 'danger';
  durationMs?: number;
}

export interface ToastProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  const { id, title, message, variant = 'info', durationMs = 5000 } = toast;

  React.useEffect(() => {
    if (durationMs > 0) {
      const timer = setTimeout(() => {
        onDismiss(id);
      }, durationMs);
      return () => clearTimeout(timer);
    }
  }, [id, durationMs, onDismiss]);

  const icons = {
    info: h(Info, { className: 'w-5 h-5 text-info shrink-0' }),
    success: h(CheckCircle, { className: 'w-5 h-5 text-success shrink-0' }),
    warning: h(AlertTriangle, { className: 'w-5 h-5 text-warning shrink-0' }),
    danger: h(AlertCircle, { className: 'w-5 h-5 text-danger shrink-0' }),
  };

  const borders = {
    info: 'border-info/40 bg-surface',
    success: 'border-success/40 bg-surface',
    warning: 'border-warning/40 bg-surface',
    danger: 'border-danger/40 bg-surface',
  };

  return h(
    'div',
    {
      role: 'status',
      'aria-live': 'polite',
      className: cn(
        'w-full max-w-sm p-4 rounded-card border shadow-overlay flex items-start gap-3',
        'animate-in fade-in slide-in-from-bottom-2 duration-150',
        borders[variant]
      ),
    },
    h('span', { className: 'shrink-0 mt-0.5' }, icons[variant]),
    h(
      'div',
      { className: 'flex-1 flex flex-col gap-0.5 text-sm' },
      title && h('h5', { className: 'font-semibold text-text-main' }, title),
      h('p', { className: 'text-text-muted leading-relaxed' }, message)
    ),
    h(
      'button',
      {
        type: 'button',
        onClick: () => onDismiss(id),
        'aria-label': 'Đóng thông báo',
        className:
          'p-1 -mr-1 -mt-1 rounded-full text-text-muted hover:text-text-main hover:bg-black/5 transition-colors focus-visible:outline-2 focus-visible:outline-focus',
      },
      h(X, { className: 'w-4 h-4' })
    )
  );
};
