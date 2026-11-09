'use client';

import * as React from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { InvitationsManager } from '@/components/modules/invitations/InvitationsManager';
import { usePrototype } from '@/components/testing/PrototypeToolbar';

const h = React.createElement;

export default function InvitationsPage() {
  const { state } = usePrototype();

  return h(
    PageShell,
    {
      title: 'Thiệp Mời',
      breadcrumbs: [
        { label: 'Trang chủ', href: '/overview' },
        { label: 'Thiệp mời', href: '/invitations' },
      ],
      showScopeSelector: true,
      maxWidth: 'standard',
    },
    h(InvitationsManager, {
      initialState: state,
    })
  );
}
