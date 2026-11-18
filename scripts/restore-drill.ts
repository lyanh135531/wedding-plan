/**
 * Backup checksum verification harness.
 * Real mode restores into a fresh isolated database and uploads directory, reconciles
 * snapshot evidence and removes saved credentials before certifying the drill.
 */

import fs from 'fs';
import path from 'path';
import { computeFileSha256, BackupManifest } from './backup';
import crypto from 'node:crypto';
import { Client } from 'pg';
import { captureDatabaseEvidence, captureUploadEvidence, quoteIdentifier, runPgTool, verifyUploadArchive } from './backup-integrity';

export interface RestoreDrillResult {
  backupId: string;
  isChecksumValid: boolean;
  isDbRestored: boolean;
  isUploadsRestored: boolean;
  integrityChecksPassed: boolean;
  verificationMode: 'checksum-only' | 'restored-and-verified';
  sandboxDatabase?: string;
  sandboxUploads?: string;
  credentialsSanitized?: boolean;
  verifiedAt: string;
}

export async function executeRestoreDrill(
  backupFolderPath: string,
  options: { mockMode?: boolean; adminUrl?: string; sandboxRoot?: string; ownerEmails?: [string, string] } = {}
): Promise<RestoreDrillResult> {
  const manifestPath = path.join(backupFolderPath, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest not found at ${manifestPath}`);
  }

  const manifest: BackupManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  // Only bundle-local, canonical filenames are accepted.
  if (manifest.dbDumpFile !== 'database.dump' || manifest.uploadsArchiveFile !== 'uploads.tar.gz') {
    throw new Error('UNSAFE_MANIFEST_PATH');
  }

  // 1. Checksum Verification (AT56)
  const dbDumpPath = path.join(backupFolderPath, manifest.dbDumpFile);
  const uploadsArchivePath = path.join(backupFolderPath, manifest.uploadsArchiveFile);

  if (!fs.existsSync(dbDumpPath) || !fs.existsSync(uploadsArchivePath)) {
    throw new Error('Backup archive is incomplete: missing database dump or uploads archive');
  }

  const actualDbSha = computeFileSha256(dbDumpPath);
  const actualUploadsSha = computeFileSha256(uploadsArchivePath);

  const isDbValid = actualDbSha === manifest.dbDumpSha256;
  const isUploadsValid = actualUploadsSha === manifest.uploadsArchiveSha256;
  const isChecksumValid = isDbValid && isUploadsValid;

  if (!isChecksumValid) {
    throw new Error('CHECKSUM_MISMATCH: Backup files have been corrupted or tampered with');
  }

  if (options.mockMode) {
    return {
      backupId: manifest.backupId, verificationMode: 'checksum-only',
      isChecksumValid: true, isDbRestored: false, isUploadsRestored: false,
      integrityChecksPassed: false, verifiedAt: new Date().toISOString(),
    };
  }
  if (!options.adminUrl || !options.sandboxRoot || !options.ownerEmails) {
    throw new Error('RESTORE_CONFIGURATION_REQUIRED: adminUrl, sandboxRoot and two ownerEmails are required');
  }
  if (manifest.mockMode || !manifest.databaseEvidence || !manifest.uploadEvidence) {
    throw new Error('REAL_BACKUP_REQUIRED: Mock or legacy checksum-only bundles cannot certify recovery');
  }
  const expectedOwners = options.ownerEmails.map((email) => email.trim().toLowerCase()).sort();
  if (expectedOwners.length !== 2 || new Set(expectedOwners).size !== 2 || expectedOwners.some((email) => !email.includes('@'))) {
    throw new Error('Two distinct expected owner emails are required');
  }
  verifyUploadArchive(uploadsArchivePath);
  // Never restore into an operator-supplied database name or an existing uploads tree.
  const databaseName = `wedding_drill_${crypto.randomUUID().replaceAll('-', '')}`;
  const sandboxUrl = new URL(options.adminUrl);
  sandboxUrl.pathname = '/' + databaseName;
  const admin = new Client({ connectionString: options.adminUrl });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE ${quoteIdentifier(databaseName)} TEMPLATE template0`);
  } finally { await admin.end(); }
  fs.mkdirSync(options.sandboxRoot, { recursive: true });
  const uploadsTarget = fs.mkdtempSync(path.join(path.resolve(options.sandboxRoot), 'uploads-'));
  runPgTool('pg_restore', ['--no-owner', '--no-privileges', '--exit-on-error', '--single-transaction', dbDumpPath], sandboxUrl.toString());
  const target = new Client({ connectionString: sandboxUrl.toString() });
  await target.connect();
  try {
    await target.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
    const restored = await captureDatabaseEvidence(target);
    if (JSON.stringify(restored) !== JSON.stringify(manifest.databaseEvidence)) {
      throw new Error('DATABASE_INTEGRITY_MISMATCH: Row counts, fingerprints or numeric totals differ');
    }
    const invalid = await target.query("SELECT 1 FROM pg_constraint WHERE contype='f' AND NOT convalidated");
    if (invalid.rowCount) throw new Error('FOREIGN_KEY_VALIDATION_FAILED');
    const owners = await target.query<{ email: string }>("SELECT lower(email) AS email FROM users WHERE role='owner' ORDER BY lower(email)");
    if (JSON.stringify(owners.rows.map((owner) => owner.email)) !== JSON.stringify(expectedOwners)) {
      throw new Error('OWNER_VERIFICATION_FAILED');
    }
    // Revive no saved sessions, invitation tokens, verification tokens or OAuth credentials.
    await target.query('DELETE FROM sessions');
    await target.query('DELETE FROM member_invites');
    await target.query('DELETE FROM verifications');
    await target.query('DELETE FROM member_event_access');
    await target.query('UPDATE accounts SET access_token=NULL, refresh_token=NULL, id_token=NULL, password=NULL');
    await target.query('COMMIT');
  } catch (error) {
    await target.query('ROLLBACK');
    throw error;
  } finally { await target.end(); }
  // Archive entries were checked for traversal, hardlinks and symlinks before extraction.
  const { execFileSync } = await import('node:child_process');
  execFileSync('tar', ['-xzf', uploadsArchivePath, '-C', uploadsTarget]);
  if (JSON.stringify(captureUploadEvidence(uploadsTarget)) !== JSON.stringify(manifest.uploadEvidence)) {
    throw new Error('UPLOAD_INTEGRITY_MISMATCH');
  }
  return {
    backupId: manifest.backupId, verificationMode: 'restored-and-verified',
    isChecksumValid: true, isDbRestored: true, isUploadsRestored: true,
    integrityChecksPassed: true, credentialsSanitized: true,
    sandboxDatabase: databaseName, sandboxUploads: uploadsTarget,
    verifiedAt: new Date().toISOString(),
  };
}

if (process.argv[1] && process.argv[1].endsWith('restore-drill.ts')) {
  console.log('[RESTORE DRILL] Initiating automated restore drill...');
  // Find latest backup
  const backupBaseDir = path.resolve(process.cwd(), 'backups');
  if (!fs.existsSync(backupBaseDir)) {
    console.error('[RESTORE DRILL FAILED]: No backups directory found');
    process.exit(1);
  }

  const entries = fs.readdirSync(backupBaseDir).filter((d) => !d.startsWith('.'));
  if (entries.length === 0) {
    console.error('[RESTORE DRILL FAILED]: No backup packages available');
    process.exit(1);
  }

  const latest = path.join(backupBaseDir, entries.sort().pop()!);
  executeRestoreDrill(latest, {
    adminUrl: process.env.RESTORE_ADMIN_URL,
    sandboxRoot: process.env.RESTORE_SANDBOX_ROOT,
    ownerEmails: [process.env.OWNER_EMAIL_1 || '', process.env.OWNER_EMAIL_2 || ''],
  })
    .then((res) => {
      console.log(`[RESTORE DRILL]: Backup ${res.backupId}: ${res.verificationMode}.`);
    })
    .catch((err) => {
      console.error('[RESTORE DRILL FAILED]:', err);
      process.exit(1);
    });
}
