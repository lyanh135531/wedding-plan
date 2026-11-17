'use client';

import * as React from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { R2SignoffDashboard } from '@/components/modules/r2-signoff';
import { usePrototype } from '@/components/testing/PrototypeToolbar';

const h = React.createElement;

export default function HandoversPage() {
  const { state } = usePrototype();

  return h(
    PageShell,
    {
      title: 'Bản Chốt & Bàn Giao (Nghiệm Thu R2)',
      breadcrumbs: [
        { label: 'Trang chủ', href: '/overview' },
        { label: 'Bản chốt & Bàn giao', href: '/handovers' },
      ],
      showScopeSelector: true,
      maxWidth: 'standard',
    },
    h(R2SignoffDashboard, {
      initialState: state,
    })
  );
}
