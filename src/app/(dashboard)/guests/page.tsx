'use client';

import * as React from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { LiveGuestsDirectory } from '@/components/modules/guests/LiveGuestsDirectory';

const h = React.createElement;

export default function GuestsPage() {

  return h(
    PageShell,
    {
      title: 'Khách Mời',
      breadcrumbs: [
        { label: 'Trang chủ', href: '/overview' },
        { label: 'Khách mời', href: '/guests' },
      ],
      showScopeSelector: true,
      maxWidth: 'standard',
    },
    h(LiveGuestsDirectory)
  );
}
