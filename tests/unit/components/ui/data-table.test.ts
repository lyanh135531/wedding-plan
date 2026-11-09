import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DataTable, ColumnDef } from '@/components/ui/data-table';

interface GuestItem {
  id: string;
  name: string;
  group: string;
  giftAmount: string;
}

describe('DataTable Component (src/components/ui/data-table.tsx)', () => {
  const data: GuestItem[] = [
    { id: 'g1', name: 'Nguyễn Văn Hoàng', group: 'Bạn cấp 3', giftAmount: '1.000.000 ₫' },
    { id: 'g2', name: 'Trần Thị Mai', group: 'Đồng nghiệp', giftAmount: '500.000 ₫' },
  ];

  const columns: ColumnDef<GuestItem>[] = [
    { id: 'name', header: 'Tên khách mời', cell: (r) => r.name, sortable: true },
    { id: 'group', header: 'Nhóm', cell: (r) => r.group },
    { id: 'giftAmount', header: 'Tiền mừng', cell: (r) => r.giftAmount, align: 'right' },
  ];

  it('renders desktop table view with sticky thead and right-aligned tabular currency column', () => {
    const html = renderToStaticMarkup(
      React.createElement(DataTable<GuestItem>, {
        columns,
        data,
        keyField: 'id',
      })
    );
    expect(html).toContain('Tên khách mời');
    expect(html).toContain('Tiền mừng');
    expect(html).toContain('text-right tabular-nums');
    expect(html).toContain('Nguyễn Văn Hoàng');
    expect(html).toContain('1.000.000 ₫');
    expect(html).toContain('sticky top-0');
  });

  it('renders mobile card reflow with min-height 64px for touch ergonomics', () => {
    const html = renderToStaticMarkup(
      React.createElement(DataTable<GuestItem>, {
        columns,
        data,
        keyField: 'id',
      })
    );
    expect(html).toContain('min-h-[64px]');
    expect(html).toContain('lg:hidden');
  });

  it('renders selectable checkboxes with proper aria-labels when selectable is true', () => {
    const html = renderToStaticMarkup(
      React.createElement(DataTable<GuestItem>, {
        columns,
        data,
        keyField: 'id',
        selectable: true,
        selectedIds: ['g1'],
      })
    );
    expect(html).toContain('aria-label="Chọn tất cả các dòng"');
    expect(html).toContain('aria-label="Chọn dòng g1"');
  });

  it('renders empty state when data array is empty', () => {
    const html = renderToStaticMarkup(
      React.createElement(DataTable<GuestItem>, {
        columns,
        data: [],
        keyField: 'id',
        emptyState: 'Chưa có khách mời nào được thêm',
      })
    );
    expect(html).toContain('Chưa có khách mời nào được thêm');
  });
});
