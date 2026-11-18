'use client';

import * as React from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { LiveSeatingWorkspace } from '@/components/modules/seating/LiveSeatingWorkspace';

const h = React.createElement;

export default function SeatingPage() {

  return h(
    PageShell,
    {
      title: 'Xếp Bàn Tiệc',
      breadcrumbs: [
        { label: 'Trang chủ', href: '/overview' },
        { label: 'Xếp bàn', href: '/seating' },
      ],
      showScopeSelector: true,
      maxWidth: 'standard',
    },
    h(LiveSeatingWorkspace)
  );
}
