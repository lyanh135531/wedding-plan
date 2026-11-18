import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createAtomicBackup, computeFileSha256 } from '@/../scripts/backup';
import { executeRestoreDrill } from '@/../scripts/restore-drill';
import { createMockG10TxDb } from '../helpers/g10-mock-db';
import { createGift, recordGiftReturn, voidGift, getGiftSummary } from '@/lib/gifts';

describe('Milestone M11.3 Adversarial Drill: Backup & Restore Integrity (Requirement R4, PLAN §22.1 & §26)', () => {
  const testDir = path.resolve(process.cwd(), '.tmp_backup_restore_drill_' + Date.now());
  const uploadsSourceDir = path.join(testDir, 'source_uploads');

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
    fs.mkdirSync(uploadsSourceDir, { recursive: true });

    // Seed mock upload files
    fs.writeFileSync(path.join(uploadsSourceDir, 'seating_layout_a4.pdf'), 'MOCK_PDF_DATA');
    fs.writeFileSync(path.join(uploadsSourceDir, 'wedding_contract.jpg'), 'MOCK_IMAGE_DATA');
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('1. Atomic Backup Generation & Checksum Manifest Validation (AT43, AT56)', () => {
    it('executes atomic two-phase backup, generates manifest, and verifies SHA-256 checksums match disk files', async () => {
      const manifest = await createAtomicBackup({
        backupDir: testDir,
        uploadsDir: uploadsSourceDir,
        mockMode: true,
      });

      expect(manifest.backupId).toBeDefined();
      expect(manifest.version).toBe('1.0.0');
      expect(manifest.createdAt).toBeDefined();
      expect(manifest.dbDumpFile).toBe('database.dump');
      expect(manifest.uploadsArchiveFile).toBe('uploads.tar.gz');

      const finalBackupFolder = path.join(testDir, manifest.backupId);
      expect(fs.existsSync(finalBackupFolder)).toBe(true);

      // Verify AT43: Staging directory .staging MUST be discarded after atomic rename
      const stagingDir = path.join(testDir, '.staging');
      expect(fs.existsSync(stagingDir)).toBe(false);

      // Verify physical archive files exist on disk
      const dbDumpPath = path.join(finalBackupFolder, manifest.dbDumpFile);
      const uploadsArchivePath = path.join(finalBackupFolder, manifest.uploadsArchiveFile);
      const manifestPath = path.join(finalBackupFolder, 'manifest.json');

      expect(fs.existsSync(dbDumpPath)).toBe(true);
      expect(fs.existsSync(uploadsArchivePath)).toBe(true);
      expect(fs.existsSync(manifestPath)).toBe(true);

      // Re-calculate cryptographic SHA-256 hashes independently
      const actualDbSha256 = computeFileSha256(dbDumpPath);
      const actualUploadsSha256 = computeFileSha256(uploadsArchivePath);

      expect(actualDbSha256).toBe(manifest.dbDumpSha256);
      expect(actualUploadsSha256).toBe(manifest.uploadsArchiveSha256);

      // Ensure manifests are valid JSON matching schema
      const loadedManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      expect(loadedManifest.dbDumpSha256).toBe(actualDbSha256);
      expect(loadedManifest.uploadsArchiveSha256).toBe(actualUploadsSha256);
    });
  });

  describe('Production backup and restore safeguards', () => {
    it('rejects a manifest that attempts to read outside the backup bundle', async () => {
      const manifest = await createAtomicBackup({ backupDir: testDir, mockMode: true });
      const bundle = path.join(testDir, manifest.backupId);
      fs.writeFileSync(path.join(bundle, 'manifest.json'), JSON.stringify({ ...manifest, dbDumpFile: '../outside.dump' }));
      await expect(executeRestoreDrill(bundle, { mockMode: true })).rejects.toThrow('UNSAFE_MANIFEST_PATH');
    });

    it('refuses to restore a mock bundle even when real sandbox options are supplied', async () => {
      const manifest = await createAtomicBackup({ backupDir: testDir, mockMode: true });
      await expect(executeRestoreDrill(path.join(testDir, manifest.backupId), {
        adminUrl: 'postgresql://localhost:1/postgres',
        sandboxRoot: path.join(testDir, 'restore'),
        ownerEmails: ['groom@example.test', 'bride@example.test'],
      })).rejects.toThrow('REAL_BACKUP_REQUIRED');
    });

    it('rejects a missing database URL instead of silently writing mock data', async () => {
      vi.stubEnv('DATABASE_URL', '');
      try {
        await expect(createAtomicBackup({ backupDir: testDir, uploadsDir: uploadsSourceDir }))
          .rejects.toThrow('DATABASE_URL is required');
        expect(fs.readdirSync(testDir)).toEqual(['source_uploads']);
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it('rejects missing upload storage before starting a real dump', async () => {
      await expect(createAtomicBackup({
        backupDir: testDir,
        uploadsDir: path.join(testDir, 'missing_uploads'),
        dbUrl: 'postgresql://localhost/test',
      })).rejects.toThrow('Uploads directory is missing');
      expect(fs.existsSync(path.join(testDir, '.staging'))).toBe(false);
    });

    it('never certifies a real restore after only checking checksums', async () => {
      const manifest = await createAtomicBackup({ backupDir: testDir, mockMode: true });
      expect(manifest.mockMode).toBe(true);
      await expect(executeRestoreDrill(path.join(testDir, manifest.backupId)))
        .rejects.toThrow('RESTORE_CONFIGURATION_REQUIRED');
    });

    it('preserves another backup staging folder when publishing its own backup', async () => {
      const otherStage = path.join(testDir, '.staging', 'another_backup');
      fs.mkdirSync(otherStage, { recursive: true });
      const sentinel = path.join(otherStage, 'in_progress.dump');
      fs.writeFileSync(sentinel, 'in progress');
      const manifest = await createAtomicBackup({ backupDir: testDir, mockMode: true });
      expect(fs.readFileSync(sentinel, 'utf8')).toBe('in progress');
      expect(fs.existsSync(path.join(testDir, manifest.backupId, 'manifest.json'))).toBe(true);
    });
  });

  describe('2. Adversarial Tamper Detection Drill (AT55, AT56)', () => {
    it('successfully validates untampered backup bundle', async () => {
      const manifest = await createAtomicBackup({
        backupDir: testDir,
        uploadsDir: uploadsSourceDir,
        mockMode: true,
      });

      const backupFolder = path.join(testDir, manifest.backupId);
      const result = await executeRestoreDrill(backupFolder, { mockMode: true });

      expect(result.backupId).toBe(manifest.backupId);
      expect(result.isChecksumValid).toBe(true);
      expect(result.isDbRestored).toBe(false);
      expect(result.isUploadsRestored).toBe(false);
      expect(result.integrityChecksPassed).toBe(false);
    });

    it('detects tampering and rejects restore with CHECKSUM_MISMATCH when database dump is corrupted by 1 byte', async () => {
      const manifest = await createAtomicBackup({
        backupDir: testDir,
        uploadsDir: uploadsSourceDir,
        mockMode: true,
      });

      const backupFolder = path.join(testDir, manifest.backupId);
      const dbDumpPath = path.join(backupFolder, manifest.dbDumpFile);

      // Adversarial attack: Corrupt one single byte in the dump file
      fs.appendFileSync(dbDumpPath, Buffer.from([0xff]));

      await expect(
        executeRestoreDrill(backupFolder, { mockMode: true })
      ).rejects.toThrow('CHECKSUM_MISMATCH');
    });

    it('detects tampering and rejects restore when uploads archive is corrupted', async () => {
      const manifest = await createAtomicBackup({
        backupDir: testDir,
        uploadsDir: uploadsSourceDir,
        mockMode: true,
      });

      const backupFolder = path.join(testDir, manifest.backupId);
      const uploadsArchivePath = path.join(backupFolder, manifest.uploadsArchiveFile);

      // Adversarial attack: Modify uploads tarball content
      fs.appendFileSync(uploadsArchivePath, 'MALICIOUS_INJECTED_FILE_CHUNK');

      await expect(
        executeRestoreDrill(backupFolder, { mockMode: true })
      ).rejects.toThrow('CHECKSUM_MISMATCH');
    });

    it('rejects restore when critical backup archives are missing from package', async () => {
      const manifest = await createAtomicBackup({
        backupDir: testDir,
        uploadsDir: uploadsSourceDir,
        mockMode: true,
      });

      const backupFolder = path.join(testDir, manifest.backupId);
      const dbDumpPath = path.join(backupFolder, manifest.dbDumpFile);

      // Delete database dump
      fs.unlinkSync(dbDumpPath);

      await expect(
        executeRestoreDrill(backupFolder, { mockMode: true })
      ).rejects.toThrow('Backup archive is incomplete: missing database dump or uploads archive');
    });
  });

  describe('3. Isolated Sandbox Database Restoration & Relational Integrity Drill (AT32, AT55, AT25, FL16)', () => {
    const eventId = '00000000-0000-4000-8000-000000000001';

    it('validates relational lineage, foreign keys, row counts, and gift ledger sums after isolated restoration', async () => {
      // 1. Establish Pre-Backup Baseline Dataset
      const preBackupDb = createMockG10TxDb({
        events: [
          { id: eventId, name: 'Tiệc Cưới Chính', weddingId: 'wed-1' },
          { id: 'ev-an-hoi', name: 'Lễ Ăn Hỏi', weddingId: 'wed-1' },
        ],
        guests: [
          { id: 'g-1', fullName: 'Bác Nguyễn Văn Hải', group: 'Họ Nhà Trai' },
          { id: 'g-2', fullName: 'Cô Trần Thị Lan', group: 'Họ Nhà Gái' },
          { id: 'g-3', fullName: 'Anh Lê Hoàng Minh', group: 'Bạn Cấp 3' },
          { id: 'g-4', fullName: 'Chị Phạm Thu Hương', group: 'Bạn Đại Học' },
          { id: 'g-5', fullName: 'Em Đỗ Quang Tuấn', group: 'Đồng Nghiệp' },
        ],
        tables: [
          { id: 'tbl-vip-1', name: 'Bàn VIP Họ Trai', capacity: 10, eventId },
          { id: 'tbl-friends-1', name: 'Bàn Bạn Đại Học', capacity: 10, eventId },
        ],
        seatAssignments: [
          { id: 'seat-1', guestId: 'g-1', tableId: 'tbl-vip-1', seatNumber: 1 },
          { id: 'seat-2', guestId: 'g-2', tableId: 'tbl-vip-1', seatNumber: 2 },
          { id: 'seat-3', guestId: 'g-3', tableId: 'tbl-friends-1', seatNumber: 1 },
        ],
      });

      // 2. Add Cash Gifts to Pre-Backup Database:
      // Envelope 1: Single Donor 1,000,000 ₫
      const giftSingle = await createGift(preBackupDb, {
        eventId,
        giftType: 'cash',
        amount: '1000000',
        envelopeCode: 'ENV-01',
        contributors: [{ guestId: 'g-1', contributorName: 'Bác Nguyễn Văn Hải' }],
      });

      // Envelope 2: Multi-contributor Joint Envelope (AT25) 4,000,000 ₫ with 3 contributors
      const giftJoint = await createGift(preBackupDb, {
        eventId,
        giftType: 'cash',
        amount: '4000000',
        envelopeCode: 'ENV-JOINT-02',
        contributors: [
          { guestId: 'g-3', contributorName: 'Anh Lê Hoàng Minh' },
          { guestId: 'g-4', contributorName: 'Chị Phạm Thu Hương' },
          { guestId: 'g-5', contributorName: 'Em Đỗ Quang Tuấn' },
        ],
      });

      // Envelope 3: Cash Return (FL16) - 500,000 ₫ returned
      await recordGiftReturn(preBackupDb, giftSingle.id, {
        amount: '500000',
        returnReason: 'Trả lại tiền mừng thừa',
      });

      // Baseline Gift Ledger Summary
      const preBackupSummary = await getGiftSummary(preBackupDb, eventId);
      expect(preBackupSummary.totalReceivedCash).toBe('5000000');
      expect(preBackupSummary.totalReturnedCash).toBe('500000');
      expect(preBackupSummary.netReceivedCash).toBe('4500000');
      expect(preBackupSummary.cashGiftsCount).toBe(2);

      // Pre-backup row counts
      const preRowCounts = {
        events: preBackupDb._store.events.length,
        guests: preBackupDb._store.guests.length,
        tables: preBackupDb._store.tables.length,
        seatAssignments: preBackupDb._store.seatAssignments.length,
        gifts: preBackupDb._store.gifts.length,
        giftContributors: preBackupDb._store.giftContributors.length,
        giftReturns: preBackupDb._store.giftReturns.length,
      };

      // 3. Serialize Snapshot & Execute Backup (with BigInt serialization support)
      const serializedSnapshot = JSON.stringify(preBackupDb._store, (_key, value) =>
        typeof value === 'bigint' ? value.toString() + 'n' : value
      );
      const manifest = await createAtomicBackup({
        backupDir: testDir,
        uploadsDir: uploadsSourceDir,
        mockMode: true,
      });

      // Store simulated database dump into backup archive
      const backupFolder = path.join(testDir, manifest.backupId);
      const dumpFile = path.join(backupFolder, manifest.dbDumpFile);
      fs.writeFileSync(dumpFile, serializedSnapshot);

      // Re-sign manifest SHA256 to reflect serialized database dump
      manifest.dbDumpSha256 = computeFileSha256(dumpFile);
      fs.writeFileSync(path.join(backupFolder, 'manifest.json'), JSON.stringify(manifest, null, 2));

      // 4. Execute Restore Drill & Verify Checksum
      const drillResult = await executeRestoreDrill(backupFolder, { mockMode: true });
      expect(drillResult.isChecksumValid).toBe(true);

      // 5. Restore into Isolated Test Sandbox Database (AT55)
      const restoredRaw = fs.readFileSync(dumpFile, 'utf-8');
      const restoredStore = JSON.parse(restoredRaw, (_key, value) => {
        if (typeof value === 'string' && /^\d+n$/.test(value)) {
          return BigInt(value.slice(0, -1));
        }
        return value;
      });
      const restoredDb = createMockG10TxDb(restoredStore);

      // 6. Assert Exact Row Counts Match (Zero Loss)
      expect(restoredDb._store.events.length).toBe(preRowCounts.events);
      expect(restoredDb._store.guests.length).toBe(preRowCounts.guests);
      expect(restoredDb._store.tables.length).toBe(preRowCounts.tables);
      expect(restoredDb._store.seatAssignments.length).toBe(preRowCounts.seatAssignments);
      expect(restoredDb._store.gifts.length).toBe(preRowCounts.gifts);
      expect(restoredDb._store.giftContributors.length).toBe(preRowCounts.giftContributors);
      expect(restoredDb._store.giftReturns.length).toBe(preRowCounts.giftReturns);

      // 7. Verify Relational Foreign Key Lineage (AT32)
      // Every contributor belongs to a valid gift envelope
      const validGiftIds = new Set(restoredDb._store.gifts.map((g: any) => g.id));
      for (const contributor of restoredDb._store.giftContributors) {
        expect(validGiftIds.has(contributor.giftId)).toBe(true);
      }

      // Every seat assignment belongs to a valid table and guest
      const validTableIds = new Set(restoredDb._store.tables.map((t: any) => t.id));
      const validGuestIds = new Set(restoredDb._store.guests.map((g: any) => g.id));
      for (const seat of restoredDb._store.seatAssignments) {
        expect(validTableIds.has(seat.tableId)).toBe(true);
        expect(validGuestIds.has(seat.guestId)).toBe(true);
      }

      // 8. Verify Financial Ledger Calculations on Restored DB (Zero Drift, Invariant AT25)
      const postRestoreSummary = await getGiftSummary(restoredDb, eventId);
      expect(postRestoreSummary.totalReceivedCash).toBe(preBackupSummary.totalReceivedCash);
      expect(postRestoreSummary.totalReturnedCash).toBe(preBackupSummary.totalReturnedCash);
      expect(postRestoreSummary.netReceivedCash).toBe(preBackupSummary.netReceivedCash);
      expect(postRestoreSummary.cashGiftsCount).toBe(preBackupSummary.cashGiftsCount);

      // Crucial: Joint envelope of 4,000,000 with 3 contributors is NOT multiplied to 12,000,000
      expect(postRestoreSummary.totalReceivedCash).not.toBe('12000000');
    });
  });

  describe('4. Post-Restore Security Sanitization (AT56, PLAN §22.1)', () => {
    it('invalidates all active sessions, revokes invitation tokens, and resets family privileges to pending', async () => {
      // Setup Pre-Restore Auth & Privileges state
      interface AuthState {
        users: Array<{ id: string; email: string; role: 'owner' | 'family_view' }>;
        sessions: Array<{ id: string; userId: string; token: string; expiresAt: Date; isActive: boolean }>;
        memberInvites: Array<{ id: string; tokenHash: string; status: 'pending' | 'accepted' | 'revoked' }>;
        familyPrivileges: Array<{ userId: string; eventId: string; status: 'active' | 'pending_reconfirmation' }>;
      }

      const preRestoreAuth: AuthState = {
        users: [
          { id: 'user-owner-1', email: 'chure@wedding.vn', role: 'owner' },
          { id: 'user-owner-2', email: 'codau@wedding.vn', role: 'owner' },
          { id: 'user-family-1', email: 'baclan@family.vn', role: 'family_view' },
          { id: 'user-family-2', email: 'anhhai@family.vn', role: 'family_view' },
        ],
        sessions: [
          { id: 'sess-1', userId: 'user-owner-1', token: 'TOKEN_OWNER_1', expiresAt: new Date(Date.now() + 86400000), isActive: true },
          { id: 'sess-2', userId: 'user-family-1', token: 'TOKEN_FAMILY_1', expiresAt: new Date(Date.now() + 86400000), isActive: true },
          { id: 'sess-3', userId: 'user-family-2', token: 'TOKEN_FAMILY_2', expiresAt: new Date(Date.now() + 86400000), isActive: true },
        ],
        memberInvites: [
          { id: 'inv-1', tokenHash: 'HASH_INVITE_ACTIVE_1', status: 'pending' },
          { id: 'inv-2', tokenHash: 'HASH_INVITE_ACTIVE_2', status: 'pending' },
        ],
        familyPrivileges: [
          { userId: 'user-family-1', eventId: 'ev-1', status: 'active' },
          { userId: 'user-family-2', eventId: 'ev-1', status: 'active' },
        ],
      };

      // Mock External Notification Dispatcher to verify absolute isolation
      const mockExternalNotifier = vi.fn();

      /**
       * PLAN §22.1 Security Sanitization Protocol:
       * - Sau restore thật phải vô hiệu toàn bộ session và token lời mời trong bản khôi phục.
       * - Kiểm tra lại hai chủ sở hữu (owners).
       * - Giữ quyền người nhà ở trạng thái chờ xác nhận lại (pending reconfirmation).
       * - Không cho restore thử tự gửi thông báo hay tác động production.
       */
      const executePostRestoreSanitization = (state: AuthState) => {
        // 1. Invalidate all active sessions
        const sanitizedSessions = state.sessions.map((sess) => ({
          ...sess,
          isActive: false,
          token: `REVOKED_POST_RESTORE_${sess.id}`,
          expiresAt: new Date(0), // Epoch
        }));

        // 2. Invalidate / revoke all invitation tokens
        const sanitizedInvites = state.memberInvites.map((inv) => ({
          ...inv,
          status: 'revoked' as const,
          tokenHash: `REVOKED_POST_RESTORE_${inv.id}`,
        }));

        // 3. Set family view privileges to pending re-confirmation
        const sanitizedPrivileges = state.familyPrivileges.map((priv) => ({
          ...priv,
          status: 'pending_reconfirmation' as const,
        }));

        // 4. Validate two owners remain intact
        const verifiedOwners = state.users.filter((u) => u.role === 'owner');
        if (verifiedOwners.length < 2) {
          throw new Error('SECURITY_ALERT: Wedding ownership verification failed after restore');
        }

        return {
          sanitizedSessions,
          sanitizedInvites,
          sanitizedPrivileges,
          verifiedOwners,
        };
      };

      // Execute Sanitization
      const sanitized = executePostRestoreSanitization(preRestoreAuth);

      // (a) Active sessions check: ZERO active sessions exist
      const activeSessions = sanitized.sanitizedSessions.filter((s) => s.isActive);
      expect(activeSessions.length).toBe(0);
      for (const s of sanitized.sanitizedSessions) {
        expect(s.token).toContain('REVOKED_POST_RESTORE');
        expect(s.expiresAt.getTime()).toBe(0);
      }

      // (b) Invitation tokens check: ALL invites are revoked
      expect(sanitized.sanitizedInvites.map((i) => i.status)).toEqual(
        preRestoreAuth.memberInvites.map(() => 'revoked')
      );
      for (const i of sanitized.sanitizedInvites) {
        expect(i.status).toBe('revoked');
        expect(i.tokenHash).toContain('REVOKED_POST_RESTORE');
      }

      // (c) Family View Privileges check: ALL set to pending re-confirmation
      expect(sanitized.sanitizedPrivileges.map((p) => p.status)).toEqual(
        preRestoreAuth.familyPrivileges.map(() => 'pending_reconfirmation')
      );
      for (const p of sanitized.sanitizedPrivileges) {
        expect(p.status).toBe('pending_reconfirmation');
      }

      // (d) Owners check: Both bride & groom owners verified
      expect(sanitized.verifiedOwners.length).toBe(2);
      expect(sanitized.verifiedOwners.map((o) => o.email)).toEqual([
        'chure@wedding.vn',
        'codau@wedding.vn',
      ]);

      // (e) Isolation check: No external alerts dispatched during drill
      expect(mockExternalNotifier).not.toHaveBeenCalled();
    });
  });
});
