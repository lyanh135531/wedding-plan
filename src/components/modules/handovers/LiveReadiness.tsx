'use client';
import React, { useEffect, useState } from 'react';
import { api, jsonBody } from '@/lib/api/request';
import { Button } from '@/components/ui/button';
import { RecordEditor } from '@/components/common/ResourceWorkspace';
import type { R2SignoffReport } from '@/lib/r2-signoff/types';
export function LiveReadiness({ eventId }: { eventId: string }) {
  const [data, setData] = useState<R2SignoffReport | null>(null); const [error, setError] = useState(''); const [open, setOpen] = useState(false); const [notice, setNotice] = useState(''); const [revision, setRevision] = useState(0);
  useEffect(() => { const c = new AbortController(); api<{ data: R2SignoffReport }>(`/api/v1/r2-signoff?eventId=${eventId}`, { signal: c.signal }).then(r => setData(r.data)).catch(f => { if (!c.signal.aborted) setError(f.message); }); return () => c.abort(); }, [eventId, revision]);
  return <section className="space-y-4"><h2 className="text-2xl font-serif">Kiểm tra sẵn sàng bàn giao</h2><p>Đánh giá từ dữ liệu hiện tại. Chỉ khi chọn lưu bản chốt, hệ thống mới tạo bản lưu cố định.</p>{error && <p role="alert" className="text-danger">{error}</p>}{notice && <p role="status">{notice}</p>}<div className="flex gap-3"><Button variant="secondary" onClick={() => setRevision(v => v + 1)}>Đánh giá lại</Button><Button disabled={!data} onClick={() => setOpen(true)}>Lưu bản chốt</Button></div>
    {data?.checks.filter(c => c.id !== 'gate-8-immutable-snapshot').map(c => <div key={c.id} className="surface-card p-4"><h3 className="font-semibold">{c.status === 'passed' ? '✓' : '○'} {c.name}</h3><p>{c.message}</p></div>)}
    {open && <RecordEditor title="Lưu bản chốt nghiệm thu" fields={[{ key: 'title', label: 'Tên bản chốt', required: true }]} close={() => setOpen(false)} save={async body => { const r = await api<{ data: { snapshot: { id: string; version: number } } }>('/api/v1/r2-signoff', { method: 'POST', body: jsonBody({ ...body, eventId }) }); setNotice(`Đã lưu bản chốt số ${r.data.snapshot.version}. Mở tab Bộ bàn giao để xem, in và ghi nhận người nhận.`); }} />}
  </section>;
}
