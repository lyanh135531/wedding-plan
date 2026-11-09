import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Pagination } from '@/components/ui/pagination';

describe('Pagination Component (src/components/ui/pagination.tsx)', () => {
  it('renders exact label according to specification e.g. "1–25 / 143 người"', () => {
    const html = renderToStaticMarkup(
      React.createElement(Pagination, {
        currentPage: 1,
        pageSize: 25,
        totalItems: 143,
        unitLabel: 'người',
        onPageChange: () => {},
      })
    );
    expect(html).toContain('1–25');
    expect(html).toContain('143');
    expect(html).toContain('người');
    expect(html).toContain('Trang 1 / 6');
  });

  it('renders "26–50 / 143 người" when currentPage is 2', () => {
    const html = renderToStaticMarkup(
      React.createElement(Pagination, {
        currentPage: 2,
        pageSize: 25,
        totalItems: 143,
        unitLabel: 'người',
        onPageChange: () => {},
      })
    );
    expect(html).toContain('26–50');
    expect(html).toContain('143');
    expect(html).toContain('Trang 2 / 6');
  });

  it('renders "0–0 / 0 người" when totalItems is 0', () => {
    const html = renderToStaticMarkup(
      React.createElement(Pagination, {
        currentPage: 1,
        pageSize: 25,
        totalItems: 0,
        unitLabel: 'người',
        onPageChange: () => {},
      })
    );
    expect(html).toContain('0–0');
    expect(html).toContain('0');
  });

  it('disables previous buttons on first page and next buttons on last page', () => {
    const htmlFirst = renderToStaticMarkup(
      React.createElement(Pagination, {
        currentPage: 1,
        pageSize: 25,
        totalItems: 100,
        onPageChange: () => {},
      })
    );
    expect(htmlFirst).toContain('aria-label="Trang trước"');
    expect(htmlFirst).toContain('disabled=""');

    const htmlLast = renderToStaticMarkup(
      React.createElement(Pagination, {
        currentPage: 4,
        pageSize: 25,
        totalItems: 100,
        onPageChange: () => {},
      })
    );
    expect(htmlLast).toContain('aria-label="Trang tiếp theo"');
    expect(htmlLast).toContain('disabled=""');
  });

  it('has minimum 44px touch targets on navigation buttons', () => {
    const html = renderToStaticMarkup(
      React.createElement(Pagination, {
        currentPage: 1,
        pageSize: 25,
        totalItems: 50,
        onPageChange: () => {},
      })
    );
    expect(html).toContain('min-h-[44px]');
    expect(html).toContain('min-w-[44px]');
  });
});
