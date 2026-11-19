'use client';

import * as React from 'react';
import { Search, X, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VendorServiceType, VendorStatus } from '@/schemas/vendors';
import { SERVICE_TYPE_LABELS, STATUS_CONFIG } from './constants';

export interface VendorFilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  serviceTypeFilter: string;
  onServiceTypeChange: (type: string) => void;
  statusFilter: string;
  onStatusChange: (status: string) => void;
  onClearFilters: () => void;
  totalFilteredCount?: number;
}

export const VendorFilterBar: React.FC<VendorFilterBarProps> = ({
  searchQuery,
  onSearchChange,
  serviceTypeFilter,
  onServiceTypeChange,
  statusFilter,
  onStatusChange,
  onClearFilters,
  totalFilteredCount,
}) => {
  const [localSearch, setLocalSearch] = React.useState(searchQuery);

  // Debounce search update 300ms
  React.useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== searchQuery) {
        onSearchChange(localSearch);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch, searchQuery, onSearchChange]);

  const hasActiveFilters = Boolean(
    searchQuery.trim() || serviceTypeFilter || statusFilter
  );

  return React.createElement(
    'div',
    {
      className:
        'bg-surface rounded-card p-4 border border-border-subtle shadow-sm mb-6 space-y-3',
      role: 'search',
      'aria-label': 'Bộ lọc tìm kiếm nhà cung cấp',
    },
    React.createElement(
      'div',
      { className: 'flex flex-col md:flex-row gap-3 items-stretch md:items-center' },
      // Search Input
      React.createElement(
        'div',
        { className: 'relative flex-1' },
        React.createElement(Search, {
          className:
            'absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted/70 pointer-events-none',
          'aria-hidden': 'true',
        }),
        React.createElement('input', {
          type: 'text',
          value: localSearch,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            setLocalSearch(e.target.value),
          placeholder: 'Tìm theo tên nhà cung cấp, liên hệ, SĐT...',
          className:
            'w-full pl-10 pr-10 py-2.5 bg-page border border-border-control rounded-control text-base text-text-main placeholder:text-text-muted/60 focus:outline-2 focus:outline-offset-2 focus:outline-focus min-h-[44px]',
          'aria-label': 'Tìm kiếm nhà cung cấp',
        }),
        localSearch &&
          React.createElement(
            'button',
            {
              type: 'button',
              onClick: () => {
                setLocalSearch('');
                onSearchChange('');
              },
              className:
                'absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-main rounded-full',
              'aria-label': 'Xóa từ khóa tìm kiếm',
            },
            React.createElement(X, { className: 'w-4 h-4', 'aria-hidden': 'true' })
          )
      ),

      // Service Type Select
      React.createElement(
        'div',
        { className: 'w-full md:w-56 shrink-0' },
        React.createElement(
          'select',
          {
            value: serviceTypeFilter,
            onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
              onServiceTypeChange(e.target.value),
            className:
              'w-full py-2.5 px-3 bg-page border border-border-control rounded-control text-base text-text-main focus:outline-2 focus:outline-offset-2 focus:outline-focus min-h-[44px]',
            'aria-label': 'Lọc theo loại dịch vụ',
          },
          React.createElement('option', { value: '' }, 'Tất cả dịch vụ'),
          (Object.keys(SERVICE_TYPE_LABELS) as VendorServiceType[]).map((key) =>
            React.createElement(
              'option',
              { key, value: key },
              SERVICE_TYPE_LABELS[key]
            )
          )
        )
      ),

      // Status Select
      React.createElement(
        'div',
        { className: 'w-full md:w-48 shrink-0' },
        React.createElement(
          'select',
          {
            value: statusFilter,
            onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
              onStatusChange(e.target.value),
            className:
              'w-full py-2.5 px-3 bg-page border border-border-control rounded-control text-base text-text-main focus:outline-2 focus:outline-offset-2 focus:outline-focus min-h-[44px]',
            'aria-label': 'Lọc theo trạng thái hợp đồng',
          },
          React.createElement('option', { value: '' }, 'Tất cả trạng thái'),
          (Object.keys(STATUS_CONFIG) as VendorStatus[]).map((key) =>
            React.createElement(
              'option',
              { key, value: key },
              STATUS_CONFIG[key].label
            )
          )
        )
      ),

      // Clear Filters Button
      hasActiveFilters &&
        React.createElement(
          Button,
          {
            variant: 'ghost',
            onClick: onClearFilters,
            className: 'text-text-muted hover:text-danger shrink-0 min-h-[44px]',
            leftIcon: React.createElement(X, { className: 'w-4 h-4', 'aria-hidden': 'true' }),
          },
          'Xóa bộ lọc'
        )
    ),

    // Filter status summary indicator
    hasActiveFilters &&
      React.createElement(
        'div',
        { className: 'flex items-center gap-2 pt-1 text-xs text-text-muted' },
        React.createElement(Filter, { className: 'w-3.5 h-3.5 text-primary', 'aria-hidden': 'true' }),
        React.createElement(
          'span',
          null,
          'Đang lọc theo tiêu chí — ',
          totalFilteredCount !== undefined &&
            React.createElement(
              'strong',
              { className: 'text-text-main' },
              `${totalFilteredCount} kết quả phù hợp`
            )
        )
      )
  );
};
