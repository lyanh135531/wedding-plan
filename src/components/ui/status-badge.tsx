import * as React from 'react';
import { cn } from '@/lib/utils';

const h = React.createElement;

export interface StatusBadgeProps {
  text: string;
  variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  icon?: React.ReactNode;
  size?: 'sm' | 'default';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  text,
  variant,
  icon,
  size = 'default',
  className,
}) => {
  const variantStyles = {
    success: 'bg-success-bg text-success border-success/20',
    warning: 'bg-warning-bg text-warning border-warning/20',
    danger: 'bg-danger-bg text-danger border-danger/20',
    info: 'bg-info-bg text-info border-info/20',
    neutral: 'bg-[#EAE8E1] text-text-muted border-border-subtle',
  };

  const sizeStyles = {
    default: 'px-2.5 py-1 text-xs gap-1.5',
    sm: 'px-2 py-0.5 text-[11px] gap-1',
  };

  return h(
    'span',
    {
      className: cn(
        'inline-flex items-center font-medium rounded-full border select-none w-fit shrink-0',
        variantStyles[variant],
        sizeStyles[size],
        className
      ),
    },
    icon && h('span', { className: 'inline-flex shrink-0', 'aria-hidden': 'true' }, icon),
    h('span', null, text)
  );
};
