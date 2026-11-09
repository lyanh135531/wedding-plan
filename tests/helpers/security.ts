/**
 * Security Verification Helpers for Testing.
 * Covers Anti-Formula Injection (AT29), Path Traversal Defense (AT41), etc.
 */

export const FORMULA_DANGEROUS_PREFIXES = ['=', '+', '-', '@', '\t', '\r', '\n'] as const;

/**
 * Neutralize formula injection in CSV/XLSX text cells by prefixing an apostrophe (AT29).
 * Handles direct control prefixes (\t, \r) as well as leading whitespace bypasses (' =cmd').
 */
export function sanitizeCsvField(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.length === 0) return '';

  // 1. Direct prefix inspection: preserves original string formatting for control prefixes like \t, \r
  const firstChar = str[0];
  if (FORMULA_DANGEROUS_PREFIXES.includes(firstChar as (typeof FORMULA_DANGEROUS_PREFIXES)[number])) {
    return `'${str}`;
  }

  // 2. Whitespace-prefixed formula bypass inspection: trim leading whitespace and inspect
  const trimmedLeading = str.trimStart();
  if (trimmedLeading.length > 0) {
    const trimmedFirstChar = trimmedLeading[0];
    if (FORMULA_DANGEROUS_PREFIXES.includes(trimmedFirstChar as (typeof FORMULA_DANGEROUS_PREFIXES)[number])) {
      return `'${trimmedLeading}`;
    }
  }

  return str;
}

/**
 * Validate that a file storage key does not contain directory traversal attempts (AT41).
 * Allows relative safe keys and canonical storage keys under '/data/uploads/'.
 * Strictly blocks '..', null bytes '\0', Windows paths '\\', and unauthorized absolute paths.
 */
export function validateStorageKey(key: string): boolean {
  if (!key) return false;

  // 1. Disallow parent directory navigation, null bytes, backslashes, or URL-encoded traversals
  if (key.includes('..') || key.includes('\0') || key.includes('\\')) {
    return false;
  }
  if (/%2e|%2f|%5c/i.test(key)) {
    return false;
  }

  // 2. Absolute path policy: only canonical storage root '/data/uploads/' is permitted
  if (key.startsWith('/')) {
    if (!key.startsWith('/data/uploads/')) {
      return false;
    }
  }

  // 3. Enforce safe character set: alphanumeric, underscores, hyphens, dots, forward slashes
  if (!/^[a-zA-Z0-9_\-./]+$/.test(key)) {
    return false;
  }

  // 4. Disallow trailing slash (storage key must point to a specific file object, not a directory)
  if (key.endsWith('/')) {
    return false;
  }

  return true;
}
