'use client';
import { PageShell } from '@/components/layout/PageShell';
import { EventWorkspace } from '@/components/common/ResourceWorkspace';
import { CheckInDashboard } from '@/components/modules/attendance/CheckInDashboard';
export default function Page() { return <PageShell title="Điểm danh khách" showScopeSelector><EventWorkspace>{eventId => <CheckInDashboard eventId={eventId} />}</EventWorkspace></PageShell>; }
