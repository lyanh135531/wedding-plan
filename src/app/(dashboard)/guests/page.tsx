'use client';

import * as React from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { GuestsDirectory } from '@/components/modules/guests/GuestsDirectory';
import { usePrototype } from '@/components/testing/PrototypeToolbar';

const h = React.createElement;

export default function GuestsPage() {
  const { state } = usePrototype();

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
    h(GuestsDirectory, {
      initialState: state,
    })
  );
}
