import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RoleProvider } from '@/context/RoleContext';
import { EventScopeProvider, WeddingEventItem } from '@/context/EventScopeContext';
import { Header } from '@/components/layout/Header';

const MOCK_EVENTS: WeddingEventItem[] = [
  { id: 'ev-an-hoi', name: 'Lễ Ăn Hỏi', isRepresentative: false },
  { id: 'ev-tiec-cuoi', name: 'Tiệc Cưới Chính', isRepresentative: true },
  { id: 'ev-lai-mat', name: 'Lễ Lại Mặt', isCancelled: true },
];

describe('Header Component (UI/UX Spec §2.2, §3.1, §3.2, §3.3)', () => {
  it('renders fixed 64px header with H1 title and offset for desktop sidebar', () => {
    const tree = React.createElement(
      RoleProvider,
      null,
      React.createElement(
        EventScopeProvider,
        { initialEvents: MOCK_EVENTS },
        React.createElement(Header, { title: 'Quản lý Khách mời' })
      )
    );

    const html = renderToStaticMarkup(tree);

    expect(html).toContain('h-16');
    expect(html).toContain('fixed');
    expect(html).toContain('top-0');
    expect(html).toContain('lg:left-[240px]');
    expect(html).toContain('<h1');
    expect(html).toContain('Quản lý Khách mời');
    expect(html).toContain('font-sans');
    expect(html).toContain('sm:text-lg');
  });

  it('renders mobile menu button when onToggleSidebarMobile is provided', () => {
    const tree = React.createElement(
      RoleProvider,
      null,
      React.createElement(
        EventScopeProvider,
        { initialEvents: MOCK_EVENTS },
        React.createElement(Header, {
          title: 'Tổng quan',
          onToggleSidebarMobile: () => {},
        })
      )
    );

    const html = renderToStaticMarkup(tree);

    expect(html).toContain('aria-label="Mở thanh điều hướng"');
    expect(html).toContain('lg:hidden');
  });

  it('does NOT render legacy family-view "Chỉ xem" badge or role switcher button', () => {
    const tree = React.createElement(
      RoleProvider,
      null,
      React.createElement(
        EventScopeProvider,
        { initialEvents: MOCK_EVENTS },
        React.createElement(Header, { title: 'Tổng quan' })
      )
    );

    const html = renderToStaticMarkup(tree);
    expect(html).not.toContain('Chỉ xem');
    expect(html).not.toContain('Vai trò:');
  });

  it('renders optional badge when provided', () => {
    const tree = React.createElement(
      RoleProvider,
      null,
      React.createElement(
        EventScopeProvider,
        { initialEvents: MOCK_EVENTS },
        React.createElement(Header, { title: 'Ngân sách', badge: 'Bản nháp' })
      )
    );

    const html = renderToStaticMarkup(tree);

    expect(html).toContain('Bản nháp');
    expect(html).toContain('bg-[#FFF8E1]');
    expect(html).toContain('text-[#854D0E]');
  });

  it('EventScopeSelector renders "Chi phí / Việc chung" and events list', () => {
    const tree = React.createElement(
      RoleProvider,
      null,
      React.createElement(
        EventScopeProvider,
        { initialEvents: MOCK_EVENTS, initialScope: 'all' },
        React.createElement(Header, { title: 'Khách mời' })
      )
    );

    const html = renderToStaticMarkup(tree);

    expect(html).toContain('id="event-scope-select"');
    expect(html).toContain('Tất cả buổi (Tổng hợp)');
    expect(html).toContain('Chi phí / Việc chung');
    expect(html).toContain('Lễ Ăn Hỏi');
    expect(html).toContain('Tiệc Cưới Chính (Đại diện)');
    expect(html).toContain('Lễ Lại Mặt (Đã hủy)');
  });

  it('EventScopeSelector does not render when showScopeSelector is false', () => {
    const tree = React.createElement(
      RoleProvider,
      null,
      React.createElement(
        EventScopeProvider,
        { initialEvents: MOCK_EVENTS },
        React.createElement(Header, { title: 'Cài đặt', showScopeSelector: false })
      )
    );

    const html = renderToStaticMarkup(tree);

    expect(html).not.toContain('id="event-scope-select"');
  });

  it('renders Primary CTA consistently', () => {
    const ctaButton = React.createElement(
      'button',
      { className: 'btn-primary' },
      'Thêm khách mới'
    );

    const tree = React.createElement(
      RoleProvider,
      null,
      React.createElement(
        EventScopeProvider,
        { initialEvents: MOCK_EVENTS },
        React.createElement(Header, {
          title: 'Khách mời',
          primaryAction: ctaButton,
        })
      )
    );

    const html = renderToStaticMarkup(tree);
    expect(html).toContain('Thêm khách mới');
  });

  it('renders Notification Bell without a fabricated unread indicator', () => {
    const tree = React.createElement(
      RoleProvider,
      null,
      React.createElement(
        EventScopeProvider,
        { initialEvents: MOCK_EVENTS },
        React.createElement(Header, { title: 'Tổng quan' })
      )
    );

    const html = renderToStaticMarkup(tree);

    expect(html).toContain('aria-label="Thông báo"');
    expect(html).not.toContain('bg-[#B42318]');
  });
});
