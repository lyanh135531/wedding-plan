'use client';

import * as React from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { IdeasScreen } from '@/components/modules/ideas';
import { usePrototype } from '@/components/testing/PrototypeToolbar';

const h = React.createElement;

export default function IdeasPage() {
  const { state } = usePrototype();

  return h(
    PageShell,
    {
      title: 'Ý Tưởng & Moodboard',
      breadcrumbs: [
        { label: 'Trang chủ', href: '/overview' },
        { label: 'Ý tưởng & Cảm hứng', href: '/ideas' },
      ],
      showScopeSelector: true,
      maxWidth: 'standard',
    },
    h(IdeasScreen, {
      initialState: state,
    })
  );
}
