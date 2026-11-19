import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  loading?: boolean;
  loadingText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'default',
      loading = false,
      loadingText,
      leftIcon,
      rightIcon,
      disabled,
      children,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center gap-0.5 font-medium rounded-control transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-50 disabled:cursor-not-allowed select-none min-h-[44px] min-w-[44px] tracking-[-0.01em]';

    const variants = {
      primary: 'bg-primary text-white border border-primary hover:bg-primary-hover hover:border-primary-hover active:bg-primary-hover shadow-[0_2px_5px_rgba(23,60,51,0.08)]',
      secondary: 'bg-surface text-primary border border-border-subtle hover:bg-page hover:border-border-control active:bg-page',
      ghost: 'text-text-main hover:bg-black/5 active:bg-black/10',
      danger: 'bg-danger text-white hover:bg-[#911C13] active:bg-[#72150E]',
    };

    const sizes = {
      default: 'h-11 px-4 py-2 text-sm',
      sm: 'h-11 px-3 py-1.5 text-sm',
      lg: 'h-12 px-6 py-3 text-base',
      icon: 'h-11 w-11 p-2',
    };

    const isDisabled = disabled || loading;

    const content: React.ReactNode[] = [];
    if (loading) {
      content.push(
        React.createElement(Loader2, {
          key: 'spinner',
          className: 'w-4 h-4 animate-spin mr-2 shrink-0',
          'aria-hidden': 'true',
        }),
        React.createElement('span', { key: 'txt' }, loadingText ?? children ?? 'Đang lưu...')
      );
    } else {
      if (leftIcon) {
        content.push(
          React.createElement('span', { key: 'left', className: 'mr-2 inline-flex shrink-0' }, leftIcon)
        );
      }
      if (children !== undefined && children !== null) {
        content.push(children);
      }
      if (rightIcon) {
        content.push(
          React.createElement('span', { key: 'right', className: 'ml-2 inline-flex shrink-0' }, rightIcon)
        );
      }
    }

    return React.createElement(
      'button',
      {
        ref,
        type,
        disabled: isDisabled,
        'aria-busy': loading ? 'true' : undefined,
        className: cn(baseStyles, variants[variant], sizes[size], className),
        ...props,
      },
      ...content
    );
  }
);

Button.displayName = 'Button';
