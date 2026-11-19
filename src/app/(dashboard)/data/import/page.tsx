'use client';
import { PageShell } from '@/components/layout/PageShell';
import { LiveDataImport } from '@/components/modules/data-import/LiveDataImport';
export default function Page(){return <PageShell title="Nhập dữ liệu" showScopeSelector={false}><LiveDataImport/></PageShell>;}
