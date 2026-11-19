'use client';
import { PageShell } from '@/components/layout/PageShell';
import { LivePlanningWorkspace } from '@/components/modules/LivePlanningWorkspace';
export default function Page(){return <PageShell title="Thực đơn" showScopeSelector><LivePlanningWorkspace module="menus"/></PageShell>;}
