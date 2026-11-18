'use client';

import React from 'react';
import Link from 'next/link.js';
import { usePathname } from 'next/navigation.js';
import { LayoutDashboard, Users, Wallet, CheckSquare, Menu as MenuIcon } from 'lucide-react';
import { useRole } from '@/context/RoleContext';
import { useNavVisibility } from '@/hooks/useNavVisibility';

export interface MobileBottomNavProps {
  onOpenMobileMenu?: () => void;
  isModalOpen?: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  onOpenMobileMenu,
  isModalOpen = false,
}) => {
  const pathname = usePathname() || '';
  const { isOwner } = useRole();
  const isVisible = useNavVisibility(isModalOpen);
  const h = React.createElement;

  // Tabs cho Chủ sở hữu: 5 tabs (4 link + 1 Menu button)
  const ownerTabs = [
    { label: 'Tổng quan', href: '/overview', Icon: LayoutDashboard },
    { label: 'Khách', href: '/guests', Icon: Users },
    { label: 'Ngân sách', href: '/budget', Icon: Wallet },
    { label: 'Công việc', href: '/tasks', Icon: CheckSquare },
  ];

  // Tabs cho Người nhà: 3 tabs chính trong R1 (không có Ngân sách) + 1 Menu button
  const familyTabs = [
    { label: 'Tổng quan', href: '/overview', Icon: LayoutDashboard },
    { label: 'Khách', href: '/guests', Icon: Users },
  ];

  const activeTabs = isOwner ? ownerTabs : familyTabs;

  return h(
    'nav',
    {
      className: `lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-[#E2E8E4] z-40 transition-transform duration-180 ${
        isVisible ? 'translate-y-0' : 'translate-y-full'
      }`,
      'aria-label': 'Thanh điều hướng di động',
    },
    h(
      'div',
      { className: 'flex h-full items-center justify-around px-2' },
      activeTabs.map((tab) => {
        const isActive =
          pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        const TabIcon = tab.Icon;

        return h(
          Link,
          {
            key: tab.href,
            href: tab.href,
            className: `flex flex-col items-center justify-center flex-1 py-1 min-h-[44px] transition-colors ${
              isActive
                ? 'text-[#23483E] font-semibold'
                : 'text-[#52616B] hover:text-[#1F2933]'
            }`,
            'aria-current': isActive ? 'page' : undefined,
          },
          h(TabIcon, {
            className: `w-5 h-5 mb-0.5 ${
              isActive ? 'text-[#23483E]' : 'text-[#7A8881]'
            }`,
            'aria-hidden': 'true',
          }),
          h(
            'span',
            {
              className: 'text-[12px] leading-tight text-center truncate max-w-[64px]',
            },
            tab.label
          )
        );
      }),

      // Nút Menu mở toàn bộ phân hệ còn lại
      h(
        'button',
        {
          type: 'button',
          onClick: onOpenMobileMenu,
          className:
            'flex flex-col items-center justify-center flex-1 py-1 min-h-[44px] text-[#52616B] hover:text-[#1F2933] transition-colors',
          'aria-label': 'Mở danh mục điều hướng mở rộng',
        },
        h(MenuIcon, { className: 'w-5 h-5 mb-0.5 text-[#7A8881]', 'aria-hidden': 'true' }),
        h('span', { className: 'text-[12px] leading-tight text-center' }, 'Menu')
      )
    )
  );
};
