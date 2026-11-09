'use client';

import * as React from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { useRole } from '@/context/RoleContext';
import { TextInput } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const h = React.createElement;

export default function SettingsPage() {
  const { isOwner } = useRole();
  const [weddingName, setWeddingName] = React.useState('Đám cưới Minh & Linh');

  return h(
    PageShell,
    {
      title: 'Cài Đặt Chung',
      breadcrumbs: [
        { label: 'Trang chủ', href: '/overview' },
        { label: 'Cài đặt', href: '/settings' },
      ],
      showScopeSelector: false,
      maxWidth: 'standard',
    },
    h(
      'div',
      { className: 'space-y-6 max-w-xl mx-auto bg-surface p-6 rounded-card border border-border-subtle shadow-sm' },
      h('h2', { className: 'text-lg font-bold text-text-main' }, 'Thông tin cơ bản đám cưới'),
      h(TextInput, {
        label: 'Tên hiển thị đám cưới',
        value: weddingName,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setWeddingName(e.target.value),
        disabled: !isOwner,
      }),
      isOwner &&
        h(
          Button,
          {
            variant: 'primary',
            onClick: () => alert('Đã lưu cài đặt'),
          },
          'Lưu thay đổi'
        )
    )
  );
}
