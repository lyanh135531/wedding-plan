'use client';
import React, { useEffect, useState } from 'react';
import { api, jsonBody } from '@/lib/api/request';
import { RecordEditor } from '@/components/common/ResourceWorkspace';
import { useEventScope } from '@/context/EventScopeContext';
import { Button } from '@/components/ui/button';
interface Sharing { invites: { id: string; email: string; status: string; expiresAt: string }[]; members: { id: string; name: string; email: string }[]; access: { userId: string; eventId: string }[] }
export function SharingWorkspace() {
  const { availableEvents } = useEventScope(); const [data, setData] = useState<Sharing | null>(null); const [open, setOpen] = useState(false); const [url, setUrl] = useState(''); const [error, setError] = useState(''); const [revision, setRevision] = useState(0); const [busy, setBusy] = useState(false);
  useEffect(() => { const c = new AbortController(); api<{ data: Sharing }>('/api/v1/sharing', { signal: c.signal }).then(r => setData(r.data)).catch(f => { if (!c.signal.aborted) setError(f.message); }); return () => c.abort(); }, [revision]);
  const revoke = async (body: unknown) => { if (busy || !window.confirm('Thu hồi quyền / lời mời này? Phiên đang mở sẽ mất quyền ngay.')) return; setBusy(true); setError(''); try { await api('/api/v1/sharing', { method: 'PATCH', body: jsonBody(body) }); setRevision(v => v + 1); } catch (f) { setError((f as Error).message); } finally { setBusy(false); } };
  return <section className="surface-card p-5 space-y-4"><h2 className="text-xl font-serif">Chia sẻ với người nhà</h2><p className="text-sm">Chỉ xem thông tin vận hành của các buổi được cấp quyền. Gán người hỗ trợ không tự cấp tài khoản.</p>{error && <p role="alert" className="text-danger">{error}</p>}<Button onClick={() => setOpen(true)}>Mời người nhà</Button>
    {url && <div role="status" className="space-y-2"><label className="block">Sao chép liên kết và tự gửi cho người nhận<input readOnly className="w-full border rounded p-3" value={url} onFocus={e => e.target.select()} /></label><p className="text-xs">Liên kết chỉ hiển thị trong lần tạo này và hết hạn sau 7 ngày.</p></div>}
    {data?.members.map(m => <div key={m.id} className="border-t pt-3 flex flex-wrap gap-3 justify-between"><div><p>{m.name} — {m.email}</p><p className="text-sm text-text-muted">{data.access.filter(a => a.userId === m.id).map(a => availableEvents.find(e => e.id === a.eventId)?.name || 'Buổi lễ').join(', ') || 'Chưa có buổi được cấp quyền'}</p></div><Button variant="secondary" disabled={busy} onClick={() => void revoke({ memberId: m.id })}>Thu hồi quyền</Button></div>)}
    {data?.invites.map(i => <div key={i.id} className="border-t pt-3 flex flex-wrap gap-3 justify-between"><p>{i.email} • {i.status === 'pending' ? 'Đang chờ' : i.status === 'accepted' ? 'Đã nhận' : 'Đã thu hồi'} • Hạn {new Date(i.expiresAt).toLocaleDateString('vi-VN')}</p>{i.status === 'pending' && <Button variant="secondary" disabled={busy} onClick={() => void revoke({ inviteId: i.id })}>Hủy lời mời</Button>}</div>)}
    {open && <RecordEditor title="Mời người nhà" fields={[{ key: 'email', label: 'Email Google được mời', required: true }, { key: 'allowedEventIds', label: 'Buổi lễ được xem', type: 'multi', required: true, options: availableEvents.filter(e => !e.isCancelled).map(e => ({ value: e.id, label: e.name })) }]} close={() => setOpen(false)} save={async body => { const r = await api<{ data: { inviteUrl: string } }>('/api/v1/sharing', { method: 'POST', body: jsonBody(body) }); setUrl(r.data.inviteUrl); setRevision(v => v + 1); }} />}
  </section>;
}
