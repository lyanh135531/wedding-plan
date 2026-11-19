'use client';

import React from 'react';
import Link from 'next/link.js';
import { ShieldAlert } from 'lucide-react';

export interface PermissionDeniedViewProps {
  title?: string;
  message?: string;
  returnUrl?: string;
  returnLabel?: string;
}

export const PermissionDeniedView: React.FC<PermissionDeniedViewProps> = ({
  title = 'Bạn không có quyền truy cập',
  message = 'Phân hệ này dành riêng cho hai chủ sở hữu. Vui lòng quay về trang Tổng quan hoặc các mục được chia sẻ.',
  returnUrl = '/overview',
  returnLabel = 'Quay về Tổng quan',
}) => {
  const h = React.createElement;

  return h(
    'div',
    {
      className:
        'min-h-screen bg-page flex flex-col items-center justify-center p-6 text-center',
      role: 'alert',
      'aria-live': 'polite',
    },
    h(
      'div',
      {
        className:
          'max-w-md w-full bg-surface p-8 rounded-xl border border-border-subtle shadow-sm',
      },
      h(
        'div',
        {
          className:
            'w-12 h-12 rounded-full bg-[#FEF3F2] text-[#B42318] flex items-center justify-center mx-auto mb-4',
        },
        h(ShieldAlert, { className: 'w-6 h-6 text-[#B42318]', 'aria-hidden': 'true' })
      ),
      h(
        'h2',
        { className: 'text-xl font-semibold text-text-main mb-2 tracking-tight' },
        title
      ),
      h(
        'p',
        { className: 'text-sm text-text-muted mb-6 leading-relaxed' },
        message
      ),
      h(
        Link,
        {
          href: returnUrl,
          className:
            'inline-flex items-center justify-center px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-[#1D4ED8] focus:ring-offset-2',
        },
        returnLabel
      )
    )
  );
};
