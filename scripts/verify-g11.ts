/** Real PostgreSQL + application drill. Never connects to an existing database. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import net from 'node:net';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import { Client } from 'pg';
import assert from 'node:assert/strict';
import { createAtomicBackup } from './backup';
import { executeRestoreDrill } from './restore-drill';

async function freePort() {
  const server = net.createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as net.AddressInfo).port;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'wedding-g11-'));
const data = path.join(sandbox, 'postgres');
const pgPort = await freePort();
const adminUrl = `postgresql://g11_admin@127.0.0.1:${pgPort}/postgres?sslmode=disable`;
const sourceUrl = new URL(adminUrl);
sourceUrl.pathname = '/wedding_g11_source';
const ownerEmails: [string, string] = ['groom@g11.invalid', 'bride@g11.invalid'];
let server: ChildProcess | undefined;
let started = false;
let client: Client | undefined;
let browserTests = 0;
const run = (command: string, args: string[]) => execFileSync(command, args, { encoding: 'utf8', windowsHide: true, timeout: 120_000, stdio: command === 'pg_ctl' ? 'ignore' : 'pipe' });
const reportDir = path.resolve('test-results/g11');
fs.mkdirSync(reportDir, { recursive: true });
const reportPath = path.join(reportDir, 'verification.json');
fs.writeFileSync(reportPath, JSON.stringify({ status: 'running', startedAt: new Date().toISOString() }, null, 2));

try {
  console.log('[G11] Initializing isolated PostgreSQL cluster');
  run('initdb', ['-D', data, '-U', 'g11_admin', '--auth=trust', '--encoding=UTF8', '--locale=C']);
  run('pg_ctl', ['-D', data, '-l', path.join(sandbox, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${pgPort}`, '-w', 'start']);
  started = true;
  client = new Client({ connectionString: adminUrl });
  await client.connect();
  await client.query('CREATE DATABASE wedding_g11_source');
  await client.end();
  client = new Client({ connectionString: sourceUrl.toString() });
  await client.connect();
  for (const file of fs.readdirSync('src/db/migrations').filter((name) => name.endsWith('.sql')).sort()) {
    console.log(`[G11] Applying ${file}`);
    await client.query(fs.readFileSync(path.join('src/db/migrations', file), 'utf8'));
  }
  await client.query(`INSERT INTO users(id,name,email,role) VALUES
    ('g11-owner-1','Groom',$1,'owner'), ('g11-owner-2','Bride',$2,'owner'),
    ('g11-family','Family','family@g11.invalid','family_view')`, ownerEmails);
  await client.query(`INSERT INTO events(id,title,event_type) VALUES ('00000000-0000-4000-8000-000000000011','G11 wedding','other')`);
  await client.query(`INSERT INTO sessions(id,token,user_id,expires_at) VALUES
    ('g11-owner-session','g11-owner-token','g11-owner-1',now()+interval '1 day'),
    ('g11-family-session','g11-family-token','g11-family',now()+interval '1 day')`);
  await client.query(`INSERT INTO member_event_access(user_id,event_id) VALUES ('g11-family','00000000-0000-4000-8000-000000000011')`);
  await client.query(`INSERT INTO member_invites(email,token_hash,invited_by_user_id,expires_at) VALUES
    ('invite@g11.invalid','g11-old-invite','g11-owner-1',now()+interval '1 day')`);
  await client.query(`INSERT INTO accounts(id,account_id,provider_id,user_id,access_token,refresh_token,id_token,password)
    VALUES ('g11-account','g11-provider-account','google','g11-owner-1','old-access','old-refresh','old-id','old-password')`);
  await client.query(`INSERT INTO verifications(id,identifier,value,expires_at)
    VALUES ('g11-verification','g11@example.test','old-verification',now()+interval '1 day')`);
  await client.query(`INSERT INTO gifts(event_id,amount) VALUES ('00000000-0000-4000-8000-000000000011',9007199254740993)`);
  const uploads = path.join(sandbox, 'uploads');
  fs.mkdirSync(path.join(uploads, 'nested'), { recursive: true });
  fs.writeFileSync(path.join(uploads, 'nested', 'ghi-chú.txt'), 'Bàn giao đám cưới — UTF-8');
  fs.writeFileSync(path.join(uploads, 'receipt.bin'), crypto.randomBytes(8192));
  const backupDir = path.join(sandbox, 'backups');
  console.log('[G11] Creating real dump and uploads archive');
  const manifest = await createAtomicBackup({ backupDir, uploadsDir: uploads, dbUrl: sourceUrl.toString() });
  const bundle = path.join(backupDir, manifest.backupId);
  const result = await executeRestoreDrill(bundle, { adminUrl, sandboxRoot: path.join(sandbox, 'restores'), ownerEmails });
  assert.equal(result.verificationMode, 'restored-and-verified');
  assert.equal(result.credentialsSanitized, true);
  const restoredUrl = new URL(adminUrl);
  restoredUrl.pathname = '/' + result.sandboxDatabase;
  const restored = new Client({ connectionString: restoredUrl.toString() });
  await restored.connect();
  try {
    for (const table of ['sessions', 'member_invites', 'member_event_access', 'verifications']) {
      assert.equal((await restored.query(`SELECT count(*)::int AS count FROM ${table}`)).rows[0].count, 0);
    }
    const credentials = (await restored.query('SELECT access_token,refresh_token,id_token,password FROM accounts')).rows[0];
    assert.deepEqual(credentials, { access_token: null, refresh_token: null, id_token: null, password: null });
    assert.equal((await restored.query('SELECT sum(amount)::text AS total FROM gifts')).rows[0].total, '9007199254740993');
  } finally { await restored.end(); }
  assert.equal((await client.query('SELECT count(*)::int AS count FROM sessions')).rows[0].count, 2, 'Source sessions must remain untouched');
  // Tampering must fail before creating a restore target.
  fs.appendFileSync(path.join(bundle, 'database.dump'), 'tamper');
  await assert.rejects(executeRestoreDrill(bundle, { adminUrl, sandboxRoot: path.join(sandbox, 'restores'), ownerEmails }), /CHECKSUM_MISMATCH/);
  console.log('[G11] Real restore, reconciliation, credential sanitization and tamper rejection PASS');

  if (!process.argv.includes('--dr-only')) {
    await client.query('CREATE ROLE g11_app LOGIN NOSUPERUSER NOBYPASSRLS');
    await client.query('GRANT USAGE ON SCHEMA public TO g11_app');
    await client.query('GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO g11_app');
    await client.query('GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO g11_app');
    const appUrl = new URL(sourceUrl);
    appUrl.username = 'g11_app';
    const restricted = new Client({ connectionString: appUrl.toString() });
    await restricted.connect();
    try {
      const privileges = await restricted.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user');
      assert.equal(privileges.rows[0].rolsuper, false);
      assert.equal(privileges.rows[0].rolbypassrls, false);
      await restricted.query('BEGIN');
      await restricted.query("SELECT set_config('app.current_role','family_view',true),set_config('app.current_user_id','g11-family',true)");
      assert.equal((await restricted.query('SELECT count(*)::int AS count FROM gifts')).rows[0].count, 0);
      await assert.rejects(restricted.query("INSERT INTO vendors(name,service_type) VALUES('Forbidden RLS write','other')"), { code: '42501' });
      await restricted.query('ROLLBACK');
      await restricted.query('BEGIN');
      await restricted.query("SELECT set_config('app.current_role','owner',true),set_config('app.current_user_id','g11-owner-1',true)");
      assert.equal((await restricted.query('SELECT amount::text FROM gifts')).rows[0].amount, '9007199254740993');
      await restricted.query('COMMIT');
      console.log('[G11] PostgreSQL RLS with NOSUPERUSER/NOBYPASSRLS account PASS');
    } finally { await restricted.end(); }
    const appPort = await freePort();
    const baseURL = `http://127.0.0.1:${appPort}`;
    const require = createRequire(import.meta.url);
    const nextCli = require.resolve('next/dist/bin/next');
    const env: NodeJS.ProcessEnv = { ...process.env, DATABASE_URL: appUrl.toString(), BETTER_AUTH_SECRET: crypto.randomBytes(32).toString('hex'), BETTER_AUTH_URL: baseURL, APP_URL: baseURL, UPLOAD_DIR: uploads, NODE_ENV: 'production' };
    const serverLog = fs.openSync(path.join(sandbox, 'next.log'), 'a');
    server = spawn(process.execPath, [nextCli, 'start', '-H', '127.0.0.1', '-p', String(appPort)], { env, stdio: ['ignore', serverLog, serverLog], windowsHide: true });
    fs.closeSync(serverLog);
    for (let attempt = 0; ; attempt++) {
      try { if ((await fetch(baseURL + '/login')).ok) break; } catch { /* wait for startup */ }
      if (attempt >= 60 || server?.exitCode !== null) throw new Error(`Application did not start; inspect ${path.join(sandbox, 'next.log')}`);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    console.log('[G11] Running hydrated browser journeys against real PostgreSQL');
    execFileSync(process.execPath, [require.resolve('@playwright/test/cli'), 'test', '--config=playwright.live.config.ts'], {
      env: { ...process.env, BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET, PLAYWRIGHT_BASE_URL: baseURL, G11_DB_URL: sourceUrl.toString() },
      stdio: 'inherit', windowsHide: true, timeout: 600_000,
    });
    const liveReport = JSON.parse(fs.readFileSync(path.join(reportDir, 'live-results.json'), 'utf8'));
    assert.equal(liveReport.stats.unexpected, 0);
    assert.equal(liveReport.stats.skipped, 0);
    browserTests = liveReport.stats.expected;
    assert.ok(browserTests > 0);

  }
  fs.writeFileSync(reportPath, JSON.stringify({ status: 'passed', browserTests, verifiedAt: new Date().toISOString(), postgresVersion: run('pg_restore', ['--version']).trim(), restore: result, tablesVerified: Object.keys(manifest.databaseEvidence || {}).length, foreignKeysVerified: Object.values(manifest.databaseEvidence || {}).reduce((total, table) => total + table.foreignKeys.length, 0), sourceUnchanged: true, tamperRejected: true, browserJourneys: !process.argv.includes('--dr-only') }, null, 2));
} catch (error) {
  fs.writeFileSync(reportPath, JSON.stringify({ status: 'failed', verifiedAt: new Date().toISOString(), sandboxArtifacts: sandbox }, null, 2));
  throw error;
} finally {
  try {
    if (server?.pid && server.exitCode === null) {
      if (process.platform === 'win32') run('taskkill', ['/PID', String(server.pid), '/T', '/F']);
      else server.kill('SIGTERM');
    }
  } finally {
    if (client) await client.end().catch(() => {});
    if (started) run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop']);
    console.log(`[G11] Isolated artifacts: ${sandbox}`);
  }
}
