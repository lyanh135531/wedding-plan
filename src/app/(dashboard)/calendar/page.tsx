'use client';

import * as React from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { CalendarAgendaView } from '@/components/modules/calendar/CalendarAgendaView';
import { usePrototype } from '@/components/testing/PrototypeToolbar';

const h = React.createElement;

export default function CalendarPage() {
  const { state } = usePrototype();

  return h(
    PageShell,
    {
      title: 'Lịch Hẹn',
      breadcrumbs: [
        { label: 'Trang chủ', href: '/overview' },
        { label: 'Lịch hẹn', href: '/calendar' },
      ],
      showScopeSelector: true,
      maxWidth: 'standard',
    },
    h(CalendarAgendaView, {
      initialState: state,
    })
  );
}
