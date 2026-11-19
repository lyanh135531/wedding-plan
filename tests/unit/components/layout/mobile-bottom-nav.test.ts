import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RoleProvider } from '@/context/RoleContext';
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
    const tree = React.createElement(
      RoleProvider,
      { initialRole: 'owner' },
      React.createElement(MobileBottomNav)
    );

    const html = renderToStaticMarkup(tree);

    expect(html).toContain('lg:hidden');
    expect(html).toContain('fixed');
    expect(html).toContain('bottom-0');
    expect(html).toContain('h-16');
    expect(html).toContain('aria-label="Thanh điều hướng di động"');
  });

  it('renders 5 tabs (4 main tabs + Menu button) for Owner role', () => {
    const tree = React.createElement(
      RoleProvider,
      { initialRole: 'owner' },
      React.createElement(MobileBottomNav)
    );

    const html = renderToStaticMarkup(tree);

    // 4 tab links
    expect(html).toContain('href="/overview"');
    expect(html).toContain('Tổng quan');
    expect(html).toContain('href="/guests"');
    expect(html).toContain('Khách');
    expect(html).toContain('href="/budget"');
    expect(html).toContain('Ngân sách');
    expect(html).toContain('href="/tasks"');
    expect(html).toContain('Công việc');

    // Menu button
    expect(html).toContain('Menu');
    expect(html).toContain('aria-label="Mở danh mục điều hướng mở rộng"');
  });

  it('BẢO MẬT: Family View does not see Ngân sách tab', () => {
    const tree = React.createElement(
      RoleProvider,
      { initialRole: 'family_view' },
      React.createElement(MobileBottomNav)
    );

    const html = renderToStaticMarkup(tree);

    // Không có tab Ngân sách
    expect(html).not.toContain('href="/budget"');
    expect(html).not.toContain('Ngân sách');

    // Các tab được phép vẫn có
    expect(html).toContain('href="/overview"');
    expect(html).toContain('href="/guests"');
    expect(html).toContain('Menu');
  });

  it('auto-hides with translate-y-full when isModalOpen is true', () => {
    const tree = React.createElement(
      RoleProvider,
      { initialRole: 'owner' },
      React.createElement(MobileBottomNav, { isModalOpen: true })
    );

    const html = renderToStaticMarkup(tree);

    expect(html).toContain('translate-y-full');
    expect(html).not.toContain('translate-y-0');
  });

  it('displays with translate-y-0 when isModalOpen is false', () => {
    const tree = React.createElement(
      RoleProvider,
      { initialRole: 'owner' },
      React.createElement(MobileBottomNav, { isModalOpen: false })
    );

    const html = renderToStaticMarkup(tree);

    expect(html).toContain('translate-y-0');
  });

  it('highlights the active tab with aria-current="page" and primary color', () => {
    currentPathname = '/guests';

    const tree = React.createElement(
      RoleProvider,
      { initialRole: 'owner' },
      React.createElement(MobileBottomNav)
    );

    const html = renderToStaticMarkup(tree);

    expect(html).toContain('aria-current="page"');
    expect(html).toContain('text-primary');
    expect(html).toContain('font-semibold');
  });

  it('ensures all buttons and links satisfy minimum 44px tap target size', () => {
    const tree = React.createElement(
      RoleProvider,
      { initialRole: 'owner' },
      React.createElement(MobileBottomNav)
    );

    const html = renderToStaticMarkup(tree);

    // All links and buttons include min-h-[44px]
    expect(html).toContain('min-h-[44px]');
  });
});
