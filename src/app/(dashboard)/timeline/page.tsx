'use client';

import * as React from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { TimelineManager } from '@/components/modules/timeline/TimelineManager';
import { usePrototype } from '@/components/testing/PrototypeToolbar';

const h = React.createElement;

export default function TimelinePage() {
  const { state } = usePrototype();

  return h(
    PageShell,
    {
      title: 'Lịch Trình Ngày Cưới',
      breadcrumbs: [
        { label: 'Trang chủ', href: '/overview' },
        { label: 'Lịch trình ngày cưới', href: '/timeline' },
      ],
      showScopeSelector: false,
      maxWidth: 'standard',
    },
    h(TimelineManager, {
      initialState: state,
    })
  );
}
