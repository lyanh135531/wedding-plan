import * as React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from './checkbox';
import { Skeleton } from './skeleton';

const h = React.createElement;

export interface ColumnDef<T> {
  id: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
  sortable?: boolean;
  width?: string;
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  keyField: keyof T | ((row: T) => string);
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (columnId: string) => void;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectRow?: (id: string, selected: boolean) => void;
  onSelectAll?: (selected: boolean) => void;
  renderMobileCard?: (row: T, isSelected: boolean) => React.ReactNode;
  isLoading?: boolean;
  emptyState?: React.ReactNode;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyField,
  sortColumn,
  sortDirection,
  onSort,
  selectable = false,
  selectedIds = [],
  onSelectRow,
  onSelectAll,
  renderMobileCard,
  isLoading = false,
  emptyState,
  className,
}: DataTableProps<T>): React.ReactElement {
  const getRowId = React.useCallback(
    (row: T): string => {
      if (typeof keyField === 'function') {
        return keyField(row);
      }
      return String(row[keyField]);
    },
    [keyField]
  );

  const allRowIds = React.useMemo(() => data.map(getRowId), [data, getRowId]);
  const isAllSelected =
    data.length > 0 && allRowIds.every((id) => selectedIds.includes(id));
  const isSomeSelected = selectedIds.length > 0 && !isAllSelected;

  const handleHeaderSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSelectAll?.(e.target.checked);
  };

  const handleRowSelect = (
    id: string,
    checked: boolean,
    e: React.MouseEvent | React.ChangeEvent
  ) => {
    e.stopPropagation();
    onSelectRow?.(id, checked);
  };

  return h(
    'div',
    { className: cn('w-full', className) },
    // Desktop Table View
    h(
      'div',
      {
        className:
          'hidden lg:block w-full overflow-x-auto rounded-card border border-border-subtle bg-surface shadow-sm',
      },
      h(
        'table',
        { className: 'w-full text-left border-collapse' },
        h(
          'thead',
          { className: 'bg-page border-b border-border-subtle sticky top-0 z-10' },
          h(
            'tr',
            null,
            selectable &&
              h(
                'th',
                { className: 'w-12 px-4 py-3.5 text-center' },
                h(
                  'div',
                  { className: 'flex items-center justify-center' },
                  h(Checkbox, {
                    'aria-label': 'Chọn tất cả các dòng',
                    checked: isAllSelected,
                    indeterminate: isSomeSelected,
                    onChange: handleHeaderSelectAll,
                  })
                )
              ),
            columns.map((col) => {
              const isSorted = sortColumn === col.id;
              const alignClass =
                col.align === 'right'
                  ? 'text-right'
                  : col.align === 'center'
                  ? 'text-center'
                  : 'text-left';

              return h(
                'th',
                {
                  key: col.id,
                  scope: 'col',
                  style: { width: col.width },
                  'aria-sort': isSorted
                    ? sortDirection === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : undefined,
                  className: cn(
                    'px-4 py-3.5 text-sm font-semibold text-text-muted select-none',
                    alignClass
                  ),
                },
                col.sortable && onSort
                  ? h(
                      'button',
                      {
                        type: 'button',
                        onClick: () => onSort(col.id),
                        className: cn(
                          'inline-flex items-center gap-1.5 hover:text-text-main transition-colors focus-visible:outline-2 focus-visible:outline-focus rounded',
                          alignClass === 'text-right' && 'ml-auto'
                        ),
                      },
                      h('span', null, col.header),
                      isSorted
                        ? sortDirection === 'asc'
                          ? h(ArrowUp, { className: 'w-3.5 h-3.5 text-primary shrink-0' })
                          : h(ArrowDown, { className: 'w-3.5 h-3.5 text-primary shrink-0' })
                        : h(ArrowUpDown, { className: 'w-3.5 h-3.5 opacity-40 shrink-0' })
                    )
                  : h('span', null, col.header)
              );
            })
          )
        ),
        h(
          'tbody',
          { className: 'divide-y divide-border-subtle text-sm' },
          isLoading
            ? Array.from({ length: 5 }).map((_, idx) =>
                h(
                  'tr',
                  { key: `skeleton-${idx}` },
                  selectable &&
                    h(
                      'td',
                      { className: 'px-4 py-3.5 text-center' },
                      h(Skeleton, { className: 'w-4 h-4 mx-auto' })
                    ),
                  columns.map((col) =>
                    h(
                      'td',
                      { key: col.id, className: 'px-4 py-3.5' },
                      h(Skeleton, { className: 'h-5 w-3/4' })
                    )
                  )
                )
              )
            : data.length === 0
            ? h(
                'tr',
                null,
                h(
                  'td',
                  {
                    colSpan: columns.length + (selectable ? 1 : 0),
                    className: 'py-12 text-center text-text-muted',
                  },
                  emptyState || 'Không có dữ liệu phù hợp'
                )
              )
            : data.map((row) => {
                const id = getRowId(row);
                const isSelected = selectedIds.includes(id);

                return h(
                  'tr',
                  {
                    key: id,
                    className: cn(
                      'transition-colors hover:bg-[#F9F8F5]',
                      isSelected && 'bg-primary/5'
                    ),
                  },
                  selectable &&
                    h(
                      'td',
                      { className: 'w-12 px-4 py-3.5 text-center' },
                      h(
                        'div',
                        {
                          className: 'flex items-center justify-center',
                          onClick: (e: React.MouseEvent) => e.stopPropagation(),
                        },
                        h(Checkbox, {
                          'aria-label': `Chọn dòng ${id}`,
                          checked: isSelected,
                          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                            handleRowSelect(id, e.target.checked, e),
                        })
                      )
                    ),
                  columns.map((col) => {
                    const alignClass =
                      col.align === 'right'
                        ? 'text-right tabular-nums'
                        : col.align === 'center'
                        ? 'text-center'
                        : 'text-left';

                    return h(
                      'td',
                      { key: col.id, className: cn('px-4 py-3.5 text-text-main', alignClass) },
                      col.cell(row)
                    );
                  })
                );
              })
        )
      )
    ),
    // Mobile Card Reflow View
    h(
      'div',
      { className: 'lg:hidden flex flex-col gap-3' },
      selectable &&
        data.length > 0 &&
        !isLoading &&
        h(
          'div',
          {
            className:
              'flex items-center justify-between px-3 py-2 bg-surface rounded-control border border-border-subtle text-sm',
          },
          h('span', { className: 'text-text-muted' }, 'Chọn tất cả'),
          h(Checkbox, {
            'aria-label': 'Chọn tất cả các dòng trên thiết bị di động',
            checked: isAllSelected,
            indeterminate: isSomeSelected,
            onChange: handleHeaderSelectAll,
          })
        ),
      isLoading
        ? Array.from({ length: 4 }).map((_, idx) =>
            h(
              'div',
              {
                key: `mob-skel-${idx}`,
                className:
                  'p-4 rounded-card bg-surface border border-border-subtle min-h-[64px] flex flex-col gap-2',
              },
              h(Skeleton, { className: 'h-5 w-1/2' }),
              h(Skeleton, { className: 'h-4 w-3/4' })
            )
          )
        : data.length === 0
        ? h(
            'div',
            {
              className:
                'p-8 rounded-card bg-surface border border-border-subtle text-center text-text-muted',
            },
            emptyState || 'Không có dữ liệu phù hợp'
          )
        : data.map((row) => {
            const id = getRowId(row);
            const isSelected = selectedIds.includes(id);

            if (renderMobileCard) {
              return h(
                'div',
                { key: id, className: 'relative' },
                selectable &&
                  h(
                    'div',
                    {
                      className: 'absolute top-3 right-3 z-10',
                      onClick: (e: React.MouseEvent) => e.stopPropagation(),
                    },
                    h(Checkbox, {
                      'aria-label': `Chọn mục ${id}`,
                      checked: isSelected,
                      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                        handleRowSelect(id, e.target.checked, e),
                    })
                  ),
                renderMobileCard(row, isSelected)
              );
            }

            return h(
              'div',
              {
                key: id,
                className: cn(
                  'p-4 rounded-card bg-surface border border-border-subtle min-h-[64px] flex flex-col justify-between gap-2 shadow-sm transition-colors',
                  isSelected && 'border-primary/60 bg-primary/5'
                ),
              },
              h(
                'div',
                { className: 'flex items-start justify-between gap-2' },
                h(
                  'div',
                  { className: 'flex-1 flex flex-col gap-1.5' },
                  columns.map((col) =>
                    h(
                      'div',
                      {
                        key: col.id,
                        className: 'flex items-baseline justify-between text-sm',
                      },
                      h('span', { className: 'text-xs text-text-muted' }, `${col.header}:`),
                      h(
                        'span',
                        {
                          className: cn(
                            'text-text-main font-medium',
                            col.align === 'right' && 'tabular-nums'
                          ),
                        },
                        col.cell(row)
                      )
                    )
                  )
                ),
                selectable &&
                  h(
                    'div',
                    {
                      className: 'shrink-0 ml-2',
                      onClick: (e: React.MouseEvent) => e.stopPropagation(),
                    },
                    h(Checkbox, {
                      'aria-label': `Chọn mục ${id}`,
                      checked: isSelected,
                      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                        handleRowSelect(id, e.target.checked, e),
                    })
                  )
              )
            );
          })
    )
  );
}
