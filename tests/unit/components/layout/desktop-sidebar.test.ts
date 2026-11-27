import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { RoleProvider } from '@/context/RoleContext';
import {
  DesktopSidebar,
  SIDEBAR_NAV_GROUPS,
} from '@/components/layout/DesktopSidebar';

let currentPathname = '/overview';

vi.mock('next/navigation', () => ({
  usePathname: () => currentPathname,
}));

describe('DesktopSidebar Component (PLAN §4.1 & UI/UX Spec §2.3, §3.1, §3.2)', () => {
  beforeEach(() => {
    currentPathname = '/overview';
  });

  it('links only to existing application pages', () => {
    for (const item of SIDEBAR_NAV_GROUPS.flatMap((group) => group.items)) {
      expect(
        fs.existsSync(path.join(process.cwd(), 'src/app/(dashboard)', item.href, 'page.tsx')),
        item.href
      ).toBe(true);
    }
  });

  it('renders the 5 authoritative navigation groups from PLAN §4.1', () => {
    const groupTitles = SIDEBAR_NAV_GROUPS.map((g) => g.groupTitle);
    expect(groupTitles).toEqual([
      'Tổng quan',
      'Chuẩn bị',
      'Khách & tiệc',
      'Tài chính',
      'Ngày cưới & cài đặt',
    ]);
  });

  it('renders fixed 240px sidebar for Desktop (≥1024px) with couple branding and system info', () => {
    const tree = React.createElement(
      RoleProvider,
      { initialRole: 'owner' },
      React.createElement(DesktopSidebar)
    );

    const html = renderToStaticMarkup(tree);

    expect(html).toContain('w-[240px]');
    expect(html).toContain('hidden lg:flex');
    expect(html).toContain('h-screen');
    expect(html).toContain('fixed');

    expect(html).toContain('Sổ Quản Lý Đám Cưới');
    expect(html).toContain('Cô dâu &amp; Chú rể');
    expect(html).not.toContain('Quyền: Chủ sở hữu');
    expect(html).not.toContain('Quyền: Người nhà');

    expect(html).toContain('Giờ Việt Nam · VND');
    expect(html).toContain('Không gian riêng của hai bạn');
    expect(html).toContain('Khóa sổ / Đăng xuất');
  });

  it('renders kept menus and omits the 4 removed menus', () => {
    const tree = React.createElement(
      RoleProvider,
      { initialRole: 'owner' },
      React.createElement(DesktopSidebar)
    );

    const html = renderToStaticMarkup(tree);

    expect(html).toContain('Tổng quan');
    expect(html).toContain('Chuẩn bị');
    expect(html).toContain('Khách &amp; tiệc');
    expect(html).toContain('Tài chính');
    expect(html).toContain('Ngày cưới &amp; cài đặt');

    expect(html).toContain('href="/budget"');
    expect(html).toContain('href="/payments"');
    expect(html).toContain('href="/fund"');
    expect(html).toContain('href="/gifts"');
    expect(html).toContain('href="/music"');
    expect(html).toContain('Chọn nhạc');
    expect(html).toContain('href="/data/import"');
    expect(html).toContain('href="/data/export"');
    expect(html).toContain('href="/settings"');

    // Removed unnecessary menus
    expect(html).not.toContain('href="/history"');
    expect(html).not.toContain('href="/attendance"');
    expect(html).not.toContain('href="/handovers"');
    expect(html).not.toContain('href="/after-wedding"');
  });

  it('highlights the active link with aria-current="page" and primary background', () => {
    currentPathname = '/guests';

    const tree = React.createElement(
      RoleProvider,
      { initialRole: 'owner' },
      React.createElement(DesktopSidebar)
    );

    const html = renderToStaticMarkup(tree);

    expect(html).toContain('href="/guests"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('nav-link--active');
  });

  it('keeps internal milestone labels out of navigation', () => {
    const tree = React.createElement(
      RoleProvider,
      { initialRole: 'owner' },
      React.createElement(DesktopSidebar)
    );

    const html = renderToStaticMarkup(tree);

    expect(html).not.toContain('>R2<');
    expect(html).not.toContain('>R3<');
  });

  it('supports drawer mode without desktop hidden classes', () => {
    const tree = React.createElement(
      RoleProvider,
      { initialRole: 'owner' },
      React.createElement(DesktopSidebar, { isDrawer: true, className: 'custom-drawer' })
    );

    const html = renderToStaticMarkup(tree);

    expect(html).toContain('custom-drawer');
    expect(html).not.toContain('hidden lg:flex');
  });
});
