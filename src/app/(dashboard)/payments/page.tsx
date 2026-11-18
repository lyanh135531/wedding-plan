'use client';

import * as React from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { LiveFinanceWorkspace } from '@/components/modules/finance/LiveFinanceWorkspace';

const h = React.createElement;

export default function PaymentsPage() {

  return h(
    PageShell,
    {
      title: 'Thanh Toán & Chi',
      breadcrumbs: [
        { label: 'Trang chủ', href: '/overview' },
        { label: 'Thanh toán', href: '/payments' },
      ],
      showScopeSelector: true,
      maxWidth: 'standard',
    },
    h(LiveFinanceWorkspace, { view: 'payments' })
  );
}
