'use client';

import * as React from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { LiveInvitationsWorkspace } from '@/components/modules/invitations/LiveInvitationsWorkspace';

export default function InvitationsPage() {
  return (
    <PageShell
      title="Thiệp Mời"
      breadcrumbs={[
        { label: 'Trang chủ', href: '/overview' },
        { label: 'Thiệp mời', href: '/invitations' },
      ]}
      showScopeSelector={true}
      maxWidth="standard"
    >
      <LiveInvitationsWorkspace />
    </PageShell>
  );
}
