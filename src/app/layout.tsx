import * as React from 'react';

import '@/styles/globals.css';
import { RoleProvider } from '@/context/RoleContext';
import { EventScopeProvider } from '@/context/EventScopeContext';
import { NetworkWriteGuard } from '@/components/common/NetworkWriteGuard';

const h = React.createElement;

export const metadata = {
  title: 'Sổ Quản Lý Đám Cưới',
  description: 'Không gian quản lý đám cưới riêng tư của cô dâu và chú rể',
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return h(
    'html',
    { lang: 'vi' },
    h('head', null,
      h('link', { rel: 'preload', href: '/fonts/be-vietnam-pro/BeVietnamPro-Regular.woff2', as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' }),
      h('link', { rel: 'preload', href: '/fonts/playfair-display/PlayfairDisplay-Variable.woff2', as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' }),
    ),
    h(
      'body',
      { className: 'min-h-screen bg-bg-page text-text-main font-sans antialiased' },
      h(NetworkWriteGuard),
      h(
        RoleProvider,
        null,
        h(
          EventScopeProvider,
          null,
          children
        )
      )
    )
  );
}
