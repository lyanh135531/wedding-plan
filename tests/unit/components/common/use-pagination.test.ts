import { describe, it, expect } from 'vitest';
import { paginateSlice } from '@/components/common/usePagination';

describe('paginateSlice helper (src/components/common/usePagination.ts)', () => {
  const items = Array.from({ length: 55 }, (_, i) => `item-${i + 1}`);

  it('slices items accurately for first, middle, and last pages', () => {
    const page1 = paginateSlice(items, 1, 25);
    expect(page1.currentPage).toBe(1);
    expect(page1.totalPages).toBe(3);
    expect(page1.totalItems).toBe(55);
    expect(page1.pagedItems).toHaveLength(25);
    expect(page1.pagedItems[0]).toBe('item-1');
    expect(page1.pagedItems[24]).toBe('item-25');

    const page2 = paginateSlice(items, 2, 25);
    expect(page2.currentPage).toBe(2);
    expect(page2.pagedItems).toHaveLength(25);
    expect(page2.pagedItems[0]).toBe('item-26');
    expect(page2.pagedItems[24]).toBe('item-50');

    const page3 = paginateSlice(items, 3, 25);
    expect(page3.currentPage).toBe(3);
    expect(page3.pagedItems).toEqual(['item-51', 'item-52', 'item-53', 'item-54', 'item-55']);
  });

  it('clamps out-of-range page numbers safely when items shrink or page < 1', () => {
    const shrunk = paginateSlice(items.slice(0, 12), 5, 10);
    expect(shrunk.currentPage).toBe(2);
    expect(shrunk.totalPages).toBe(2);
    expect(shrunk.pagedItems).toEqual(['item-11', 'item-12']);

    const negative = paginateSlice(items, -3, 10);
    expect(negative.currentPage).toBe(1);
    expect(negative.pagedItems).toHaveLength(10);
  });

  it('handles empty arrays and invalid page sizes without division-by-zero', () => {
    const empty = paginateSlice([], 3, 25);
    expect(empty.currentPage).toBe(1);
    expect(empty.totalPages).toBe(1);
    expect(empty.totalItems).toBe(0);
    expect(empty.pagedItems).toEqual([]);

    const minSize = paginateSlice(['a', 'b'], 2, 0);
    expect(minSize.currentPage).toBe(2);
    expect(minSize.totalPages).toBe(2);
    expect(minSize.pagedItems).toEqual(['b']);
  });
});
