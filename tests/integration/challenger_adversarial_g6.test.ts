import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  stageGuestImport,
  commitGuestImport,
  rollbackGuestImport,
  ImportBatchHasErrorsError,
} from '@/lib/import/import.service';
import {
  sanitizeForSpreadsheet,
  sanitizeFromSpreadsheet,
  generateSecureCsv,
} from '@/lib/export/formula-sanitizer';
import { createAtomicBackup, computeFileSha256 } from '../../scripts/backup';
import { executeRestoreDrill } from '../../scripts/restore-drill';

describe('Adversarial Challenger Suite: Gate G6 Import/Export, Consistency & Restore Drill', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // AT27: ATOMIC BATCH IMPORT (1 ERROR ROW BLOCKS PARTIAL WRITES)
  // =========================================================================
  describe('AT27: Atomic batch data import & error isolation', () => {
    it('isolates error row among 50 rows in staging, blocks commit, and produces 0 partial writes', async () => {
      // 50 rows: rows 1-49 valid, row 50 has empty display_name
      const rawRows = Array.from({ length: 49 }, (_, i) => ({
        display_name: `Khách Mời Số ${i + 1}`,
        phone: `09010000${String(i).padStart(2, '0')}`,
        side: 'groom',
      }));

      // Row 50 is invalid (empty display_name)
      rawRows.push({
        display_name: '',
        phone: '0901999999',
        side: 'bride',
      });

      const mockTx = {
        insert: vi.fn().mockImplementation(() => ({
          values: vi.fn().mockImplementation((val: any) => {
            if (Array.isArray(val)) {
              // importRows
              return Promise.resolve(val);
            }
            // importBatches header
            return {
              returning: vi.fn().mockResolvedValue([
                {
                  id: 'batch-1',
                  userId: 'user-1',
                  status: 'staged',
                  totalRows: 50,
                  validRows: 49,
                  errorRows: 1,
                },
              ]),
            };
          }),
        })),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({ for: vi.fn().mockResolvedValue([
                {
                  id: 'batch-1',
                  userId: 'user-1',
                  status: 'staged',
                  totalRows: 50,
                  validRows: 49,
                  errorRows: 1, // Error row present!
                },
              ]) }),
            }),
          }),
        }),
      };

      // 1. Stage the batch
      const staged = await stageGuestImport(mockTx as any, 'guests_50.csv', rawRows, 'user-1');

      expect(staged.totalRows).toBe(50);
      expect(staged.validRows).toBe(49);
      expect(staged.errorRows).toBe(1);
      expect(staged.status).toBe('staged');
      expect(staged.rows[49].isValid).toBe(false);
      expect(staged.rows[49].errorMessages.length).toBeGreaterThan(0);

      // 2. Invariant AT27: Attempting to commit batch with errors MUST be rejected!
      await expect(
        commitGuestImport(mockTx as any, 'batch-1', 'user-1')
      ).rejects.toThrow(ImportBatchHasErrorsError);
    });
  });

  // =========================================================================
  // AT29: FORMULA INJECTION SANITIZATION (CSV/SPREADSHEET INJECTION)
  // =========================================================================
  describe('AT29: Formula injection sanitization on export and import', () => {
    it('neutralizes dangerous formula execution characters (=, +, -, @) on export', () => {
      const maliciousNames = [
        '=cmd|\' /C calc\'!A0',
        '+1000000',
        '-500000',
        '@SUM(1..99)',
      ];

      for (const name of maliciousNames) {
        const sanitized = sanitizeForSpreadsheet(name);
        // Must start with single quote so spreadsheet engines do not execute it
        expect(sanitized.startsWith("'")).toBe(true);
      }
    });

    it('strips dangerous command prefixes on import to prevent backend execution', () => {
      expect(sanitizeFromSpreadsheet('=cmd|calc')).toBe('cmd|calc');
      expect(sanitizeFromSpreadsheet('@malicious()')).toBe('malicious()');
    });
  });

  // =========================================================================
  // AT43, AT55 & AT56: ATOMIC BACKUP, RESILIENCE & RESTORE DRILL
  // =========================================================================
  describe('AT43, AT55, AT56: Consistent backup, power-loss resilience & restore drill', () => {
    const testTempDir = path.resolve(process.cwd(), 'backups_test_temp');

    beforeEach(() => {
      if (fs.existsSync(testTempDir)) {
        fs.rmSync(testTempDir, { recursive: true, force: true });
      }
      fs.mkdirSync(testTempDir, { recursive: true });
    });

    it('AT43 & AT56: creates atomic backup bundle with verified checksums and leaves staging clean', async () => {
      const manifest = await createAtomicBackup({
        backupDir: testTempDir,
        mockMode: true,
      });

      expect(manifest.backupId).toBeDefined();
      expect(manifest.dbDumpSha256).toBeDefined();
      expect(manifest.uploadsArchiveSha256).toBeDefined();

      const finalBackupPath = path.join(testTempDir, manifest.backupId);
      expect(fs.existsSync(finalBackupPath)).toBe(true);

      // Verify AT43: staging directory was completely cleaned up after atomic move
      const stagingDir = path.join(testTempDir, '.staging');
      expect(fs.existsSync(stagingDir)).toBe(false);

      // Verify files exist in final backup
      expect(fs.existsSync(path.join(finalBackupPath, manifest.dbDumpFile))).toBe(true);
      expect(fs.existsSync(path.join(finalBackupPath, manifest.uploadsArchiveFile))).toBe(true);
      expect(fs.existsSync(path.join(finalBackupPath, 'manifest.json'))).toBe(true);
    });

    it('AT32, AT55: validates checksums without claiming a database or uploads restore', async () => {
      // 1. Create pristine backup
      const manifest = await createAtomicBackup({
        backupDir: testTempDir,
        mockMode: true,
      });

      const backupFolder = path.join(testTempDir, manifest.backupId);

      // 2. Run restore drill
      const drillResult = await executeRestoreDrill(backupFolder, { mockMode: true });

      expect(drillResult.isChecksumValid).toBe(true);
      expect(drillResult.isDbRestored).toBe(false);
      expect(drillResult.isUploadsRestored).toBe(false);
      expect(drillResult.integrityChecksPassed).toBe(false);
    });

    it('AT55: rejects restore drill if database dump or uploads archive was tampered with (checksum mismatch)', async () => {
      // 1. Create backup
      const manifest = await createAtomicBackup({
        backupDir: testTempDir,
        mockMode: true,
      });

      const backupFolder = path.join(testTempDir, manifest.backupId);
      const dbDumpPath = path.join(backupFolder, manifest.dbDumpFile);

      // 2. Tamper with database dump file
      fs.appendFileSync(dbDumpPath, 'TAMPERED_MALICIOUS_BYTE');

      // 3. Invariant AT55: Restore drill MUST detect tampering and throw CHECKSUM_MISMATCH error
      await expect(
        executeRestoreDrill(backupFolder, { mockMode: true })
      ).rejects.toThrow('CHECKSUM_MISMATCH');
    });
  });
});
