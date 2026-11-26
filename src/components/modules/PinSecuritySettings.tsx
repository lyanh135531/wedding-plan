'use client';

import React, { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { api, jsonBody } from '@/lib/api/request';

export function PinSecuritySettings() {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');

  const sanitizeDigits = (value: string) => value.replace(/\D/g, '').slice(0, 6);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setError('');
    setSavedMessage('');

    if (!/^\d{6}$/.test(currentPin) || !/^\d{6}$/.test(newPin) || !/^\d{6}$/.test(confirmPin)) {
      setError('Cả 3 ô mã PIN đều phải gồm đúng 6 chữ số.');
      return;
    }
    if (newPin !== confirmPin) {
      setError('Mã PIN mới và xác nhận chưa khớp.');
      return;
    }

    setSaving(true);
    try {
      await api('/api/v1/settings/pin', {
        method: 'PATCH',
        body: jsonBody({ currentPin, newPin, confirmPin }),
      });
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      setSavedMessage('Đã cập nhật mã PIN 6 số mới thành công.');
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full min-h-11 px-3 py-2 rounded-control border border-border-subtle bg-surface text-text-main tracking-[0.25em] font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary';

  return (
    <section className="surface-card p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
          <KeyRound className="w-4 h-4" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-xl font-serif text-text-main">Bảo mật mã PIN 6 số</h2>
          <p className="text-xs text-text-muted mt-1 leading-relaxed">
            Thay đổi mã PIN dùng chung để mở sổ cưới trên trình duyệt của cô dâu và chú rể.
          </p>
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      {savedMessage && <Alert variant="success">{savedMessage}</Alert>}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium text-text-main">Mã PIN hiện tại</span>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            autoComplete="current-password"
            placeholder="••••••"
            disabled={saving}
            value={currentPin}
            onChange={(e) => {
              setCurrentPin(sanitizeDigits(e.target.value));
              setError('');
              setSavedMessage('');
            }}
            className={inputClass}
          />
        </label>

        <label className="block space-y-1.5 text-sm">
          <span className="font-medium text-text-main">Mã PIN mới (6 số)</span>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            autoComplete="new-password"
            placeholder="••••••"
            disabled={saving}
            value={newPin}
            onChange={(e) => {
              setNewPin(sanitizeDigits(e.target.value));
              setError('');
              setSavedMessage('');
            }}
            className={inputClass}
          />
        </label>

        <label className="block space-y-1.5 text-sm">
          <span className="font-medium text-text-main">Nhập lại PIN mới</span>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            autoComplete="new-password"
            placeholder="••••••"
            disabled={saving}
            value={confirmPin}
            onChange={(e) => {
              setConfirmPin(sanitizeDigits(e.target.value));
              setError('');
              setSavedMessage('');
            }}
            className={inputClass}
          />
        </label>

        <div className="sm:col-span-3 flex justify-end pt-1">
          <Button type="submit" variant="primary" loading={saving}>
            Cập nhật mã PIN
          </Button>
        </div>
      </form>
    </section>
  );
}
