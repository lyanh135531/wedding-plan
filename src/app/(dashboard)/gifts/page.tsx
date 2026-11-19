'use client';
import { PageShell } from '@/components/layout/PageShell';
import { EventWorkspace } from '@/components/common/ResourceWorkspace';
import { GiftsDashboard } from '@/components/modules/gifts/GiftsDashboard';
export default function Page(){return <PageShell title="Quà mừng & Đối soát" showScopeSelector><EventWorkspace>{eventId=><GiftsDashboard eventId={eventId}/>}</EventWorkspace></PageShell>;}
