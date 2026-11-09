'use client';

import * as React from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { BudgetScreen } from '@/components/modules/finance/BudgetScreen';
import { usePrototype } from '@/components/testing/PrototypeToolbar';

const h = React.createElement;

export default function BudgetPage() {
  const { state } = usePrototype();

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
    h(BudgetScreen, {
      initialState: state,
    })
  );
}
