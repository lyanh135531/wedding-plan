'use client';
import { useState } from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { EventWorkspace } from '@/components/common/ResourceWorkspace';
import { LiveReadiness } from '@/components/modules/handovers/LiveReadiness';
import { HandoversDashboard } from '@/components/modules/handovers/HandoversDashboard';
import { useRole } from '@/context/RoleContext';
export default function HandoversPage() {
  const { isOwner } = useRole();
  const [tab, setTab] = useState<'dayof' | 'r2'>('dayof');
  return <PageShell title="Bàn Giao & Nghiệm Thu" breadcrumbs={[{ label: 'Trang chủ', href: '/overview' }, { label: 'Bàn giao', href: '/handovers' }]} showScopeSelector maxWidth="standard">
    <EventWorkspace>{eventId => <div className="space-y-4">
      <div className="flex gap-2 border-b border-border-subtle pb-2 print:hidden">
        {(['dayof', 'r2'] as const).map(value => <button key={value} type="button" onClick={() => setTab(value)} className={'min-h-11 px-4 py-2 text-xs font-semibold rounded ' + (tab === value ? 'bg-primary text-white' : 'bg-gray-100 text-text-muted hover:text-text-main')}>
          {value === 'dayof' ? 'Bộ bàn giao ngày cưới (A4 Pack)' : 'Bản chốt nghiệm thu R2'}
        </button>)}
      </div>
      {tab === 'dayof' ? <HandoversDashboard eventId={eventId}/> : isOwner ? <LiveReadiness eventId={eventId}/> : <p>Chỉ chủ sở hữu được xem nghiệm thu.</p>}
    </div>}</EventWorkspace>
  </PageShell>;
}
