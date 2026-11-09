import * as React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const h = React.createElement;

export interface PaginationProps {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  unitLabel?: string;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100],
  unitLabel = 'người',
  className,
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const startItem = totalItems === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const endItem = totalItems === 0 ? 0 : Math.min(safeCurrentPage * pageSize, totalItems);

  const isFirstPage = safeCurrentPage <= 1;
  const isLastPage = safeCurrentPage >= totalPages;

  return h(
    'div',
    {
      role: 'navigation',
      'aria-label': 'Phân trang',
      className: cn(
        'w-full flex flex-col sm:flex-row items-center justify-between gap-4 py-3 select-none',
        className
      ),
    },
    // Left: Summary text e.g. "1–25 / 143 người"
    h(
      'div',
      { className: 'text-sm text-text-muted flex items-center gap-3' },
      h('span', { className: 'font-medium text-text-main tabular-nums' }, `${startItem}–${endItem}`),
      h('span', null, '/'),
      h('span', { className: 'font-medium text-text-main tabular-nums' }, totalItems),
      h('span', null, unitLabel),
      onPageSizeChange &&
        h(
          'div',
          { className: 'ml-4 flex items-center gap-1.5 text-xs' },
          h('span', { className: 'hidden md:inline' }, 'Hiển thị'),
          h(
            'select',
            {
              'aria-label': 'Số dòng mỗi trang',
              value: pageSize,
              onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
                onPageSizeChange(Number(e.target.value)),
              className:
                'h-8 px-2 rounded-control border border-border-control bg-surface text-text-main text-xs focus-visible:outline-2 focus-visible:outline-focus cursor-pointer',
            },
            pageSizeOptions.map((opt) =>
              h('option', { key: opt, value: opt }, `${opt} / trang`)
            )
          )
        )
    ),
    // Right: Navigation Controls (min 44x44px touch targets)
    h(
      'div',
      { className: 'flex items-center gap-1' },
      h(
        'button',
        {
          type: 'button',
          onClick: () => onPageChange(1),
          disabled: isFirstPage,
          'aria-label': 'Trang đầu tiên',
          className: cn(
            'min-h-[44px] min-w-[44px] h-11 w-11 inline-flex items-center justify-center rounded-control border border-border-control bg-surface text-text-main transition-colors',
            'hover:bg-[#F0EEE6] active:bg-[#E2DFD6]',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
            'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-surface'
          ),
        },
        h(ChevronsLeft, { className: 'w-4 h-4' })
      ),
      h(
        'button',
        {
          type: 'button',
          onClick: () => onPageChange(safeCurrentPage - 1),
          disabled: isFirstPage,
          'aria-label': 'Trang trước',
          className: cn(
            'min-h-[44px] min-w-[44px] h-11 w-11 inline-flex items-center justify-center rounded-control border border-border-control bg-surface text-text-main transition-colors',
            'hover:bg-[#F0EEE6] active:bg-[#E2DFD6]',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
            'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-surface'
          ),
        },
        h(ChevronLeft, { className: 'w-4 h-4' })
      ),
      h(
        'div',
        { className: 'px-3 text-sm font-medium text-text-main tabular-nums' },
        `Trang ${safeCurrentPage} / ${totalPages}`
      ),
      h(
        'button',
        {
          type: 'button',
          onClick: () => onPageChange(safeCurrentPage + 1),
          disabled: isLastPage,
          'aria-label': 'Trang tiếp theo',
          className: cn(
            'min-h-[44px] min-w-[44px] h-11 w-11 inline-flex items-center justify-center rounded-control border border-border-control bg-surface text-text-main transition-colors',
            'hover:bg-[#F0EEE6] active:bg-[#E2DFD6]',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
            'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-surface'
          ),
        },
        h(ChevronRight, { className: 'w-4 h-4' })
      ),
      h(
        'button',
        {
          type: 'button',
          onClick: () => onPageChange(totalPages),
          disabled: isLastPage,
          'aria-label': 'Trang cuối cùng',
          className: cn(
            'min-h-[44px] min-w-[44px] h-11 w-11 inline-flex items-center justify-center rounded-control border border-border-control bg-surface text-text-main transition-colors',
            'hover:bg-[#F0EEE6] active:bg-[#E2DFD6]',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
            'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-surface'
          ),
        },
        h(ChevronsRight, { className: 'w-4 h-4' })
      )
    )
  );
};
