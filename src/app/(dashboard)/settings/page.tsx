'use client';

import * as React from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { LiveSettingsWorkspace } from '@/components/modules/settings/LiveSettingsWorkspace';

export default function SettingsPage() {
  return (
    <PageShell
      title="Cài Đặt Chung"
      breadcrumbs={[
        { label: 'Trang chủ', href: '/overview' },
        { label: 'Cài đặt', href: '/settings' },
      ]}
      showScopeSelector={false}
      maxWidth="standard"
    >
      <LiveSettingsWorkspace />
    </PageShell>
  );
}
