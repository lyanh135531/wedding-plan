'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRole } from '@/context/RoleContext';

export interface NavItemConfig {
  name: string;
  href: string;
  icon?: string;
  badge?: string;
  milestone?: 'R1' | 'R2' | 'R3';
  isFinancial?: boolean;
}

export interface NavGroupConfig {
  groupTitle: string;
  items: NavItemConfig[];
  isFinancialGroup?: boolean;
}

export const SIDEBAR_NAV_GROUPS: readonly NavGroupConfig[] = [
  {
    groupTitle: 'Tổng quan',
    items: [
      { name: 'Trang chủ', href: '/overview', milestone: 'R1' },
      { name: 'Thông báo', href: '/notifications', milestone: 'R1' },
      { name: 'Nhật ký hoạt động', href: '/history', milestone: 'R1' },
    ],
  },
  {
    groupTitle: 'Chuẩn bị',
    items: [
      { name: 'Công việc', href: '/tasks', milestone: 'R1' },
      { name: 'Lịch hẹn', href: '/calendar', milestone: 'R1' },
      { name: 'Nhà cung cấp', href: '/vendors', milestone: 'R2' },
      { name: 'Tài liệu & Ảnh', href: '/documents', milestone: 'R2' },
      { name: 'Ý tưởng cưới', href: '/ideas', milestone: 'R2' },
    ],
  },
  {
    groupTitle: 'Khách & tiệc',
    items: [
      { name: 'Khách mời', href: '/guests', milestone: 'R1' },
      { name: 'Thiệp mời', href: '/invitations', milestone: 'R1' },
      { name: 'Xếp bàn', href: '/seating', milestone: 'R2' },
      { name: 'Thực đơn', href: '/menus', milestone: 'R2' },
      { name: 'Lưu trú & Xe', href: '/logistics', milestone: 'R2' },
    ],
  },
  {
    groupTitle: 'Tài chính',
    isFinancialGroup: true,
    items: [
      { name: 'Ngân sách', href: '/budget', milestone: 'R1', isFinancial: true },
      { name: 'Thanh toán & Chi', href: '/payments', milestone: 'R1', isFinancial: true },
      { name: 'Sổ quỹ & Nguồn tiền', href: '/fund', milestone: 'R1', isFinancial: true },
      { name: 'Quà mừng', href: '/gifts', milestone: 'R3', isFinancial: true },
    ],
  },
  {
    groupTitle: 'Ngày cưới & cài đặt',
    items: [
      { name: 'Lịch trình ngày cưới', href: '/timeline', milestone: 'R3' },
      { name: 'Bộ bàn giao ngày cưới', href: '/handovers', milestone: 'R3' },
      { name: 'Đội hỗ trợ', href: '/support', milestone: 'R2' },
      { name: 'Đồ dùng cần chuẩn bị', href: '/preparation', milestone: 'R2' },
      { name: 'Hậu cưới & Lưu trữ', href: '/after-wedding', milestone: 'R3' },
      { name: 'Cài đặt chung', href: '/settings', milestone: 'R1' },
      { name: 'Chia sẻ quyền', href: '/sharing', milestone: 'R1' },
      { name: 'Nhập dữ liệu', href: '/data/import', milestone: 'R1' },
      { name: 'Xuất dữ liệu & Bản in', href: '/data/export', milestone: 'R1' },
    ],
  },
];

export interface DesktopSidebarProps {
  isDrawer?: boolean;
  className?: string;
  onNavigate?: () => void;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  isDrawer = false,
  className = '',
  onNavigate,
}) => {
  const pathname = usePathname() || '';
  const { isFamily, canAccessRoute } = useRole();
  const h = React.createElement;

  const containerClasses = isDrawer
    ? `flex flex-col w-full h-full bg-white select-none overflow-y-auto ${className}`
    : `hidden lg:flex flex-col w-[240px] h-screen fixed top-0 left-0 bg-white border-r border-[#E2E8E4] z-30 select-none overflow-y-auto ${className}`;

  return h(
    'aside',
    {
      className: containerClasses,
      'aria-label': 'Thanh điều hướng chính',
    },
    // Brand Header
    h(
      'div',
      { className: 'h-16 flex items-center px-6 border-b border-[#E2E8E4] shrink-0' },
      h(
        'div',
        null,
        h(
          'span',
          { className: 'font-semibold text-base text-[#1F2933] block leading-tight' },
          'Sổ Quản Lý Đám Cưới'
        ),
        h(
          'span',
          { className: 'text-xs text-[#52616B] block mt-0.5' },
          isFamily ? 'Quyền: Người nhà (Chỉ xem)' : 'Quyền: Chủ sở hữu'
        )
      )
    ),

    // Nav Groups
    h(
      'div',
      { className: 'flex-1 py-4 px-3 space-y-6' },
      SIDEBAR_NAV_GROUPS.map((group) => {
        // BẢO MẬT: Ẩn 100% nhóm Tài chính nếu là Người nhà
        if (group.isFinancialGroup && isFamily) {
          return null;
        }

        // Lọc danh sách items theo phân quyền
        const visibleItems = group.items.filter((item) => {
          if (isFamily) {
            if (item.isFinancial) return false;
            if (!canAccessRoute(item.href)) return false;
          }
          return true;
        });

        if (visibleItems.length === 0) {
          return null;
        }

        return h(
          'div',
          { key: group.groupTitle, className: 'space-y-1' },
          h(
            'h3',
            {
              className:
                'px-3 text-xs font-semibold text-[#52616B] uppercase tracking-wider mb-2',
            },
            group.groupTitle
          ),
          h(
            'ul',
            { className: 'space-y-0.5' },
            visibleItems.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);

              return h(
                'li',
                { key: item.href },
                h(
                  Link,
                  {
                    href: item.href,
                    onClick: onNavigate,
                    className: `flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-[#23483E] text-white'
                        : 'text-[#1F2933] hover:bg-[#F7F5F0] hover:text-[#19382F]'
                    }`,
                    'aria-current': isActive ? 'page' : undefined,
                  },
                  h('span', { className: 'truncate' }, item.name),
                  item.milestone && item.milestone !== 'R1'
                    ? h(
                        'span',
                        {
                          className: `text-[10px] px-1.5 py-0.5 rounded font-normal shrink-0 ${
                            isActive
                              ? 'bg-[#19382F] text-gray-200'
                              : 'bg-[#E2E8E4] text-[#52616B]'
                          }`,
                        },
                        item.milestone
                      )
                    : null
                )
              );
            })
          )
        );
      })
    ),

    // Footer System Info
    h(
      'div',
      { className: 'p-4 border-t border-[#E2E8E4] text-xs text-[#52616B] shrink-0' },
      h('div', null, 'Múi giờ: Asia/Ho_Chi_Minh'),
      h('div', { className: 'mt-0.5 font-mono text-[11px]' }, 'Tiền tệ: VND (bigint)')
    )
  );
};
