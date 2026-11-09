'use client';

import * as React from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { DataImportWizard } from '@/components/modules/data-import/DataImportWizard';
import { usePrototype } from '@/components/testing/PrototypeToolbar';

const h = React.createElement;

export default function DataImportPage() {
  const { state } = usePrototype();

  return h(
    PageShell,
    {
      title: 'Nhập Dữ Liệu Khách Mời',
      breadcrumbs: [
        { label: 'Trang chủ', href: '/overview' },
        { label: 'Nhập dữ liệu', href: '/data/import' },
      ],
      showScopeSelector: false,
      maxWidth: 'standard',
    },
    h(DataImportWizard, {
      initialState: state,
    })
  );
}
