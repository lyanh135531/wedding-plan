'use client';

import * as React from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { LiveCalendarView } from '@/components/modules/calendar/LiveCalendarView';

const h = React.createElement;

export default function CalendarPage() {

  return h(
    PageShell,
    {
      title: 'Lịch Hẹn',
      breadcrumbs: [
        { label: 'Trang chủ', href: '/overview' },
        { label: 'Lịch hẹn', href: '/calendar' },
      ],
      showScopeSelector: false,
      maxWidth: 'standard',
    },
    h(LiveCalendarView)
  );
}
