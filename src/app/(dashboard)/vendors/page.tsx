'use client';

import * as React from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { VendorsDirectory } from '@/components/modules/vendors/VendorsDirectory';

export default function VendorsPage() {
  return React.createElement(
    PageShell,
    {
      title: 'Nhà Cung Cấp',
      breadcrumbs: [
        { label: 'Trang chủ', href: '/overview' },
        { label: 'Nhà cung cấp', href: '/vendors' },
      ],
      showScopeSelector: false,
      maxWidth: 'standard',
    },
    React.createElement(VendorsDirectory, null)
  );
}
