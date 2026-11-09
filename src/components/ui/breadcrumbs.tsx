import * as React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const h = React.createElement;

export interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  separator?: React.ReactNode;
  className?: string;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  items,
  separator,
  className,
}) => {
  if (!items || items.length === 0) return null;

  const defaultSeparator =
    separator ||
    h(ChevronRight, {
      className: 'w-4 h-4 text-text-muted/60',
      'aria-hidden': 'true',
    });

  return h(
    'nav',
    {
      role: 'navigation',
      'aria-label': 'Breadcrumb',
      className: cn('flex items-center text-sm', className),
    },
    h(
      'ol',
      { className: 'flex items-center flex-wrap gap-1.5 list-none p-0 m-0' },
      items.map((item, index) => {
        const isLast = index === items.length - 1;
        const isCurrent = item.current || isLast;

        return h(
          'li',
          { key: `breadcrumb-${index}`, className: 'flex items-center gap-1.5' },
          index > 0 && h('span', { className: 'select-none' }, defaultSeparator),
          isCurrent
            ? h('span', { 'aria-current': 'page', className: 'font-semibold text-text-main' }, item.label)
            : item.href
            ? h(
                'a',
                {
                  href: item.href,
                  className:
                    'text-text-muted hover:text-text-main transition-colors focus-visible:outline-2 focus-visible:outline-focus rounded px-1 py-0.5',
                },
                item.label
              )
            : h('span', { className: 'text-text-muted' }, item.label)
        );
      })
    )
  );
};
