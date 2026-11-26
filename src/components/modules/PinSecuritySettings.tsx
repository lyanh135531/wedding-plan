'use client';

import React, { useState } from 'react';
import { Check, Eye, EyeOff, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { api, jsonBody } from '@/lib/api/request';

export function PinSecuritySettings() {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showDigits, setShowDigits] = useState(false);
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

  const inputType = showDigits ? 'text' : 'password';
  const inputClass =
    'w-full min-h-11 px-3.5 py-2 rounded-control border border-border-control bg-surface text-text-main text-sm tracking-[0.28em] font-mono font-semibold placeholder:tracking-[0.2em] placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50';

  const renderProgressPill = (value: string, matches?: boolean) => {
    const ready = value.length === 6;
    return (
      <span
        className={`inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums ${
          matches === false
            ? 'text-danger'
            : ready
            ? 'text-success'
            : 'text-text-muted'
        }`}
      >
        {ready && matches !== false && <Check className="w-3 h-3" aria-hidden="true" />}
        {value.length}/6
      </span>
    );
  };

  return (
    <section className="surface-card overflow-hidden">
      <div className="px-5 py-4 bg-[#FAF8F4] border-b border-border-subtle flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-[#173C33] text-[#D4BF8F] flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
            <KeyRound className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="font-serif text-lg font-medium text-primary-luxury leading-snug">
              Bảo mật mã PIN 6 số
            </h2>
            <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
              Mã khóa chung dùng để mở sổ cưới của cô dâu và chú rể.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowDigits((prev) => !prev)}
          className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-surface px-2.5 py-1 text-[11px] font-medium text-text-muted hover:text-text-main hover:border-border-control transition-colors shrink-0"
        >
          {showDigits ? (
            <>
              <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
              Ẩn số
            </>
          ) : (
            <>
              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              Hiện số
            </>
          )}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
        {error && <Alert variant="danger">{error}</Alert>}
        {savedMessage && <Alert variant="success">{savedMessage}</Alert>}

        <label className="block space-y-1.5 text-sm">
          <span className="flex items-center justify-between">
            <span className="font-medium text-text-main">Mã PIN hiện tại</span>
            {renderProgressPill(currentPin)}
          </span>
          <input
            type={inputType}
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block space-y-1.5 text-sm">
            <span className="flex items-center justify-between">
              <span className="font-medium text-text-main">Mã PIN mới (6 số)</span>
              {renderProgressPill(newPin)}
            </span>
            <input
              type={inputType}
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
            <span className="flex items-center justify-between">
              <span className="font-medium text-text-main">Nhập lại PIN mới</span>
              {renderProgressPill(
                confirmPin,
                confirmPin.length === 6 ? confirmPin === newPin : undefined
              )}
            </span>
            <input
              type={inputType}
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
        </div>

        <div className="pt-1 flex justify-end">
          <Button type="submit" variant="primary" size="sm" loading={saving}>
            Cập nhật mã PIN
          </Button>
        </div>
      </form>
    </section>
  );
}
