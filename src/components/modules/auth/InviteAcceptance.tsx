'use client';
import React, { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { api, jsonBody } from '@/lib/api/request';
import { Button } from '@/components/ui/button';
export function InviteAcceptance({ token, email }: { token: string; email: string | null }) {
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  return <section className="surface-card p-8 max-w-lg space-y-5"><h1 className="font-serif text-2xl">Lời mời xem kế hoạch đám cưới</h1><p>{email ? `Bạn đang đăng nhập: ${email}` : 'Đăng nhập bằng đúng email Google được chủ sở hữu mời để tiếp tục.'}</p>{error && <p role="alert" className="text-danger">{error}</p>}<Button disabled={busy || !/^[a-f0-9]{64}$/.test(token)} onClick={async () => {
    if (busy) return; setBusy(true); setError('');
    try { if (!email) { const r = await authClient.signIn.social({ provider: 'google', callbackURL: `/invite?token=${encodeURIComponent(token)}`, errorCallbackURL: '/login' }); if (r.error) throw new Error(r.error.message); } else { await api('/api/v1/sharing/redeem', { method: 'POST', body: jsonBody({ token }) }); window.location.assign('/overview'); } }
    catch (f) { setError((f as Error).message); } finally { setBusy(false); }
  }}>{email ? 'Chấp nhận lời mời' : 'Đăng nhập Google'}</Button>{email && <Button variant="secondary" onClick={async () => { await authClient.signOut(); window.location.reload(); }}>Đổi tài khoản</Button>}</section>;
}
