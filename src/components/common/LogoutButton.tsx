'use client';

import React, { useState } from 'react';
import { LogOut, Loader2 } from 'lucide-react';

export function LogoutButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSignOut = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/v1/auth/pin', {
        method: 'DELETE',
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error('SIGN_OUT_FAILED');
      }
      try {
        for (const key of Object.keys(sessionStorage)) {
          if (key.startsWith('wedding-')) sessionStorage.removeItem(key);
        }
      } catch {}
      window.location.assign('/login');
    } catch {
      setError('Không thể khóa sổ. Vui lòng thử lại.');
      setBusy(false);
    }
  };

  return (
    <div className="w-full">
      <button
        type="button"
        disabled={busy}
        onClick={handleSignOut}
        className="group flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#C8D5CB] hover:text-white rounded-lg hover:bg-white/10 active:bg-white/5 transition-all min-h-11 disabled:opacity-50 select-none"
      >
        {busy ? (
          <Loader2 className="w-4 h-4 animate-spin text-[#BFA16E] shrink-0" aria-hidden="true" />
        ) : (
          <LogOut className="w-4 h-4 text-[#8DA397] group-hover:text-[#BFA16E] transition-colors shrink-0" aria-hidden="true" />
        )}
        <span>{busy ? 'Đang khóa sổ…' : 'Khóa sổ / Đăng xuất'}</span>
      </button>
      {error && <p role="alert" className="text-[11px] text-[#FEF3F2] mt-1 px-3">{error}</p>}
    </div>
  );
}
