'use client';

import * as React from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { useRole } from '@/context/RoleContext';
import { api } from '@/lib/api/request';

const h = React.createElement;
interface Entry { id: string; action: string; entityType: string; entityId: string; userId: string; createdAt: string }
export default function HistoryPage() {
  const { isOwner } = useRole();
  const [entries, setEntries] = React.useState<Entry[]>([]);
  const [offset, setOffset] = React.useState(0);
  const [hasMore, setHasMore] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [revision, setRevision] = React.useState(0);
  React.useEffect(() => {
    if (!isOwner) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    api<{ data: Entry[]; hasMore: boolean }>(`/api/v1/history?offset=${offset}`, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) { setEntries(result.data); setHasMore(result.hasMore); } })
      .catch((failure) => { if (!controller.signal.aborted) setError((failure as Error).message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [offset, revision, isOwner]);
  return h(PageShell, { title: 'Nhật ký hoạt động', showScopeSelector: false },
    h('div', { className: 'space-y-4' },
      error && h(Alert, { variant: 'danger', action: { label: 'Thử lại', onClick: () => setRevision((value) => value + 1) } }, error),
      loading ? h('p', { role: 'status' }, 'Đang tải nhật ký...') :
        entries.length ? h('ul', { className: 'space-y-2' }, entries.map((entry) => h('li', { key: entry.id, className: 'bg-surface rounded-card border p-4 break-words space-y-1' },
          h('p', { className: 'font-medium' }, `${entry.action} • ${entry.entityType}`),
          h('p', { className: 'text-sm text-text-muted' }, new Date(entry.createdAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })),
          h('p', { className: 'text-xs text-text-muted' }, `Người thực hiện: ${entry.userId}`),
        ))) : h('p', null, 'Chưa có hoạt động được ghi nhận.'),
      h('div', { className: 'flex gap-3' },
        offset > 0 && h(Button, { variant: 'secondary', disabled: loading, onClick: () => setOffset((value) => Math.max(0, value - 100)) }, 'Trang trước'),
        hasMore && h(Button, { variant: 'secondary', disabled: loading, onClick: () => setOffset((value) => value + 100) }, 'Trang tiếp'),
      ),
    ));
}
