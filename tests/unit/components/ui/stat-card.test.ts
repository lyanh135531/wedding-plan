import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StatCard } from '@/components/ui/stat-card';

describe('StatCard Component (src/components/ui/stat-card.tsx)', () => {
  it('renders standard metric with tabular numbers and unit', () => {
    const html = renderToStaticMarkup(
      React.createElement(StatCard, {
        label: 'Tổng ngân sách dự kiến',
        value: '250.000.000',
        unit: '₫',
        scopeDescription: 'Bao gồm 12 danh mục',
      })
    );
    expect(html).toContain('Tổng ngân sách dự kiến');
    expect(html).toContain('250.000.000');
    expect(html).toContain('₫');
    expect(html).toContain('tabular-nums');
    expect(html).toContain('Bao gồm 12 danh mục');
  });

  it('renders "—" and "Chưa có dữ liệu" when value is null (never 0 ₫ when unconfigured)', () => {
    const html = renderToStaticMarkup(
      React.createElement(StatCard, {
        label: 'Chi phí phát sinh',
        value: null,
        status: 'empty',
      })
    );
    expect(html).toContain('Chi phí phát sinh');
    expect(html).toContain('—');
    expect(html).toContain('Chưa có dữ liệu');
    expect(html).not.toContain('0 ₫');
  });

  it('renders provisional amber badge and note when status is "provisional"', () => {
    const html = renderToStaticMarkup(
      React.createElement(StatCard, {
        label: 'Chi phí thực tế đã chốt',
        value: '185.000.000 ₫',
        status: 'provisional',
        provisionalNote: 'Tạm tính — còn 3 khoản thiếu giá',
      })
    );
    expect(html).toContain('Tạm tính — còn 3 khoản thiếu giá');
    expect(html).toContain('bg-warning-bg');
    expect(html).toContain('text-warning');
  });

  it('renders clickable link with arrow icon when href is provided', () => {
    const html = renderToStaticMarkup(
      React.createElement(StatCard, {
        label: 'Tổng số khách mời',
        value: 143,
        unit: 'khách',
        href: '/guests',
      })
    );
    expect(html).toContain('href="/guests"');
    expect(html).toContain('cursor-pointer');
  });
});
