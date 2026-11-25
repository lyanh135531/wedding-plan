'use client';

import React, { useState, useEffect } from 'react';
import { api, jsonBody } from '@/lib/api/request';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { usePagination } from '@/components/common/usePagination';
import { useLoadState } from '@/components/common/useLoadState';

export function NotificationsWorkspace() {
  const [items, setItems] = useState<{ key: string; title: string; date: string; read: boolean; href: string }[]>([]);
  const { loading, refreshing, beginLoad, markLoaded, finishLoad } = useLoadState();
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const pagination = usePagination(items, { defaultPageSize: 20 });

  useEffect(() => {
    const c = new AbortController();
    beginLoad('notifications');
    api<{ data: typeof items }>('/api/v1/notifications', { signal: c.signal })
      .then((r) => {
        if (!c.signal.aborted) {
          setItems(r.data);
          markLoaded('notifications');
        }
      })
      .catch((f) => {
        if (!c.signal.aborted) {
          setError(f.message);
          finishLoad();
        }
      });
    return () => c.abort();
  }, [revision, beginLoad, markLoaded, finishLoad]);

  const update = async (key: string, snooze = false) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await api('/api/v1/notifications', { method: 'POST', body: jsonBody({ key, read: true, snooze }) });
      setRevision((v) => v + 1);
    } catch (f) {
      setError((f as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4" aria-busy={busy || refreshing}>
      <h1 className="font-serif text-2xl">Thông báo &amp; Nhắc việc</h1>
      <p>Các việc chưa hoàn tất và lịch sắp tới trong 7 ngày, bao gồm các hạn đã qua.</p>
      {error && <p role="alert">{error}</p>}
      {loading ? (
        <p role="status">Đang tải…</p>
      ) : items.length ? (
        <>
          {pagination.pagedItems.map((i) => (
            <article key={i.key} className="surface-card p-5 space-y-3">
              <a href={i.href} className="font-semibold underline">
                {i.title}
              </a>
              <p>
                {i.date} • {i.read ? 'Đã đọc' : 'Chưa đọc'}
              </p>
              <div className="flex gap-2">
                {!i.read && (
                  <Button variant="secondary" disabled={busy} onClick={() => void update(i.key)}>
                    Đánh dấu đã đọc
                  </Button>
                )}
                <Button variant="secondary" disabled={busy} onClick={() => void update(i.key, true)}>
                  Nhắc lại sau 1 ngày
                </Button>
              </div>
            </article>
          ))}
          <Pagination
            currentPage={pagination.currentPage}
            pageSize={pagination.pageSize}
            totalItems={pagination.totalItems}
            onPageChange={pagination.setCurrentPage}
            onPageSizeChange={pagination.setPageSize}
            pageSizeOptions={[10, 20, 50]}
            unitLabel="thông báo"
          />
        </>
      ) : (
        <p>Không có nhắc việc cần xử lý.</p>
      )}
    </section>
  );
}
