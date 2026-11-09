'use client';

import * as React from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { DataExportView } from '@/components/modules/data-export/DataExportView';

const h = React.createElement;

export default function DataExportPage() {
  return h(
    PageShell,
    {
      title: 'Xuất Dữ Liệu & Bản In',
      breadcrumbs: [
        { label: 'Trang chủ', href: '/overview' },
        { label: 'Xuất dữ liệu & Bản in', href: '/data/export' },
      ],
      showScopeSelector: false,
      maxWidth: 'standard',
    },
    h(DataExportView, null)
  );
}
