'use client';

import * as React from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { SeatingManager } from '@/components/modules/seating/SeatingManager';
import { usePrototype } from '@/components/testing/PrototypeToolbar';

const h = React.createElement;

export default function SeatingPage() {
  const { state } = usePrototype();

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
    h(SeatingManager, {
      initialState: state,
    })
  );
}
