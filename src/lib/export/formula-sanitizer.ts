/**
 * Formula Injection (CSV / Spreadsheet Injection, CWE-1236) Protection
 *
 * Invariant (AT29):
 * Any cell value starting with dangerous formula triggering characters:
 * '=', '+', '-', '@', '\t', '\r'
 * must be safely escaped (e.g. prefixed with single quote '\'') before exporting to CSV/XLSX,
 * preventing arbitrary command execution or DDE payload invocation in Excel, Google Sheets, or LibreOffice.
 */

const DANGEROUS_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Escapes a single string value to prevent spreadsheet formula execution.
 */
export function sanitizeForSpreadsheet(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const str = String(value);
  if (str.length === 0) {
    return '';
  }

  const firstChar = str.charAt(0);
  if (DANGEROUS_PREFIXES.includes(firstChar)) {
    // Prefix with single quote to force Excel to treat the cell strictly as literal text
    return `'${str}`;
  }

  return str;
}

/**
 * Strips dangerous leading formula characters when importing spreadsheet data.
 */
export function sanitizeFromSpreadsheet(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  let str = String(value).trim();
  // If string was escaped with leading single quote, unescape it
  if (str.startsWith("'") && str.length > 1 && DANGEROUS_PREFIXES.includes(str.charAt(1))) {
    str = str.substring(1);
  }

  // Strip formula execution characters if importing raw user inputs
  while (str.length > 0 && DANGEROUS_PREFIXES.includes(str.charAt(0))) {
    str = str.substring(1).trim();
  }

  return str;
}

/**
 * Converts an array of objects into a secure CSV string with RFC 4180 compliance
 * and formula injection sanitization.
 */
export function generateSecureCsv(
  headers: Array<{ key: string; label: string }>,
  rows: Array<Record<string, unknown>>
): string {
  // UTF-8 BOM so Excel opens Vietnamese characters (Unicode) properly without mojibake
  const BOM = '\uFEFF';

  const headerLine = headers
    .map((h) => escapeCsvCell(h.label))
    .join(',');

  const dataLines = rows.map((row) => {
    return headers
      .map((h) => {
        const rawVal = row[h.key];
        const sanitizedVal = sanitizeForSpreadsheet(rawVal);
        return escapeCsvCell(sanitizedVal);
      })
      .join(',');
  });

  return BOM + [headerLine, ...dataLines].join('\r\n');
}

function escapeCsvCell(cellValue: string): string {
  if (cellValue.includes(',') || cellValue.includes('"') || cellValue.includes('\n') || cellValue.includes('\r')) {
    return `"${cellValue.replace(/"/g, '""')}"`;
  }
  return cellValue;
}
