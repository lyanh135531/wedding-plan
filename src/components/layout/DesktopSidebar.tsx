'use client';

import React from 'react';
import Link from 'next/link.js';
import { usePathname } from 'next/navigation.js';
import { useRole } from '@/context/RoleContext';
import { BrandMark } from '@/components/common/BrandMark';
import { Home, CheckSquare, Calendar, Briefcase, FileText, Lightbulb, Users, Mail, LayoutGrid, Utensils, Truck, Wallet, Receipt, Landmark, Gift, Clock, ClipboardList, HeartHandshake, Package, Settings, Upload, Download, History, Lock, type LucideIcon } from 'lucide-react';

const NAV_ICONS: Record<string, LucideIcon> = {
  '/overview': Home, '/history': History, '/tasks': CheckSquare, '/calendar': Calendar,
  '/vendors': Briefcase, '/documents': FileText, '/ideas': Lightbulb, '/guests': Users,
  '/invitations': Mail, '/seating': LayoutGrid, '/menus': Utensils, '/logistics': Truck,
  '/budget': Wallet, '/payments': Receipt, '/fund': Landmark, '/gifts': Gift,
  '/timeline': Clock, '/handovers': ClipboardList, '/support': HeartHandshake,
  '/preparation': Package, '/settings': Settings, '/data/import': Upload, '/data/export': Download,
};

export interface NavItemConfig {
  name: string;
  href: string;
  icon?: string;
  badge?: string;
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
      { name: 'Trang chủ', href: '/overview' },
      { name: 'Nhật ký hoạt động', href: '/history' },
    ],
  },
  {
    groupTitle: 'Chuẩn bị',
    items: [
      { name: 'Công việc', href: '/tasks' },
      { name: 'Lịch hẹn', href: '/calendar' },
      { name: 'Nhà cung cấp', href: '/vendors' },
      { name: 'Tài liệu & Ảnh', href: '/documents' },
      { name: 'Ý tưởng cưới', href: '/ideas' },
    ],
  },
  {
    groupTitle: 'Khách & tiệc',
    items: [
      { name: 'Khách mời', href: '/guests' },
      { name: 'Thiệp mời', href: '/invitations' },
      { name: 'Xếp bàn', href: '/seating' },
      { name: 'Thực đơn', href: '/menus' },
      { name: 'Lưu trú & Xe', href: '/logistics' },
    ],
  },
  {
    groupTitle: 'Tài chính',
    isFinancialGroup: true,
    items: [
      { name: 'Ngân sách', href: '/budget', isFinancial: true },
      { name: 'Thanh toán & Chi', href: '/payments', isFinancial: true },
      { name: 'Sổ quỹ & Nguồn tiền', href: '/fund', isFinancial: true },
      { name: 'Quà mừng', href: '/gifts', isFinancial: true },
    ],
  },
  {
    groupTitle: 'Ngày cưới & cài đặt',
    items: [
      { name: 'Lịch trình ngày cưới', href: '/timeline' },
      { name: 'Bộ bàn giao ngày cưới', href: '/handovers' },
      { name: 'Đội hỗ trợ', href: '/support' },
      { name: 'Đồ dùng cần chuẩn bị', href: '/preparation' },
      { name: 'Cài đặt chung', href: '/settings' },
      { name: 'Nhập dữ liệu', href: '/data/import' },
      { name: 'Xuất dữ liệu & Bản in', href: '/data/export' },
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
    ? `app-sidebar flex flex-col w-full h-full select-none overflow-y-auto ${className}`
    : `app-sidebar hidden lg:flex flex-col w-[240px] h-screen fixed top-0 left-0 border-r border-white/5 z-30 select-none overflow-y-auto ${className}`;

  return h(
    'aside',
    {
      className: containerClasses,
      'aria-label': 'Thanh điều hướng chính',
    },
    // Brand Header
    h(
      'div',
      { className: 'min-h-[96px] flex items-center gap-3 px-5 py-5 border-b border-white/10 shrink-0' },
      h(BrandMark, { className: 'w-10 h-10 shrink-0 text-[#D4BF8F]' }),
      h(
        'div',
        null,
        h(
          'span',
          { className: 'font-serif font-medium text-[17px] text-[#F6F3E9] block leading-snug' },
          'Sổ Quản Lý Đám Cưới'
        ),
        h(
          'span',
          { className: 'text-[10px] text-[#B8C4B8] block mt-2' },
          isFamily ? 'Quyền: Người nhà (Chỉ xem)' : 'Quyền: Chủ sở hữu'
        )
      )
    ),

    // Nav Groups
    h(
      'div',
      { className: 'flex-1 py-5 px-3 space-y-5' },
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
                'nav-group-title px-3 uppercase mb-2',
            },
            group.groupTitle
          ),
          h(
            'ul',
            { className: 'space-y-0.5' },
            visibleItems.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = NAV_ICONS[item.href] || FileText;

              return h(
                'li',
                { key: item.href },
                h(
                  Link,
                  {
                    href: item.href,
                    prefetch: false,
                    onClick: onNavigate,
                    className: `nav-link flex items-center gap-3 px-3 py-2.5 rounded-control font-normal transition-colors min-h-[44px] lg:min-h-10 ${
                      isActive
                        ? 'nav-link--active'
                        : ''
                    }`,
                    'aria-current': isActive ? 'page' : undefined,
                  },
                  h(Icon, { className: 'w-[15px] h-[15px] shrink-0', strokeWidth: 1.5, 'aria-hidden': true }),
                  h('span', { className: 'truncate' }, item.name)
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
      { className: 'p-5 border-t border-white/10 text-[10px] text-[#B8C4B8] shrink-0 space-y-2' },
      h('div', { className: 'flex items-center gap-2' }, h(Lock, { className: 'w-3 h-3', 'aria-hidden': true }), 'Không gian riêng của gia đình'),
      h('div', { className: 'text-[#8DA397] tracking-wide' }, 'Giờ Việt Nam · VND')
    )
  );
};
