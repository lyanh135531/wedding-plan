import { describe, it, expect } from 'vitest';
import {
  sanitizeForSpreadsheet,
  sanitizeFromSpreadsheet,
  generateSecureCsv,
} from '../../../src/lib/export/formula-sanitizer';

describe('Formula Injection Sanitization (AT29, CWE-1236)', () => {
  describe('1. sanitizeForSpreadsheet Export Escaping', () => {
    it('prefixes formula triggers with a single quote to prevent execution in Excel/Calc', () => {
      const maliciousPayloads = [
        '=cmd|\' /C calc\'!A0',
        '+1+1',
        '-5+2',
        '@SUM(1,1)',
        '\tmaliciousTab',
        '\rmaliciousCarriage',
      ];

      for (const payload of maliciousPayloads) {
        const escaped = sanitizeForSpreadsheet(payload);
        expect(escaped.startsWith("'")).toBe(true);
        expect(escaped).toBe(`'${payload}`);
      }
    });

    it('leaves standard Vietnamese names and regular text unescaped', () => {
      expect(sanitizeForSpreadsheet('Nguyễn Văn An')).toBe('Nguyễn Văn An');
      expect(sanitizeForSpreadsheet('0901234567')).toBe('0901234567');
      expect(sanitizeForSpreadsheet('Bác Ba & Gia đình')).toBe('Bác Ba & Gia đình');
      expect(sanitizeForSpreadsheet('')).toBe('');
      expect(sanitizeForSpreadsheet(null)).toBe('');
    });
  });

  describe('2. sanitizeFromSpreadsheet Import Cleaning', () => {
    it('un-escapes legitimate text prefixed with single quote for formula protection', () => {
      expect(sanitizeFromSpreadsheet("'-10")).toBe('10');
      expect(sanitizeFromSpreadsheet("'=SUM")).toBe('SUM');
    });

    it('strips leading dangerous characters from untrusted raw user inputs', () => {
      expect(sanitizeFromSpreadsheet('=cmd|calc')).toBe('cmd|calc');
      expect(sanitizeFromSpreadsheet('+84901234567')).toBe('84901234567');
    });
  });

  describe('3. generateSecureCsv Full Generation', () => {
    it('includes UTF-8 BOM and escapes commas, quotes, and malicious formulas', () => {
      const headers = [
        { key: 'name', label: 'Họ và tên' },
        { key: 'notes', label: 'Ghi chú' },
      ];
      const rows = [
        { name: 'Nguyễn Văn A', notes: 'Bình thường' },
        { name: '=HYPERLINK("http://attacker.com")', notes: 'Có dấu "ngoặc kép" và dấu, phẩy' },
      ];

      const csv = generateSecureCsv(headers, rows);

      // Verify UTF-8 BOM (\uFEFF)
      expect(csv.charCodeAt(0)).toBe(0xfeff);

      // Verify formula payload is prefixed with single quote
      expect(csv).toContain('"\'=HYPERLINK(""http://attacker.com"")"');

      // Verify quotes and commas are properly escaped
      expect(csv).toContain('"Có dấu ""ngoặc kép"" và dấu, phẩy"');
    });
  });
});
