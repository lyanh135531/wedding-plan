'use client';

import * as React from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { R2SignoffDashboard } from '@/components/modules/r2-signoff';
import { HandoversDashboard } from '@/components/modules/handovers/HandoversDashboard';
import { usePrototype } from '@/components/testing/PrototypeToolbar';
import { useEventScope } from '@/context/EventScopeContext';

const h = React.createElement;

export default function HandoversPage() {
  const { state } = usePrototype();
  const { currentScope, availableEvents } = useEventScope();
  const eventId = currentScope !== 'all' ? currentScope : (availableEvents[0]?.id || '');
  const [tab, setTab] = React.useState<'dayof' | 'r2'>('dayof');

  return h(
    PageShell,
    {
      title: 'Bàn Giao & Nghiệm Thu',
      breadcrumbs: [
        { label: 'Trang chủ', href: '/overview' },
        { label: 'Bàn giao', href: '/handovers' },
      ],
      showScopeSelector: true,
      maxWidth: 'standard',
    },
    h(
      'div',
      { className: 'space-y-4' },
      h(
        'div',
        { className: 'flex gap-2 border-b border-border-subtle pb-2 print:hidden' },
        h(
          'button',
          {
            type: 'button',
            onClick: () => setTab('dayof'),
            className: `px-4 py-2 text-xs font-semibold rounded ${
              tab === 'dayof' ? 'bg-primary text-white' : 'bg-gray-100 text-text-muted hover:text-text-main'
            }`,
          },
          'Bộ bàn giao ngày cưới (A4 Pack)'
        ),
        h(
          'button',
          {
            type: 'button',
            onClick: () => setTab('r2'),
            className: `px-4 py-2 text-xs font-semibold rounded ${
              tab === 'r2' ? 'bg-primary text-white' : 'bg-gray-100 text-text-muted hover:text-text-main'
            }`,
          },
          'Bản chốt nghiệm thu R2'
        )
      ),
      tab === 'dayof'
        ? h(HandoversDashboard, { eventId })
        : h(R2SignoffDashboard, { initialState: state })
    )
  );
}
