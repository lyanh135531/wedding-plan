'use client';

import * as React from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { LogisticsScreen } from '@/components/modules/logistics';
import { FeaturePreview } from '@/components/common/FeaturePreview';
import { usePrototype } from '@/components/testing/PrototypeToolbar';

const h = React.createElement;

export default function LogisticsPage() {
  const { state } = usePrototype();

  return h(
    PageShell,
    {
      title: 'Lưu Trú & Di Chuyển',
      breadcrumbs: [
        { label: 'Trang chủ', href: '/overview' },
        { label: 'Lưu trú & Xe', href: '/logistics' },
      ],
      showScopeSelector: true,
      maxWidth: 'standard',
    },
    h(FeaturePreview, null, h(LogisticsScreen, {
      initialState: state,
    }))
  );
}
