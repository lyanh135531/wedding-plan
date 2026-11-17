'use client';

import * as React from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { ArchivalDashboard } from '@/components/modules/archival/ArchivalDashboard';

const h = React.createElement;

export default function AfterWeddingPage() {
  return h(
    PageShell,
    {
      title: 'Hậu Cưới & Lưu Trữ',
      breadcrumbs: [
        { label: 'Trang chủ', href: '/overview' },
        { label: 'Hậu cưới & Lưu trữ', href: '/after-wedding' },
      ],
      showScopeSelector: false,
      maxWidth: 'standard',
    },
    h(ArchivalDashboard)
  );
}
