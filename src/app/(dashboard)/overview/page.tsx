'use client';

import * as React from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { OverviewDashboard } from '@/components/modules/overview/OverviewDashboard';
import { usePrototype } from '@/components/testing/PrototypeToolbar';

const h = React.createElement;

export default function OverviewPage() {
  const { state } = usePrototype();

  return h(
    PageShell,
    {
      title: 'Tổng Quan Đám Cưới',
      breadcrumbs: [{ label: 'Trang chủ', href: '/overview' }],
      showScopeSelector: true,
      maxWidth: 'standard',
    },
    h(OverviewDashboard, {
      initialState: state,
    })
  );
}
