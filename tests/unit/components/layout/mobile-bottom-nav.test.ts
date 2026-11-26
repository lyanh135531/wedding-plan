import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';

let currentPathname = '/overview';

vi.mock('next/navigation', () => ({
  usePathname: () => currentPathname,
}));

describe('MobileBottomNav Component (UI/UX Spec §2.3, §3.1, §3.2)', () => {
  beforeEach(() => {
    currentPathname = '/overview';
  });

  it('renders fixed 64px bottom nav, visible only on mobile/tablet (<1024px)', () => {
    const html = renderToStaticMarkup(React.createElement(MobileBottomNav));

    expect(html).toContain('lg:hidden');
    expect(html).toContain('fixed');
    expect(html).toContain('bottom-0');
    expect(html).toContain('h-16');
    expect(html).toContain('aria-label="Thanh điều hướng di động"');
  });

  it('always renders 5 tabs (4 core tabs + Menu button)', () => {
    const html = renderToStaticMarkup(React.createElement(MobileBottomNav));

    expect(html).toContain('href="/overview"');
    expect(html).toContain('Tổng quan');
    expect(html).toContain('href="/guests"');
    expect(html).toContain('Khách');
    expect(html).toContain('href="/budget"');
    expect(html).toContain('Ngân sách');
    expect(html).toContain('href="/tasks"');
    expect(html).toContain('Công việc');

    expect(html).toContain('Menu');
    expect(html).toContain('aria-label="Mở danh mục điều hướng mở rộng"');
  });

  it('auto-hides with translate-y-full when isModalOpen is true', () => {
    const html = renderToStaticMarkup(
      React.createElement(MobileBottomNav, { isModalOpen: true })
    );

    expect(html).toContain('translate-y-full');
    expect(html).not.toContain('translate-y-0');
  });

  it('displays with translate-y-0 when isModalOpen is false', () => {
    const html = renderToStaticMarkup(
      React.createElement(MobileBottomNav, { isModalOpen: false })
    );

    expect(html).toContain('translate-y-0');
  });

  it('highlights the active tab with aria-current="page" and primary color', () => {
    currentPathname = '/guests';

    const html = renderToStaticMarkup(React.createElement(MobileBottomNav));

    expect(html).toContain('aria-current="page"');
    expect(html).toContain('text-primary');
    expect(html).toContain('font-semibold');
  });

  it('ensures all buttons and links satisfy minimum 44px tap target size', () => {
    const html = renderToStaticMarkup(React.createElement(MobileBottomNav));

    expect(html).toContain('min-h-[44px]');
  });
});
