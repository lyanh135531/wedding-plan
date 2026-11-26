import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  PIN_MAX_IP_ATTEMPTS,
  PIN_RATE_LIMIT_WINDOW_MS,
  evaluateRateLimitWindow,
  hashPin,
  isValidPinFormat,
  verifyPinHash,
  verifyPlaintextPin,
} from '@/lib/auth/pin';
import { PinLoginCard } from '@/components/modules/auth/PinLoginCard';
import { PinSecuritySettings } from '@/components/modules/PinSecuritySettings';

const TEST_PIN = '482915';

describe('PIN Authentication Helpers', () => {
  it('validates strict 6-digit numeric PIN format', () => {
    expect(isValidPinFormat(TEST_PIN)).toBe(true);
    expect(isValidPinFormat('000000')).toBe(true);
    expect(isValidPinFormat('48291')).toBe(false);
    expect(isValidPinFormat('4829150')).toBe(false);
    expect(isValidPinFormat('48291a')).toBe(false);
    expect(isValidPinFormat(' 482915')).toBe(false);
    expect(isValidPinFormat(null)).toBe(false);
  });

  it('hashes and verifies 6-digit PINs with unique per-hash salts', () => {
    const hashA = hashPin(TEST_PIN);
    const hashB = hashPin(TEST_PIN);

    expect(hashA).toMatch(/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
    expect(hashA).not.toBe(hashB);
    expect(verifyPinHash(TEST_PIN, hashA)).toBe(true);
    expect(verifyPinHash(TEST_PIN, hashB)).toBe(true);
    expect(verifyPinHash('999999', hashA)).toBe(false);
    expect(verifyPinHash(TEST_PIN, 'invalid-format')).toBe(false);
  });

  it('verifies plaintext env PIN safely', () => {
    expect(verifyPlaintextPin(TEST_PIN, TEST_PIN)).toBe(true);
    expect(verifyPlaintextPin('111222', TEST_PIN)).toBe(false);
    expect(verifyPlaintextPin('11122', TEST_PIN)).toBe(false);
  });

  it('enforces 5-attempt lockout window and resets after expiry', () => {
    const now = 1_700_000_000_000;

    const fresh = evaluateRateLimitWindow(null, PIN_MAX_IP_ATTEMPTS, now);
    expect(fresh.blocked).toBe(false);
    expect(fresh.remainingAttempts).toBe(5);

    const fourthFail = evaluateRateLimitWindow(
      JSON.stringify({ count: 4, windowEndsAtMs: now + 60_000 }),
      PIN_MAX_IP_ATTEMPTS,
      now
    );
    expect(fourthFail.blocked).toBe(false);
    expect(fourthFail.remainingAttempts).toBe(1);

    const fifthFail = evaluateRateLimitWindow(
      JSON.stringify({ count: 5, windowEndsAtMs: now + 120_000 }),
      PIN_MAX_IP_ATTEMPTS,
      now
    );
    expect(fifthFail.blocked).toBe(true);
    expect(fifthFail.remainingAttempts).toBe(0);
    expect(fifthFail.retryAfterSeconds).toBe(120);

    const expired = evaluateRateLimitWindow(
      JSON.stringify({ count: 5, windowEndsAtMs: now - 1 }),
      PIN_MAX_IP_ATTEMPTS,
      now,
      PIN_RATE_LIMIT_WINDOW_MS
    );
    expect(expired.blocked).toBe(false);
    expect(expired.count).toBe(0);
    expect(expired.remainingAttempts).toBe(5);

    const corrupted = evaluateRateLimitWindow('{bad json', PIN_MAX_IP_ATTEMPTS, now);
    expect(corrupted.blocked).toBe(false);
    expect(corrupted.remainingAttempts).toBe(5);
  });
});

describe('PIN Authentication UI Components', () => {
  it('renders PinLoginCard with 6 numeric PIN digit inputs and no Google sign-in button', () => {
    const html = renderToStaticMarkup(React.createElement(PinLoginCard));

    for (let i = 0; i < 6; i++) {
      expect(html).toContain(`id="pin-digit-${i}"`);
    }
    expect(html).toContain('inputMode="numeric"');
    expect(html).toContain('Mở sổ cưới');
    expect(html).not.toContain('Đăng nhập bằng Google');
  });

  it('renders PinSecuritySettings form for changing 6-digit PIN in Settings', () => {
    const html = renderToStaticMarkup(React.createElement(PinSecuritySettings));

    expect(html).toContain('Bảo mật mã PIN 6 số');
    expect(html).toContain('Mã PIN hiện tại');
    expect(html).toContain('Mã PIN mới (6 số)');
    expect(html).toContain('Nhập lại PIN mới');
    expect(html).toContain('Cập nhật mã PIN');
  });
});
