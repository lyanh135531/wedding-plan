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
      ? h(SearchX, { className: 'w-10 h-10 text-text-muted/60' })
      : h(FolderPlus, { className: 'w-10 h-10 text-primary/70' });

  return h(
    'div',
    {
      className: cn(
        'w-full py-12 px-6 flex flex-col items-center justify-center text-center rounded-card bg-surface border border-dashed border-border-control/60 shadow-sm',
        className
      ),
    },
    h(
      'div',
      {
        className:
          'w-16 h-16 rounded-full bg-[#FAF9F5] border border-border-subtle flex items-center justify-center mb-4',
      },
      icon || defaultIcon
    ),
    h('h3', { className: 'text-lg font-semibold text-text-main mb-1.5' }, title),
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
