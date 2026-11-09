import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MultiSelectBar } from '@/components/ui/multi-select-bar';

describe('MultiSelectBar Component (src/components/ui/multi-select-bar.tsx)', () => {
  const actions = [
    { id: 'delete', label: 'Xóa hàng loạt', variant: 'danger' as const, onClick: () => {} },
    { id: 'export', label: 'Xuất danh sách', variant: 'secondary' as const, onClick: () => {} },
  ];

  it('renders nothing when selectedIds is empty', () => {
    const html = renderToStaticMarkup(
      React.createElement(MultiSelectBar, {
        selectedIds: [],
        actions,
        onClearSelection: () => {},
      })
    );
    expect(html).toBe('');
  });

  it('renders floating toolbar with selected count and batch actions when selectedIds is not empty', () => {
    const html = renderToStaticMarkup(
      React.createElement(MultiSelectBar, {
        selectedIds: ['id1', 'id2', 'id3'],
        totalInView: 25,
        totalMatching: 143,
        actions,
        onClearSelection: () => {},
        onSelectAllMatching: () => {},
      })
    );
    expect(html).toContain('role="toolbar"');
    expect(html).toContain('Đã chọn 3 người');
    expect(html).toContain('(trên trang này)');
    expect(html).toContain('Chọn toàn bộ 143 người khớp bộ lọc');
    expect(html).toContain('Xóa hàng loạt');
    expect(html).toContain('Xuất danh sách');
  });

  it('displays confirmed badge when isAllMatchingSelected is true', () => {
    const html = renderToStaticMarkup(
      React.createElement(MultiSelectBar, {
        selectedIds: ['id1', 'id2'],
        totalMatching: 143,
        isAllMatchingSelected: true,
        actions,
        onClearSelection: () => {},
      })
    );
    expect(html).toContain('Đã chọn toàn bộ 143 người');
  });
});
