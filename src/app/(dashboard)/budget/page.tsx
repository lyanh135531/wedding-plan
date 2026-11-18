'use client';

import * as React from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { LiveFinanceWorkspace } from '@/components/modules/finance/LiveFinanceWorkspace';

const h = React.createElement;

export default function BudgetPage() {

  return h(
    PageShell,
    {
      title: 'Ngân Sách',
      breadcrumbs: [
        { label: 'Trang chủ', href: '/overview' },
        { label: 'Ngân sách', href: '/budget' },
      ],
      showScopeSelector: true,
      maxWidth: 'standard',
    },
    h(LiveFinanceWorkspace, { view: 'budget' })
  );
}
