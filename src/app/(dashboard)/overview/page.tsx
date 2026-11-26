'use client';

import * as React from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { LiveOverviewDashboard } from '@/components/modules/overview/LiveOverviewDashboard';

export default function OverviewPage() {
  return (
    <PageShell
      title="Trang Chủ"
      breadcrumbs={[{ label: 'Trang chủ', href: '/overview' }]}
      showScopeSelector={false}
      maxWidth="standard"
    >
      <LiveOverviewDashboard />
    </PageShell>
  );
}
