import * as React from 'react';

import '@/styles/globals.css';
import { RoleProvider } from '@/context/RoleContext';
import { EventScopeProvider } from '@/context/EventScopeContext';
import { PrototypeProvider } from '@/components/testing/PrototypeToolbar';

const h = React.createElement;

export const metadata = {
  title: 'Sổ Quản Lý Đám Cưới',
  description: 'Hệ thống quản lý đám cưới nội bộ dành riêng cho gia đình',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return h(
    'html',
    { lang: 'vi' },
    h(
      'body',
      { className: 'min-h-screen bg-bg-page text-text-main font-sans antialiased' },
      h(
        RoleProvider,
        null,
        h(
          EventScopeProvider,
          null,
          h(
            PrototypeProvider,
            null,
            children
          )
        )
      )
    )
  );
}
