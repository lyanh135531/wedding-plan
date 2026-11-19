'use client';

import * as React from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { SupportPartyScreen } from '@/components/modules/support';
import { FeaturePreview } from '@/components/common/FeaturePreview';
import { usePrototype } from '@/components/testing/PrototypeToolbar';

const h = React.createElement;

export default function SupportPartyPage() {
  const { state } = usePrototype();

  return h(
    PageShell,
    {
      title: 'Đội Ngũ Hỗ Trợ',
      breadcrumbs: [
        { label: 'Trang chủ', href: '/overview' },
        { label: 'Đội ngũ hỗ trợ', href: '/support' },
      ],
      showScopeSelector: true,
      maxWidth: 'standard',
    },
    h(FeaturePreview, null, h(SupportPartyScreen, {
      initialState: state,
    }))
  );
}
