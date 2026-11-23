import * as React from 'react';
import { FolderPlus, SearchX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

const h = React.createElement;

export interface EmptyStateProps {
  type?: 'no_data' | 'no_filter_match';
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  };
  icon?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  type = 'no_data',
  title,
  description,
  action,
  icon,
  className,
}) => {
  const defaultIcon =
    type === 'no_filter_match'
      ? h(SearchX, { className: 'w-7 h-7 text-text-muted/70', strokeWidth: 1.5 })
      : h(FolderPlus, { className: 'w-7 h-7 text-[#BFA16E]', strokeWidth: 1.5 });

  return h(
    'div',
    {
      className: cn(
        'w-full py-12 px-6 flex flex-col items-center justify-center text-center rounded-card bg-gradient-to-b from-surface via-surface to-page/40 border border-dashed border-[#DCD9CE] shadow-card',
        className
      ),
    },
    h(
      'div',
      {
        className:
          'w-16 h-16 rounded-2xl bg-amber-50/70 border border-amber-200/50 flex items-center justify-center mb-4 shadow-xs',
      },
      icon || defaultIcon
    ),
    h('h3', { className: 'text-lg font-serif font-medium text-primary-luxury mb-1.5 tracking-tight' }, title),
    h(
      'p',
      { className: 'text-sm text-text-muted max-w-md leading-relaxed mb-6' },
      description
    ),
    action &&
      h(
        Button,
        {
          variant: action.variant || (type === 'no_data' ? 'primary' : 'secondary'),
          onClick: action.onClick,
        },
        action.label
      )
  );
};
