import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
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

  it('renders fixed 240px sidebar for Desktop (≥1024px) with brand title and system info', () => {
    const tree = React.createElement(
      RoleProvider,
      { initialRole: 'owner' },
      React.createElement(DesktopSidebar)
    );

    const html = renderToStaticMarkup(tree);

    // Bố cục cố định 240px, ẩn dưới lg (< 1024px)
    expect(html).toContain('w-[240px]');
    expect(html).toContain('hidden lg:flex');
    expect(html).toContain('h-screen');
    expect(html).toContain('fixed');

    // Tiêu đề thương hiệu
    expect(html).toContain('Sổ Quản Lý Đám Cưới');
    expect(html).toContain('Quyền: Chủ sở hữu');

    // Thông tin múi giờ và tiền tệ chuẩn
    expect(html).toContain('Múi giờ: Asia/Ho_Chi_Minh');
    expect(html).toContain('Tiền tệ: VND (bigint)');
  });

  it('renders all 5 groups and financial links for Owner role', () => {
    const tree = React.createElement(
      RoleProvider,
      { initialRole: 'owner' },
      React.createElement(DesktopSidebar)
    );

    const html = renderToStaticMarkup(tree);

    // Đầy đủ 5 nhóm
    expect(html).toContain('Tổng quan');
    expect(html).toContain('Chuẩn bị');
    expect(html).toContain('Khách &amp; tiệc');
    expect(html).toContain('Tài chính');
    expect(html).toContain('Ngày cưới &amp; cài đặt');

    // Các liên kết tài chính hiện diện
    expect(html).toContain('href="/budget"');
    expect(html).toContain('href="/payments"');
    expect(html).toContain('href="/fund"');
    expect(html).toContain('href="/gifts"');

    // Các liên kết quản trị & lịch sử
    expect(html).toContain('href="/history"');
    expect(html).toContain('href="/data/import"');
    expect(html).toContain('href="/data/export"');
    expect(html).toContain('href="/sharing"');
    expect(html).toContain('Chia sẻ quyền');
  });

  it('BẢO MẬT: Ẩn 100% nhóm Tài chính và các route cấm khi ở vai trò Người nhà (Family View)', () => {
    const tree = React.createElement(
      RoleProvider,
      { initialRole: 'family_view' },
      React.createElement(DesktopSidebar)
    );

    const html = renderToStaticMarkup(tree);

    // Vai trò hiển thị chuẩn
    expect(html).toContain('Quyền: Người nhà (Chỉ xem)');

    // Nhóm Tài chính biến mất hoàn toàn
    expect(html).not.toContain('Tài chính');
    expect(html).not.toContain('href="/budget"');
    expect(html).not.toContain('href="/payments"');
    expect(html).not.toContain('href="/fund"');
    expect(html).not.toContain('href="/gifts"');

    // Route cấm biến mất hoàn toàn (bao gồm lịch sử, nhập liệu, chia sẻ quyền)
    expect(html).not.toContain('href="/history"');
    expect(html).not.toContain('href="/data/import"');
    expect(html).not.toContain('href="/sharing"');
    expect(html).not.toContain('Chia sẻ quyền');

    // Các route công bố vẫn hiển thị bình thường
    expect(html).toContain('href="/overview"');
    expect(html).toContain('href="/guests"');
    expect(html).toContain('href="/tasks"');
    expect(html).toContain('href="/data/export"');
  });

  it('highlights the active link with aria-current="page" and primary background', () => {
    currentPathname = '/guests';

    const tree = React.createElement(
      RoleProvider,
      { initialRole: 'owner' },
      React.createElement(DesktopSidebar)
    );

    const html = renderToStaticMarkup(tree);

    // Active item '/guests' has aria-current="page" and primary dark green #23483E
    expect(html).toContain('href="/guests"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('bg-[#23483E]');
  });

  it('renders milestone badges (R2, R3) for future features', () => {
    const tree = React.createElement(
      RoleProvider,
      { initialRole: 'owner' },
      React.createElement(DesktopSidebar)
    );

    const html = renderToStaticMarkup(tree);

    expect(html).toContain('>R2<');
    expect(html).toContain('>R3<');
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
