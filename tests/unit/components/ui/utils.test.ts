import { describe, it, expect } from 'vitest';
import { formatVND, parseVND, removeVietnameseDiacritics, cn } from '@/lib/utils';

describe('Design Tokens & Core Utilities (src/lib/utils.ts)', () => {
  describe('formatVND - Strict BigInt Currency Formatting', () => {
    it('formats standard positive bigint amounts with Vietnamese dot separators and ₫ suffix', () => {
      expect(formatVND(15000000n)).toBe('15.000.000 ₫');
      expect(formatVND(500000n)).toBe('500.000 ₫');
      expect(formatVND(1000n)).toBe('1.000 ₫');
      expect(formatVND(999n)).toBe('999 ₫');
    });

    it('formats confirmed zero (0n) as "0 ₫" and never as "Chưa nhập"', () => {
      expect(formatVND(0n)).toBe('0 ₫');
    });

    it('returns default fallback "Chưa nhập" when amount is null or undefined', () => {
      expect(formatVND(null)).toBe('Chưa nhập');
      expect(formatVND(undefined)).toBe('Chưa nhập');
    });

    it('supports custom fallback string when amount is unset', () => {
      expect(formatVND(null, 'Thiếu giá')).toBe('Thiếu giá');
      expect(formatVND(undefined, '—')).toBe('—');
    });

    it('formats negative bigint amounts with leading minus sign and dot separators', () => {
      expect(formatVND(-5000000n)).toBe('-5.000.000 ₫');
      expect(formatVND(-100n)).toBe('-100 ₫');
    });

    it('handles extremely large wedding budget figures without float precision loss', () => {
      const hugeAmount = 100_000_000_000n; // 100 Billion VND
      expect(formatVND(hugeAmount)).toBe('100.000.000.000 ₫');
      const trillonAmount = 1_000_000_000_000_000n;
      expect(formatVND(trillonAmount)).toBe('1.000.000.000.000.000 ₫');
    });
  });

  describe('parseVND - Strict BigInt Currency Parsing', () => {
    it('parses unformatted numeric strings into native bigint', () => {
      expect(parseVND('15000000')).toBe(15000000n);
      expect(parseVND('0')).toBe(0n);
    });

    it('parses formatted Vietnamese currency strings containing dots and currency symbols', () => {
      expect(parseVND('15.000.000 ₫')).toBe(15000000n);
      expect(parseVND(' 250.000.000 VND ')).toBe(250000000n);
      expect(parseVND('1.000.000')).toBe(1000000n);
    });

    it('correctly handles negative values when prefixed with a minus sign', () => {
      expect(parseVND('-500.000 ₫')).toBe(-500000n);
      expect(parseVND('-1000')).toBe(-1000n);
    });

    it('returns null for empty strings, whitespace, or invalid inputs', () => {
      expect(parseVND('')).toBeNull();
      expect(parseVND('   ')).toBeNull();
      expect(parseVND(null)).toBeNull();
      expect(parseVND(undefined)).toBeNull();
      expect(parseVND('abcdef')).toBeNull();
    });
  });

  describe('removeVietnameseDiacritics - Accent-Insensitive Search Utility', () => {
    it('removes Vietnamese tonal marks and transforms Đ / đ to d', () => {
      expect(removeVietnameseDiacritics('Nguyễn Văn Hoàng')).toBe('nguyen van hoang');
      expect(removeVietnameseDiacritics('Đám cưới truyền thống')).toBe('dam cuoi truyen thong');
      expect(removeVietnameseDiacritics('Chi phí đặt cọc')).toBe('chi phi dat coc');
      expect(removeVietnameseDiacritics('HỘI NGHỊ TIỆC CƯỚI')).toBe('hoi nghi tiec cuoi');
    });
  });

  describe('cn - Tailwind Merge Utility', () => {
    it('merges class names and resolves conflicting Tailwind styles', () => {
      expect(cn('p-2', 'p-4')).toBe('p-4');
      expect(cn('text-sm font-medium', false && 'text-lg', 'text-text-main')).toBe(
        'text-sm font-medium text-text-main'
      );
    });
  });
});
