import * as React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Info, WifiOff, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const h = React.createElement;

export interface AlertProps {
  variant?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  children?: React.ReactNode;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  onClose?: () => void;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  children,
  icon,
  action,
  onClose,
  className,
}) => {
  const variantStyles = {
    info: 'bg-info-bg border-info/30 text-info',
    success: 'bg-success-bg border-success/30 text-success',
    warning: 'bg-warning-bg border-warning/30 text-warning',
    danger: 'bg-danger-bg border-danger/30 text-danger',
  };

  const defaultIcons = {
    info: h(Info, { className: 'w-5 h-5 shrink-0' }),
    success: h(CheckCircle, { className: 'w-5 h-5 shrink-0' }),
    warning: h(AlertTriangle, { className: 'w-5 h-5 shrink-0' }),
    danger: h(AlertCircle, { className: 'w-5 h-5 shrink-0' }),
  };

  return h(
    'div',
    {
      role: 'alert',
      className: cn(
        'w-full p-4 rounded-control border flex items-start gap-3',
        variantStyles[variant],
        className
      ),
    },
    h('span', { className: 'shrink-0 mt-0.5' }, icon || defaultIcons[variant]),
    h(
      'div',
      { className: 'flex-1 flex flex-col gap-1 text-sm text-text-main' },
      title && h('h4', { className: 'font-semibold' }, title),
      children && h('div', { className: 'leading-relaxed' }, children),
      action &&
        h(
          'div',
          { className: 'mt-2' },
          h(
            'button',
            {
              type: 'button',
              onClick: action.onClick,
              className:
                'text-xs font-semibold underline hover:opacity-80 focus-visible:outline-2 focus-visible:outline-focus rounded',
            },
            action.label
          )
        )
    ),
    onClose &&
      h(
        'button',
        {
          type: 'button',
          onClick: onClose,
          'aria-label': 'Đóng thông báo',
          className:
            'min-h-[44px] min-w-[44px] h-11 w-11 -mr-2 -mt-2 inline-flex items-center justify-center rounded-full text-text-muted hover:text-text-main hover:bg-black/5 transition-colors focus-visible:outline-2 focus-visible:outline-focus shrink-0',
        },
        h(X, { className: 'w-4 h-4' })
      )
  );
};

export interface SystemAlertBannerProps {
  variant: 'offline' | 'maintenance' | 'stale_data' | 'readonly';
  title?: string;
  message: string;
  actionButton?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const SystemAlertBanner: React.FC<SystemAlertBannerProps> = ({
  variant,
  title,
  message,
  actionButton,
  className,
}) => {
  const alertVariant =
    variant === 'offline' || variant === 'readonly'
      ? 'warning'
      : variant === 'maintenance'
      ? 'danger'
      : 'info';

  const defaultTitle =
    title ||
    (variant === 'offline'
      ? 'Mất kết nối mạng'
      : variant === 'readonly'
      ? 'Chế độ Chỉ Xem'
      : variant === 'maintenance'
      ? 'Hệ thống bảo trì'
      : 'Dữ liệu chưa đồng bộ');

  const bannerIcon =
    variant === 'offline' ? h(WifiOff, { className: 'w-5 h-5 shrink-0' }) : undefined;

  return h(
    'div',
    {
      role: 'alert',
      className: cn(
        'w-full py-2.5 px-4 flex items-center justify-between gap-4 font-medium text-sm',
        alertVariant === 'warning' && 'bg-warning-bg text-warning border-b border-warning/30',
        alertVariant === 'danger' && 'bg-danger-bg text-danger border-b border-danger/30',
        alertVariant === 'info' && 'bg-info-bg text-info border-b border-info/30',
        className
      ),
    },
    h(
      'div',
      { className: 'flex items-center gap-2.5' },
      bannerIcon,
      h(
        'span',
        null,
        h('strong', null, `${defaultTitle}:`),
        ` ${message}`
      )
    ),
    actionButton &&
      h(
        'button',
        {
          type: 'button',
          onClick: actionButton.onClick,
          className:
            'px-3 py-1 text-xs font-semibold rounded bg-surface border border-current hover:opacity-90 transition-opacity focus-visible:outline-2 focus-visible:outline-focus shrink-0',
        },
        actionButton.label
      )
  );
};
