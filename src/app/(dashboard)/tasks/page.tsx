'use client';

import * as React from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { TasksManager } from '@/components/modules/tasks/TasksManager';
import { usePrototype } from '@/components/testing/PrototypeToolbar';

const h = React.createElement;

export default function TasksPage() {
  const { state } = usePrototype();

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
    h(TasksManager, {
      initialState: state,
    })
  );
}
