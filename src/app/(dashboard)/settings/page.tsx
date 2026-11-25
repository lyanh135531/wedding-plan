'use client';

import * as React from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { useRole } from '@/context/RoleContext';
import { TextInput } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { api, jsonBody } from '@/lib/api/request';
import Link from 'next/link';
import { SettingsAdvancedWorkspace } from '@/components/modules/SettingsAdvancedWorkspace';
import { useLoadState } from '@/components/common/useLoadState';

const h = React.createElement;

export default function SettingsPage() {
  const { isOwner } = useRole();
  const [weddingName, setWeddingName] = React.useState('');
  const [version, setVersion] = React.useState<number | null>(null);
  const { loading, beginLoad, markLoaded, finishLoad } = useLoadState();
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const load = React.useCallback(async () => {
    beginLoad('settings');
    setError(null);
    try {
      const { data } = await api<{ data: { shortTitle: string | null; groomName: string; brideName: string; version: number } | null }>('/api/v1/settings');
      setWeddingName(data ? data.shortTitle || `${data.groomName} & ${data.brideName}` : '');
      setVersion(data?.version ?? null);
      markLoaded('settings');
    } catch (failure) {
      setError((failure as Error).message);
      finishLoad();
    }
  }, [beginLoad, markLoaded, finishLoad]);
  React.useEffect(() => { void load(); }, [load]);
  const save = async () => {
    if (saving || version === null) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const { data } = await api<{ data: { version: number } }>('/api/v1/settings', {
        method: 'PATCH', body: jsonBody({ shortTitle: weddingName, version }),
      });
      setVersion(data.version);
      setSaved(true);
    } catch (failure) { setError((failure as Error).message); }
    finally { setSaving(false); }
  };

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
    h(SettingsAdvancedWorkspace),
    h(
      'div',
      { className: 'space-y-6 max-w-xl mx-auto bg-surface p-6 rounded-card border border-border-subtle shadow-sm' },
      h('h2', { className: 'text-lg font-bold text-text-main' }, 'Thông tin cơ bản đám cưới'),
      error && h(Alert, { variant: 'danger', action: { label: 'Tải lại cài đặt', onClick: load } }, error),
      saved && h(Alert, { variant: 'success' }, 'Đã lưu cài đặt.'),
      !loading && version === null && !error && isOwner && h(Link, { href: '/setup' }, 'Thiết lập thông tin đám cưới'),
      h(TextInput, {
        label: 'Tên hiển thị đám cưới',
        value: weddingName,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => { setWeddingName(e.target.value); setSaved(false); },
        disabled: !isOwner || loading || saving || version === null,
      }),
      isOwner &&
        h(
          Button,
          {
            variant: 'primary',
            onClick: save,
            disabled: loading || version === null || !weddingName.trim(),
            loading: saving,
          },
          'Lưu thay đổi'
        )
    )
  );
}
