'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { PageShell } from '@/components/layout/PageShell';
import { PreparationScreen, PreparationTab } from '@/components/modules/preparation';
import { FeaturePreview } from '@/components/common/FeaturePreview';
import { usePrototype } from '@/components/testing/PrototypeToolbar';

const h = React.createElement;

function PreparationContent() {
  const { state } = usePrototype();
  let initialTab: PreparationTab = 'items';

  try {
    const searchParams = useSearchParams();
    const tabParam = searchParams ? (searchParams.get('tab') as PreparationTab) : null;
    if (tabParam && ['items', 'music', 'shots', 'linked-ideas'].includes(tabParam)) {
      initialTab = tabParam;
    }
  } catch {
    // In environments where useSearchParams is not available
  }

  return h(FeaturePreview, null, h(PreparationScreen, {
    initialState: state,
    initialTab,
  }));
}

export default function PreparationPage() {
  return h(
    PageShell,
    {
      title: 'Đồ Dùng & Chuẩn Bị',
      breadcrumbs: [
        { label: 'Trang chủ', href: '/overview' },
        { label: 'Chuẩn bị & Checklist', href: '/preparation' },
      ],
      showScopeSelector: true,
      maxWidth: 'standard',
    },
    h(
      React.Suspense,
      { fallback: h('div', { className: 'p-6 text-xs text-gray-500' }, 'Đang tải...') },
      h(PreparationContent, null)
    )
  );
}
