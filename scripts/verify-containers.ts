/** Isolated Compose release drill. Never uses the repository .env or host data mounts. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { Client } from 'pg';

async function freePort() {
  const server = net.createServer();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as net.AddressInfo).port;
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'wedding-containers-'));
const project = `wedding-verify-${crypto.randomUUID().slice(0, 8)}`;
const pgPort = await freePort(); const appPort = await freePort();
const baseURL = `http://127.0.0.1:${appPort}`;
const dbPassword = crypto.randomBytes(32).toString('hex');
const authSecret = crypto.randomBytes(32).toString('hex');
const envFile = path.join(sandbox, 'compose.env'); const overrideFile = path.join(sandbox, 'compose.override.yml');
const reportDir = path.resolve('test-results/containers'); fs.mkdirSync(reportDir, { recursive: true });
const isolatedEnv = {
  DB_NAME: 'wedding_g11_source', DB_USER: 'g11_admin', DB_PASSWORD: dbPassword,
  APP_DB_USER: 'g11_app', APP_DB_PASSWORD: crypto.randomBytes(32).toString('hex'),
  APP_URL: baseURL, APP_PORT: String(appPort), BETTER_AUTH_SECRET: authSecret,
  GOOGLE_CLIENT_ID: 'isolated-container-test', GOOGLE_CLIENT_SECRET: 'isolated-container-test',
  OWNER_EMAIL_1: 'groom@g11.invalid', OWNER_EMAIL_2: 'bride@g11.invalid',
};
fs.writeFileSync(envFile, Object.entries(isolatedEnv).map(([key, value]) => `${key}=${value}`).join('\n'));
fs.writeFileSync(overrideFile, `services:
  db:
    container_name: ${project}-db
    ports: ["127.0.0.1:${pgPort}:5432"]
    volumes: ["verify-postgres:/var/lib/postgresql/data"]
  app:
    container_name: ${project}-app
    ports: !override ["127.0.0.1:${appPort}:3000"]
    volumes: ["verify-uploads:/data/uploads"]
volumes:
  verify-postgres:
  verify-uploads:
`);
const composeArgs = ['compose', '--project-name', project, '--env-file', envFile, '-f', path.resolve('docker-compose.yml'), '-f', overrideFile];
const compose = (args: string[], inherit = false, timeout = 120000) => execFileSync('docker', [...composeArgs, ...args], { env: { ...process.env, ...isolatedEnv }, encoding: 'utf8', windowsHide: true, stdio: inherit ? 'inherit' : 'pipe', timeout, maxBuffer: 16 * 1024 * 1024 });
const dbUrl = `postgresql://g11_admin:${dbPassword}@127.0.0.1:${pgPort}/wedding_g11_source?sslmode=disable`;
const db = new Client({ connectionString: dbUrl });
let connected = false; let started = false;
async function healthy() {
  for (let attempt = 0; attempt < 120; attempt++) {
    try { if ((await fetch(baseURL + '/api/health', { signal: AbortSignal.timeout(2000) })).ok) return; } catch { /* starting */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Container application did not become healthy.');
}
try {
  const config = JSON.parse(compose(['config', '--format', 'json']));
  for (const service of ['db', 'app']) {
    assert.equal(config.services[service].container_name, `${project}-${service}`);
    assert.ok(config.services[service].volumes.every((mount: { type: string }) => mount.type === 'volume'), 'Test must use fresh named volumes, never /srv or user data');
  }
  assert.equal(config.services.app.ports.length, 1);
  assert.equal(Number(config.services.app.ports[0].published), appPort);
  console.log('[Containers] Validated isolated Compose configuration');
  compose(['build', 'app', 'migrate'], true, 1800000);
  started = true; compose(['up', '-d', '--wait', '--wait-timeout', '180'], true, 240000);
  await healthy(); await db.connect(); connected = true;
  assert.equal((await db.query('SHOW server_version_num')).rows[0].server_version_num.slice(0, 2), '16');
  assert.equal(execFileSync('docker', ['exec', `${project}-app`, 'id', '-u'], { encoding: 'utf8', windowsHide: true }).trim(), '1001');
  await db.query(`INSERT INTO users(id,name,email,role) VALUES ('g11-owner-1','Groom','groom@g11.invalid','owner'),('g11-owner-2','Bride','bride@g11.invalid','owner'),('g11-family','Family','family@g11.invalid','family_view')`);
  await db.query(`INSERT INTO events(id,title,event_type) VALUES ('00000000-0000-4000-8000-000000000011','G11 wedding','other')`);
  await db.query(`INSERT INTO member_event_access(user_id,event_id) VALUES ('g11-family','00000000-0000-4000-8000-000000000011')`);
  const require = createRequire(import.meta.url);
  execFileSync(process.execPath, [require.resolve('tsx/cli'), 'scripts/verify-auth-adapter.ts'], { env: { ...process.env, DATABASE_URL: `postgresql://g11_app:${isolatedEnv.APP_DB_PASSWORD}@127.0.0.1:${pgPort}/wedding_g11_source?sslmode=disable`, G11_DB_URL: dbUrl, BETTER_AUTH_SECRET: authSecret, GOOGLE_CLIENT_ID: 'isolated-container-test', GOOGLE_CLIENT_SECRET: 'isolated-container-test' }, stdio: 'inherit', windowsHide: true, timeout: 120000 });
  execFileSync(process.execPath, [require.resolve('@playwright/test/cli'), 'test', '--config=playwright.live.config.ts'], {
    env: { ...process.env, PLAYWRIGHT_BASE_URL: baseURL, G11_DB_URL: dbUrl, BETTER_AUTH_SECRET: authSecret },
    stdio: 'inherit', windowsHide: true, timeout: 600000,
  });
  const live = JSON.parse(fs.readFileSync('test-results/g11/live-results.json', 'utf8'));
  assert.equal(live.stats.unexpected, 0); assert.equal(live.stats.skipped, 0); assert.ok(live.stats.expected > 0);
  const token = crypto.randomUUID(); await db.query("INSERT INTO sessions(id,token,user_id,expires_at) VALUES($1,$1,'g11-owner-1',now()+interval '1 hour')", [token]);
  const sig = crypto.createHmac('sha256', authSecret).update(token).digest('base64');
  const headers = { Cookie: `session_token=${encodeURIComponent(`${token}.${sig}`)}` };
  const file = (await db.query("SELECT id FROM attachments WHERE processing_status='ready' LIMIT 1")).rows[0]; assert.ok(file);
  const checksum = async () => { const response = await fetch(`${baseURL}/api/files/${file.id}`, { headers }); assert.equal(response.status, 200); return crypto.createHash('sha256').update(new Uint8Array(await response.arrayBuffer())).digest('hex'); };
  const before = await checksum(); await db.end(); connected = false;
  compose(['restart', 'db', 'app'], true); await healthy(); assert.equal(await checksum(), before);
  const report = { status: 'passed', verifiedAt: new Date().toISOString(), browserTests: live.stats.expected, postgresMajor: 16, nonRootUid: 1001, isolatedNamedVolumes: true, migrationBeforeApp: true, restartPreservesDatabaseAndUploads: true };
  fs.writeFileSync(path.join(reportDir, 'verification.json'), JSON.stringify(report, null, 2));
  fs.copyFileSync('test-results/g11/live-results.json', path.join(reportDir, 'live-results.json'));
  console.log('[Containers] Build, migrations, live journeys and persisted restart PASS');
} catch (error) {
  fs.writeFileSync(path.join(reportDir, 'verification.json'), JSON.stringify({ status: 'failed', verifiedAt: new Date().toISOString(), sandboxArtifacts: sandbox }, null, 2));
  throw error;
} finally {
  if (connected) await db.end().catch(() => {});
  if (started) { try { fs.writeFileSync(path.join(sandbox, 'compose.log'), compose(['logs', '--no-color'])); } catch { /* retain original failure */ } compose(['down', '--volumes', '--remove-orphans'], true); }
  console.log(`[Containers] Isolated artifacts: ${sandbox}`);
}
