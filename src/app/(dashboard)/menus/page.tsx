'use client';

import * as React from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { MenusScreen } from '@/components/modules/menus';
import { usePrototype } from '@/components/testing/PrototypeToolbar';

const h = React.createElement;

export default function MenusPage() {
  const { state } = usePrototype();

  return h(
    PageShell,
    {
      title: 'Thực Đơn & Suất Ăn',
      breadcrumbs: [
        { label: 'Trang chủ', href: '/overview' },
        { label: 'Thực đơn', href: '/menus' },
      ],
      showScopeSelector: true,
      maxWidth: 'standard',
    },
    h(MenusScreen, {
      initialState: state,
    })
  );
}
