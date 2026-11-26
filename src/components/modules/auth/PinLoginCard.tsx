'use client';

import * as React from 'react';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { BrandMark } from '@/components/common/BrandMark';

const h = React.createElement;
const PIN_LENGTH = 6;

export interface PinLoginCardProps {
  callbackURL?: string;
}

export const PinLoginCard: React.FC<PinLoginCardProps> = ({
  callbackURL = '/overview',
}) => {
  const [digits, setDigits] = React.useState<string[]>(() => Array(PIN_LENGTH).fill(''));
  const [showPin, setShowPin] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRefs = React.useRef<Array<HTMLInputElement | null>>([]);
  const submitLockRef = React.useRef(false);

  React.useEffect(() => {
    inputRefs.current[0]?.focus({ preventScroll: true });
  }, []);

  const pinValue = digits.join('');
  const isComplete = pinValue.length === PIN_LENGTH && /^\d{6}$/.test(pinValue);

  const submitPin = React.useCallback(
    async (pinToVerify: string) => {
      if (submitLockRef.current || !/^\d{6}$/.test(pinToVerify)) return;
      submitLockRef.current = true;
      setSubmitting(true);
      setError(null);

      try {
        const res = await fetch('/api/v1/auth/pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: pinToVerify }),
          cache: 'no-store',
        });
        const payload = await res.json().catch(() => ({}));

        if (!res.ok) {
          setError(payload?.message || 'Mã PIN chưa đúng. Vui lòng thử lại.');
          setDigits(Array(PIN_LENGTH).fill(''));
          setSubmitting(false);
          submitLockRef.current = false;
          requestAnimationFrame(() => inputRefs.current[0]?.focus({ preventScroll: true }));
          return;
        }

        window.location.assign(callbackURL || '/overview');
      } catch {
        setError('Không thể kết nối máy chủ. Vui lòng kiểm tra mạng và thử lại.');
        setSubmitting(false);
        submitLockRef.current = false;
      }
    },
    [callbackURL]
  );

  const handleDigitChange = (index: number, raw: string) => {
    if (submitting) return;
    const onlyDigits = raw.replace(/\D/g, '');
    setError(null);

    if (onlyDigits.length > 1) {
      const next = Array(PIN_LENGTH).fill('');
      onlyDigits
        .slice(0, PIN_LENGTH)
        .split('')
        .forEach((char, offset) => {
          next[offset] = char;
        });
      setDigits(next);
      const nextFocus = Math.min(PIN_LENGTH - 1, onlyDigits.length);
      inputRefs.current[nextFocus]?.focus({ preventScroll: true });
      if (onlyDigits.length >= PIN_LENGTH) {
        void submitPin(onlyDigits.slice(0, PIN_LENGTH));
      }
      return;
    }

    const next = [...digits];
    next[index] = onlyDigits;
    setDigits(next);

    if (onlyDigits && index < PIN_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus({ preventScroll: true });
    }

    const candidate = next.join('');
    if (candidate.length === PIN_LENGTH && /^\d{6}$/.test(candidate)) {
      void submitPin(candidate);
    }
  };

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (submitting) return;
    if (event.key === 'Backspace') {
      if (digits[index]) {
        const next = [...digits];
        next[index] = '';
        setDigits(next);
      } else if (index > 0) {
        const next = [...digits];
        next[index - 1] = '';
        setDigits(next);
        inputRefs.current[index - 1]?.focus({ preventScroll: true });
      }
    } else if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      inputRefs.current[index - 1]?.focus({ preventScroll: true });
    } else if (event.key === 'ArrowRight' && index < PIN_LENGTH - 1) {
      event.preventDefault();
      inputRefs.current[index + 1]?.focus({ preventScroll: true });
    }
  };

  const handlePaste = (index: number, event: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '');
    if (!pasted) return;
    event.preventDefault();
    const next = [...digits];
    const chars = pasted.slice(0, PIN_LENGTH).split('');
    if (pasted.length >= PIN_LENGTH) {
      for (let i = 0; i < PIN_LENGTH; i++) {
        next[i] = chars[i] ?? '';
      }
    } else {
      chars.forEach((char, offset) => {
        if (index + offset < PIN_LENGTH) next[index + offset] = char;
      });
    }
    setDigits(next);
    setError(null);
    const joined = next.join('');
    if (/^\d{6}$/.test(joined)) {
      void submitPin(joined);
    } else {
      const targetIndex = Math.min(PIN_LENGTH - 1, index + chars.length);
      inputRefs.current[targetIndex]?.focus({ preventScroll: true });
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isComplete) {
      setError('Vui lòng nhập đủ 6 chữ số mã PIN.');
      const firstEmpty = digits.findIndex((d) => !d);
      inputRefs.current[firstEmpty >= 0 ? firstEmpty : 0]?.focus({ preventScroll: true });
      return;
    }
    void submitPin(pinValue);
  };

  return h(
    'div',
    { className: 'auth-login-card mx-auto' },
    h(
      'div',
      {
        className:
          'hidden md:flex w-14 h-14 rounded-full border border-accent/30 text-accent items-center justify-center mb-7',
      },
      h(BrandMark, { className: 'w-9 h-9' })
    ),
    h('p', { className: 'eyebrow mb-3' }, 'Chào mừng trở về'),
    h(
      'h1',
      { className: 'font-serif font-medium text-primary-luxury tracking-tight mb-4' },
      'Sổ Quản Lý Đám Cưới'
    ),
    h(
      'p',
      { className: 'text-[13px] text-text-muted mb-7 leading-7' },
      'Nhập mã PIN 6 số của hai bạn để mở và chỉnh sửa sổ cưới.'
    ),

    error && h(Alert, { variant: 'danger', className: 'mb-4' }, error),

    h(
      'form',
      { onSubmit: handleSubmit, className: 'space-y-6', noValidate: true },
      h(
        'div',
        { className: 'space-y-2.5' },
        h(
          'div',
          { className: 'flex items-center justify-between' },
          h(
            'label',
            { htmlFor: 'pin-digit-0', className: 'text-xs font-medium text-text-main' },
            'Mã PIN (6 chữ số)'
          ),
          h(
            'button',
            {
              type: 'button',
              onClick: () => setShowPin((v) => !v),
              className:
                'inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-main py-1 px-1.5 rounded transition-colors',
            },
            h(showPin ? EyeOff : Eye, { className: 'w-3.5 h-3.5', 'aria-hidden': 'true' }),
            showPin ? 'Ẩn số' : 'Hiện số'
          )
        ),
        h(
          'div',
          { className: 'grid grid-cols-6 gap-2 sm:gap-2.5' },
          digits.map((digit, index) =>
            h('input', {
              key: index,
              id: `pin-digit-${index}`,
              ref: (el: HTMLInputElement | null) => {
                inputRefs.current[index] = el;
              },
              type: showPin ? 'text' : 'password',
              inputMode: 'numeric',
              pattern: '[0-9]*',
              autoComplete: index === 0 ? 'one-time-code' : 'off',
              maxLength: 6,
              disabled: submitting,
              value: digit,
              'aria-label': `Chữ số thứ ${index + 1}`,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                handleDigitChange(index, e.target.value),
              onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => handleKeyDown(index, e),
              onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => handlePaste(index, e),
              onFocus: (e: React.FocusEvent<HTMLInputElement>) => e.target.select(),
              className:
                'h-12 sm:h-13 w-full text-center text-lg sm:text-xl font-semibold tracking-wider rounded-xl border border-border-subtle bg-surface text-text-main focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all disabled:opacity-50',
            })
          )
        )
      ),

      h(
        Button,
        {
          type: 'submit',
          variant: 'primary',
          size: 'lg',
          loading: submitting,
          loadingText: 'Đang kiểm tra mã PIN...',
          className: 'auth-signin w-full font-medium shadow-sm flex items-center justify-center gap-2.5',
        },
        h(KeyRound, { className: 'w-4 h-4 shrink-0', 'aria-hidden': 'true' }),
        'Mở sổ cưới'
      ),

      h(
        'div',
        { className: 'auth-footer pt-6 border-t border-border-subtle space-y-1' },
        h('p', { className: 'font-medium text-text-main' }, 'Không gian riêng của hai bạn.'),
        h(
          'p',
          null,
          'Bạn có thể đổi mã PIN bất kỳ lúc nào trong phần Cài đặt chung sau khi đăng nhập.'
        )
      )
    )
  );
};
