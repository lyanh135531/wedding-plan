import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RoleProvider } from '@/context/RoleContext';
import { EventScopeProvider, WeddingEventItem } from '@/context/EventScopeContext';
import { PageShell } from '@/components/layout/PageShell';

let currentPathname = '/overview';

vi.mock('next/navigation', () => ({
  usePathname: () => currentPathname,
}));

const MOCK_EVENTS: WeddingEventItem[] = [
  { id: 'ev-an-hoi', name: 'Lễ Ăn Hỏi' },
  { id: 'ev-tiec-cuoi', name: 'Tiệc Cưới Chính', isRepresentative: true },
];

describe('PageShell Component (UI/UX Spec §2.2, §2.3, §3, §4)', () => {
  beforeEach(() => {
    currentPathname = '/overview';
  });

  const renderShell = (props: Partial<React.ComponentProps<typeof PageShell>> = {}, role: 'owner' | 'family_view' = 'owner') => {
    const tree = React.createElement(
      RoleProvider,
      { initialRole: role },
      React.createElement(
        EventScopeProvider,
        { initialEvents: MOCK_EVENTS },
        React.createElement(
          PageShell,
          {
            title: props.title || 'Trang Thử Nghiệm',
            ...props,
          },
          props.children || React.createElement('div', { id: 'test-child' }, 'Nội dung trang thử nghiệm')
        )
      )
    );

    return renderToStaticMarkup(tree);
  };

  it('renders standard Zero CLS responsive shell containing Header, Sidebar, BottomNav and Content', () => {
    const html = renderShell({ title: 'Tổng quan' });

    // Header 64px
    expect(html).toContain('h-16');
    expect(html).toContain('Tổng quan');

    // Desktop Sidebar 240px
    expect(html).toContain('w-[240px]');
    expect(html).toContain('Sổ Quản Lý Đám Cưới');

    // Mobile Bottom Nav 64px
    expect(html).toContain('aria-label="Thanh điều hướng di động"');

    // Main content area with padding and offsets
    expect(html).toContain('id="main-content"');
    expect(html).toContain('lg:pl-[240px]');
    expect(html).toContain('pt-16');
    expect(html).toContain('pb-20');
    expect(html).toContain('Nội dung trang thử nghiệm');
  });

  it('includes WCAG Skip to Main Content accessibility link', () => {
    const html = renderShell({ title: 'Tổng quan' });

    expect(html).toContain('href="#main-content"');
    expect(html).toContain('Chuyển thẳng đến nội dung chính');
    expect(html).toContain('sr-only');
  });

  it('applies maximum width constraints according to UI/UX Spec §2.3', () => {
    // standard (1440px)
    const stdHtml = renderShell({ maxWidth: 'standard' });
    expect(stdHtml).toContain('max-w-[1440px]');

    // form (760px)
    const formHtml = renderShell({ maxWidth: 'form' });
    expect(formHtml).toContain('max-w-[760px]');

    // document (880px)
    const docHtml = renderShell({ maxWidth: 'document' });
    expect(docHtml).toContain('max-w-[880px]');

    // full width
    const fullHtml = renderShell({ maxWidth: 'full' });
    expect(fullHtml).toContain('w-full');
  });

  it('renders breadcrumbs when provided with active page attribute', () => {
    const breadcrumbs = [
      { label: 'Tổng quan', href: '/overview' },
      { label: 'Khách mời', href: '/guests' },
      { label: 'Nguyễn Văn A' },
    ];

    const html = renderShell({ title: 'Hồ sơ khách', breadcrumbs });

    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toContain('href="/overview"');
    expect(html).toContain('href="/guests"');
    expect(html).toContain('Nguyễn Văn A');
    expect(html).toContain('aria-current="page"');
  });

  it('renders mobile event scope selector under H1 for < sm screens', () => {
    const html = renderShell({ showScopeSelector: true });

    expect(html).toContain('id="mobile-event-scope"');
    expect(html).toContain('Phạm vi buổi lễ đang xem:');
    expect(html).toContain('Tất cả buổi (Tổng hợp)');
    expect(html).toContain('Lễ Ăn Hỏi');
  });

  it('does not render mobile event scope selector when showScopeSelector is false', () => {
    const html = renderShell({ showScopeSelector: false });

    expect(html).not.toContain('id="mobile-event-scope"');
  });

  it('BẢO MẬT: Renders PermissionDeniedView and blocks content when Family View accesses forbidden route', () => {
    currentPathname = '/budget';

    // Owner accessing /budget -> content rendered normally
    const ownerHtml = renderShell({ title: 'Ngân sách' }, 'owner');
    expect(ownerHtml).toContain('Nội dung trang thử nghiệm');
    expect(ownerHtml).not.toContain('Bạn không có quyền truy cập');

    // Family View accessing /budget -> blocked by PermissionDeniedView!
    const familyHtml = renderShell({ title: 'Ngân sách' }, 'family_view');
    expect(familyHtml).not.toContain('Nội dung trang thử nghiệm');
    expect(familyHtml).toContain('Bạn không có quyền truy cập');
    expect(familyHtml).toContain('Phân hệ này dành riêng cho hai chủ sở hữu');
    expect(familyHtml).toContain('href="/overview"');
  });
});
