'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { VendorCompareScreen } from '@/components/modules/vendors/VendorCompareScreen';
import { PageShell } from '@/components/layout/PageShell';
import { Loader2 } from 'lucide-react';

function ComparePageContent() {
  return React.createElement(VendorCompareScreen, null);
}

export default function ComparePage() {
  return React.createElement(
    Suspense,
    {
      fallback: React.createElement(
        PageShell,
        {
          title: 'So Sánh Báo Giá',
          breadcrumbs: [
            { label: 'Trang chủ', href: '/overview' },
            { label: 'Nhà cung cấp', href: '/vendors' },
            { label: 'So sánh' },
          ],
        },
        React.createElement(
          'div',
          { className: 'py-20 flex flex-col items-center justify-center space-y-2' },
          React.createElement(Loader2, { className: 'w-8 h-8 animate-spin text-primary', 'aria-hidden': 'true' }),
          React.createElement('p', { className: 'text-sm text-text-muted' }, 'Đang tải trang so sánh...')
        )
      ),
    },
    React.createElement(ComparePageContent, null)
  );
}
