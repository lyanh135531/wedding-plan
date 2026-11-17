'use client';

import * as React from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { GiftsDashboard } from '@/components/modules/gifts/GiftsDashboard';
import { useEventScope } from '@/context/EventScopeContext';

const h = React.createElement;

export default function GiftsPage() {
  const { currentScope, availableEvents } = useEventScope();
  const eventId = currentScope !== 'all' ? currentScope : (availableEvents[0]?.id || '');

  return h(
    PageShell,
    {
      title: 'Quà Mừng & Đối Soát',
      breadcrumbs: [
        { label: 'Trang chủ', href: '/overview' },
        { label: 'Quà mừng', href: '/gifts' },
      ],
      showScopeSelector: true,
      maxWidth: 'standard',
    },
    h(GiftsDashboard, {
      eventId,
    })
  );
}
