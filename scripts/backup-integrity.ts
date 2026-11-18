import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import type { Client } from 'pg';

export interface TableEvidence {
  rows: number;
  digest: string;
  numericTotals: Record<string, string | null>;
  foreignKeys: string[];
}

export type DatabaseEvidence = Record<string, TableEvidence>;
export type UploadEvidence = Record<string, string>;

export const quoteIdentifier = (value: string) => `"${value.replaceAll('"', '""')}"`;

/** Use libpq environment variables so passwords never appear in process arguments. */
export function runPgTool(command: string, args: string[], connectionString: string) {
  const url = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('Invalid PostgreSQL URL');
  try {
    const toolArgs = command === 'pg_restore' ? ['--dbname', decodeURIComponent(url.pathname.slice(1)), ...args] : args;
    execFileSync(command, toolArgs, {
      env: {
        ...process.env,
        PGHOST: url.hostname,
        PGPORT: url.port || '5432',
        PGUSER: decodeURIComponent(url.username),
        PGPASSWORD: decodeURIComponent(url.password),
        PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
        PGSSLMODE: url.searchParams.get('sslmode') || 'prefer',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 300_000,
    });
  } catch {
    // Do not serialize child_process errors: they contain the full environment.
    throw new Error(`${command} failed; no successful backup/restore can be certified`);
  }
}

/** Capture complete row fingerprints and exact numeric totals inside the caller's snapshot. */
export async function captureDatabaseEvidence(client: Client): Promise<DatabaseEvidence> {
  await client.query("SET LOCAL TIME ZONE 'UTC'");
  const tables = await client.query<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name"
  );
  const evidence: DatabaseEvidence = {};
  for (const { table_name: name } of tables.rows) {
    const table = `public.${quoteIdentifier(name)}`;
    const hashes = await client.query<{ row_hash: string }>(
      `SELECT md5(to_jsonb(t)::text) AS row_hash FROM ${table} AS t ORDER BY row_hash`
    );
    const digest = crypto.createHash('sha256');
    for (const row of hashes.rows) digest.update(row.row_hash + '\n');
    const columns = await client.query<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND data_type IN ('bigint','integer','smallint','numeric') ORDER BY column_name",
      [name]
    );
    const numericTotals: Record<string, string | null> = {};
    for (const { column_name: column } of columns.rows) {
      const sum = await client.query<{ total: string | null }>(`SELECT sum(${quoteIdentifier(column)})::text AS total FROM ${table}`);
      numericTotals[column] = sum.rows[0].total;
    }
    const constraints = await client.query<{ definition: string }>(
      "SELECT conname || ': ' || pg_get_constraintdef(oid, true) AS definition FROM pg_constraint WHERE contype='f' AND conrelid=$1::regclass ORDER BY conname",
      [table]
    );
    evidence[name] = {
      rows: hashes.rows.length,
      digest: digest.digest('hex'),
      numericTotals,
      foreignKeys: constraints.rows.map((constraint) => constraint.definition),
    };
  }
  return evidence;
}

export function captureUploadEvidence(root: string): UploadEvidence {
  const evidence: UploadEvidence = {};
  function walk(directory: string) {
    for (const entry of fs.readdirSync(directory).sort()) {
      const file = path.join(directory, entry);
      const stat = fs.lstatSync(file);
      if (stat.isSymbolicLink()) throw new Error('Upload backup/restore refuses symbolic links');
      if (stat.isDirectory()) walk(file);
      else if (stat.isFile()) {
        evidence[path.relative(root, file).split(path.sep).join('/')] = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
      } else throw new Error('Upload backup/restore refuses non-regular files');
    }
  }
  walk(root);
  return Object.fromEntries(Object.entries(evidence).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
}

export function verifyUploadArchive(archive: string) {
  const entries = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  for (const name of entries.split(/\r?\n/).filter(Boolean)) {
    const normalized = name.replaceAll('\\', '/');
    if (normalized.startsWith('/') || normalized.includes(':') || normalized.split('/').includes('..')) {
      throw new Error('UNSAFE_ARCHIVE_PATH');
    }
  }
  const details = execFileSync('tar', ['-tvzf', archive], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (details.split(/\r?\n/).filter(Boolean).some((line) => !['-', 'd'].includes(line[0]))) {
    throw new Error('UNSAFE_ARCHIVE_ENTRY: Only regular files and directories may be restored');
  }
}
