/**
 * Wedding Management Platform — Atomic & Consistent Backup Automation
 *
 * Invariants:
 * - AT43: Two-phase staging write: writes to temporary directory `.staging/` first,
 *   computes SHA-256 checksums, and only on complete success atomically renames to `backups/`.
 *   Interrupted staging remains unpublished; other backup jobs never delete it.
 * - Bundles PostgreSQL database (`pg_dump -Fc`)
 *   and upload storage. The operator must stop application writes for consistency.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import { setTimeout } from 'node:timers/promises';
import { Client } from 'pg';
import { captureDatabaseEvidence, captureUploadEvidence, runPgTool, type DatabaseEvidence, type UploadEvidence } from './backup-integrity';

export interface BackupManifest {
  backupId: string;
  createdAt: string;
  dbDumpFile: string;
  dbDumpSha256: string;
  uploadsArchiveFile: string;
  uploadsArchiveSha256: string;
  manifestSha256?: string;
  version: string;
  mockMode?: boolean;
  databaseEvidence?: DatabaseEvidence;
  uploadEvidence?: UploadEvidence;
}

export function computeFileSha256(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

export async function createAtomicBackup(options: {
  backupDir?: string;
  uploadsDir?: string;
  dbUrl?: string;
  mockMode?: boolean;
}): Promise<BackupManifest> {
  const backupDir = options.backupDir || path.resolve(process.cwd(), 'backups');
  const uploadsDir = options.uploadsDir || process.env.UPLOAD_DIR || '/data/uploads';
  const dbUrl = options.dbUrl || process.env.DATABASE_URL;
  if (!options.mockMode) {
    if (!dbUrl) throw new Error('DATABASE_URL is required for a real backup');
    if (!fs.existsSync(uploadsDir) || !fs.statSync(uploadsDir).isDirectory()) {
      throw new Error('Uploads directory is missing; refusing to create an incomplete backup');
    }
  }
  const stagingDir = path.join(backupDir, '.staging');

  // Ensure directories exist
  fs.mkdirSync(backupDir, { recursive: true });
  fs.mkdirSync(stagingDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupId = `backup_${timestamp}_${crypto.randomUUID()}`;
  const stageTargetDir = path.join(stagingDir, backupId);
  fs.mkdirSync(stageTargetDir, { recursive: true });

  const dbDumpName = 'database.dump';
  const uploadsArchiveName = 'uploads.tar.gz';
  const dbDumpPath = path.join(stageTargetDir, dbDumpName);
  const uploadsArchivePath = path.join(stageTargetDir, uploadsArchiveName);

  let databaseEvidence: DatabaseEvidence | undefined;
  let uploadEvidence: UploadEvidence | undefined;
  // Export one PostgreSQL snapshot for both evidence and pg_dump.
  if (options.mockMode) {
    fs.writeFileSync(dbDumpPath, Buffer.from(`MOCK_PG_DUMP_DATA_${Date.now()}`));
  } else {
    const client = new Client({ connectionString: dbUrl });
    await client.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const snapshot = await client.query<{ snapshot: string }>('SELECT pg_export_snapshot() AS snapshot');
      databaseEvidence = await captureDatabaseEvidence(client);
      runPgTool('pg_dump', ['-Fc', '--snapshot', snapshot.rows[0].snapshot, '-f', dbDumpPath], dbUrl!);
      await client.query('COMMIT');
    } finally {
      await client.end();
    }
  }

  // 2. Snapshot uploads storage
  if (options.mockMode) {
    fs.writeFileSync(uploadsArchivePath, Buffer.from(`MOCK_UPLOADS_STORAGE_${Date.now()}`));
  } else {
    uploadEvidence = captureUploadEvidence(uploadsDir);
    execFileSync('tar', ['-czf', uploadsArchivePath, '-C', uploadsDir, '.'], { stdio: 'inherit' });
    if (JSON.stringify(captureUploadEvidence(uploadsDir)) !== JSON.stringify(uploadEvidence)) {
      throw new Error('Uploads changed during backup; stop application writes and retry');
    }
  }

  // 3. Compute Checksums
  const dbDumpSha256 = computeFileSha256(dbDumpPath);
  const uploadsArchiveSha256 = computeFileSha256(uploadsArchivePath);

  const manifest: BackupManifest = {
    backupId,
    createdAt: new Date().toISOString(),
    dbDumpFile: dbDumpName,
    dbDumpSha256,
    uploadsArchiveFile: uploadsArchiveName,
    uploadsArchiveSha256,
    version: '1.0.0',
    mockMode: !!options.mockMode,
    databaseEvidence,
    uploadEvidence,
  };

  const manifestPath = path.join(stageTargetDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

  // 4. AT43: Atomic move from staging to final backup directory
  const finalBackupPath = path.join(backupDir, backupId);
  // Windows scanners can briefly hold new files open. Retry only that transient error.
  for (let attempt = 0; ; attempt++) {
    try {
      fs.renameSync(stageTargetDir, finalBackupPath);
      break;
    } catch (error) {
      if (process.platform !== 'win32' || (error as NodeJS.ErrnoException).code !== 'EPERM' || attempt >= 4) throw error;
      await setTimeout(25 * (attempt + 1));
    }
  }
  // Another backup may have its own staging folder: never delete it.
  try { fs.rmdirSync(stagingDir); } catch (error) {
    if (!['ENOTEMPTY', 'ENOENT'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error;
  }

  return manifest;
}

if (process.argv[1] && process.argv[1].endsWith('backup.ts')) {
  console.log('[BACKUP] Starting atomic backup sequence...');
  createAtomicBackup({ mockMode: false })
    .then((manifest) => {
      console.log(`[BACKUP SUCCESS] Backup created: ${manifest.backupId}`);
    })
    .catch((err) => {
      console.error('[BACKUP FAILED]:', err);
      process.exit(1);
    });
}
