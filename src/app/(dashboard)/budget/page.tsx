'use client';

import * as React from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { LiveBudgetWorkspace } from '@/components/modules/finance/LiveBudgetWorkspace';

export default function BudgetPage() {
  return (
    <PageShell
      title="Ngân Sách"
      breadcrumbs={[
        { label: 'Trang chủ', href: '/overview' },
        { label: 'Ngân sách', href: '/budget' },
      ]}
      showScopeSelector={true}
      maxWidth="standard"
    >
      <LiveBudgetWorkspace />
    </PageShell>
  );
}
