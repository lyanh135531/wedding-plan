'use client';

import * as React from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { LiveMusicWorkspace } from '@/components/modules/music/LiveMusicWorkspace';

export default function MusicPage() {
  return (
    <PageShell
      title="Chọn Nhạc Lễ Cưới"
      breadcrumbs={[
        { label: 'Trang chủ', href: '/overview' },
        { label: 'Chọn nhạc', href: '/music' },
      ]}
      showScopeSelector
      maxWidth="standard"
    >
      <LiveMusicWorkspace />
    </PageShell>
  );
}
