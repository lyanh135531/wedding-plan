'use client';

import * as React from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { LiveTasksManager } from '@/components/modules/tasks/LiveTasksManager';

const h = React.createElement;

export default function TasksPage() {

  return h(
    PageShell,
    {
      title: 'Công Việc',
      breadcrumbs: [
        { label: 'Trang chủ', href: '/overview' },
        { label: 'Công việc', href: '/tasks' },
      ],
      showScopeSelector: true,
      maxWidth: 'standard',
    },
    h(LiveTasksManager)
  );
}
