import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges Tailwind classes cleanly with clsx and tailwind-merge
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Strict BigInt VND currency formatting.
 * Never performs floating point math.
 *
 * @param amount - native bigint amount in VND, or null/undefined
 * @param fallback - string to return when amount is null/undefined (default: 'Chưa nhập')
 * @returns formatted string (e.g. "15.000.000 ₫", "0 ₫", or fallback)
 */
export function formatVND(
  amount: bigint | null | undefined,
  fallback: string = 'Chưa nhập'
): string {
  if (amount === null || amount === undefined) {
    return fallback;
  }
  const isNegative = amount < 0n;
  const absVal = isNegative ? -amount : amount;
  const s = absVal.toString();

  // Format with dot separator
  const formatted = s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${isNegative ? '-' : ''}${formatted} ₫`;
}

/**
 * Strict BigInt VND parser from raw user input.
 * Strips non-digits (preserving leading negative if present), returns native bigint or null if empty.
 * Never converts to JavaScript Number or float.
 *
 * @param input - raw user input string (e.g. "15.000.000", "500000 ₫", "-20.000")
 * @returns native bigint or null
 */
export function parseVND(input: string | null | undefined): bigint | null {
  if (!input) return null;
  const trimmed = input.trim();
  const isNegative = trimmed.startsWith('-');
  const digitsOnly = trimmed.replace(/[^\d]/g, '');
  if (!digitsOnly) return null;
  try {
    const val = BigInt(digitsOnly);
    return isNegative && val !== 0n ? -val : val;
  } catch {
    return null;
  }
}

/**
 * Normalizes Vietnamese diacritics for search and filtering.
 * Example: "Nguyễn Văn Hoàng" -> "nguyen van hoang"
 */
export function removeVietnameseDiacritics(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}
