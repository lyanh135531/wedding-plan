'use client';

import * as React from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { LiveOverviewDashboard } from '@/components/modules/overview/LiveOverviewDashboard';

const h = React.createElement;

export default function OverviewPage() {

  return h(
    PageShell,
    {
      title: 'Tổng Quan Đám Cưới',
      breadcrumbs: [{ label: 'Trang chủ', href: '/overview' }],
      showScopeSelector: false,
      maxWidth: 'standard',
    },
    h(LiveOverviewDashboard)
  );
}
