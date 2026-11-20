import * as React from 'react';
import { Filter, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

const h = React.createElement;

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterField {
  id: string;
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
}

export interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchPlaceholder?: string;
  filters?: FilterField[];
  onResetFilters?: () => void;
  activeFilterCount?: number;
  className?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Tìm kiếm...',
  filters = [],
  onResetFilters,
  activeFilterCount = 0,
  className,
}) => {
  return h(
    'div',
    {
      className: cn(
        'w-full flex flex-col md:flex-row items-stretch md:items-center gap-3 p-3 bg-surface rounded-card border border-border-subtle shadow-sm',
        className
      ),
    },
    // Search Input
    h(
      'div',
      { className: 'relative flex-1 flex items-center' },
      h(Search, {
        className: 'w-4 h-4 text-text-muted absolute left-3 pointer-events-none',
      }),
      h('input', {
        type: 'text',
        value: searchQuery,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => onSearchChange(e.target.value),
        placeholder: searchPlaceholder,
        'aria-label': searchPlaceholder,
        className:
          'w-full h-11 pl-10 pr-9 text-base md:text-sm bg-page border border-border-control rounded-control focus-visible:outline-2 focus-visible:outline-focus placeholder:text-text-muted/60',
      }),
      searchQuery &&
        h(
          'button',
          {
            type: 'button',
            onClick: () => onSearchChange(''),
            'aria-label': 'Xóa từ khóa tìm kiếm',
            className: 'absolute right-3 p-1 text-text-muted hover:text-text-main',
          },
          h(X, { className: 'w-4 h-4' })
        )
    ),
    // Desktop Dropdowns
    h(
      'div',
      { className: 'hidden md:flex items-center gap-2' },
      filters.map((filter) =>
        h(
          'select',
          {
            key: filter.id,
            'aria-label': filter.label,
            value: filter.value,
            onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
              filter.onChange(e.target.value),
            className:
              'h-11 px-3 text-sm bg-surface border border-border-control rounded-control text-text-main focus-visible:outline-2 focus-visible:outline-focus cursor-pointer',
          },
          filter.options.map((opt) =>
            h('option', { key: opt.value, value: opt.value }, opt.label)
          )
        )
      ),
      activeFilterCount > 0 &&
        onResetFilters &&
        h(
          Button,
          { variant: 'ghost', size: 'sm', onClick: onResetFilters },
          'Xóa bộ lọc'
        )
    ),
    // Mobile active filter
    h(
      'div',
      {
        className:
          'md:hidden flex items-center justify-between text-xs text-text-muted px-1',
      },
      h(
        'div',
        { className: 'flex items-center gap-1.5' },
        h(Filter, { className: 'w-3.5 h-3.5' }),
        h('span', null, `Bộ lọc đang áp dụng: ${activeFilterCount}`)
      ),
      activeFilterCount > 0 &&
        onResetFilters &&
        h(
          'button',
          {
            type: 'button',
            onClick: onResetFilters,
            className: 'text-primary font-semibold underline',
          },
          'Đặt lại'
        )
    )
  );
};
