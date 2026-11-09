import * as React from 'react';
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

const h = React.createElement;

export interface ErrorStateProps {
  title?: string;
  message: string;
  requestId?: string;
  onRetry?: () => void;
  onBack?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Đã xảy ra lỗi tải dữ liệu',
  message,
  requestId,
  onRetry,
  onBack,
  className,
}) => {
  return h(
    'div',
    {
      role: 'alert',
      className: cn(
        'w-full py-12 px-6 flex flex-col items-center justify-center text-center rounded-card bg-surface border border-danger/30 shadow-sm',
        className
      ),
    },
    h(
      'div',
      {
        className:
          'w-16 h-16 rounded-full bg-danger-bg text-danger flex items-center justify-center mb-4',
      },
      h(AlertTriangle, { className: 'w-8 h-8' })
    ),
    h('h3', { className: 'text-lg font-semibold text-text-main mb-2' }, title),
    h(
      'p',
      { className: 'text-sm text-text-muted max-w-md leading-relaxed mb-4' },
      message
    ),
    requestId &&
      h(
        'p',
        {
          className:
            'text-xs font-mono text-text-muted/70 bg-black/5 px-2.5 py-1 rounded mb-6',
        },
        `Mã yêu cầu: ${requestId}`
      ),
    h(
      'div',
      { className: 'flex items-center gap-3' },
      onBack &&
        h(
          Button,
          {
            variant: 'secondary',
            onClick: onBack,
            leftIcon: h(ArrowLeft, { className: 'w-4 h-4' }),
          },
          'Quay lại'
        ),
      onRetry &&
        h(
          Button,
          {
            variant: 'primary',
            onClick: onRetry,
            leftIcon: h(RefreshCw, { className: 'w-4 h-4' }),
          },
          'Thử lại'
        )
    )
  );
};
