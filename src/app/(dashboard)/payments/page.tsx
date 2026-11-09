'use client';

import * as React from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { PaymentsLedgerScreen } from '@/components/modules/finance/PaymentsLedgerScreen';
import { usePrototype } from '@/components/testing/PrototypeToolbar';

const h = React.createElement;

export default function PaymentsPage() {
  const { state } = usePrototype();

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
    h(PaymentsLedgerScreen, {
      initialState: state,
    })
  );
}
