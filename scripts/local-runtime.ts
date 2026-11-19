/** Persistent, loopback-only installation. Secrets and backups stay outside Git. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseEnv } from 'node:util';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const runtime = path.join(root, '.local-artifacts/runtime');
const envFile = path.join(runtime, 'compose.env');
const override = path.join(runtime, 'compose.override.yml');
const command = process.argv[2] || 'start';
if (!['start', 'stop', 'status', 'backup'].includes(command)) throw new Error('Use start, stop, status or backup.');
fs.mkdirSync(runtime, { recursive: true });
if (!fs.existsSync(envFile)) {
  if (command !== 'start') throw new Error('Run pnpm local:start first.');
  const source = parseEnv(fs.readFileSync(path.join(root, '.env'), 'utf8'));
  for (const key of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'OWNER_EMAIL_1', 'OWNER_EMAIL_2']) {
    if (!source[key]) throw new Error(`Missing ${key} in .env`);
  }
  const config = {
    DB_NAME: 'wedding', DB_USER: 'wedding_bootstrap', DB_PASSWORD: crypto.randomBytes(32).toString('hex'),
    APP_DB_USER: 'wedding_app', APP_DB_PASSWORD: crypto.randomBytes(32).toString('hex'),
    APP_URL: 'http://localhost:3000', APP_PORT: '3000', BETTER_AUTH_SECRET: crypto.randomBytes(32).toString('hex'),
    GOOGLE_CLIENT_ID: source.GOOGLE_CLIENT_ID!, GOOGLE_CLIENT_SECRET: source.GOOGLE_CLIENT_SECRET!,
    OWNER_EMAIL_1: source.OWNER_EMAIL_1!, OWNER_EMAIL_2: source.OWNER_EMAIL_2!,
  };
  fs.writeFileSync(envFile, Object.entries(config).map(([key, value]) => `${key}='${value.replace(/'/g, "'\\''")}'`).join('\n') + '\n', { mode: 0o600 });
}
const config = parseEnv(fs.readFileSync(envFile, 'utf8')) as Record<string, string>;
// The original template used real Gmail domains for examples. Never authorize them.
const legacyExampleEmails = ['groom.email@gmail.com', 'bride.email@gmail.com'];
for (const index of [1, 2]) {
  const key = `OWNER_EMAIL_${index}`;
  if (legacyExampleEmails.includes(config[key]?.toLowerCase())) {
    config[key] = `unconfigured-owner-${index}@wedding.invalid`;
    fs.writeFileSync(envFile, Object.entries(config).map(([name, value]) => `${name}='${value.replace(/'/g, "'\\''")}'`).join('\n') + '\n', { mode: 0o600 });
    console.log(`Owner ${index} uses a reserved .invalid address until a real email is configured.`);
  }
}
const env = { ...process.env, ...config };
if (process.platform === 'win32') env.PATH = `${process.env.LOCALAPPDATA}/Programs/DockerDesktop/resources/bin;${env.PATH}`;
fs.writeFileSync(override, `services:
  db:
    container_name: wedding-local-db
    volumes: ["local-postgres:/var/lib/postgresql/data"]
  app:
    container_name: wedding-local-app
    ports: !override ["127.0.0.1:3000:3000"]
    volumes: ["local-uploads:/data/uploads"]
volumes:
  local-postgres:
    name: wedding-local-postgres
  local-uploads:
    name: wedding-local-uploads
`);
const args = ['compose', '--project-name', 'wedding-local', '--env-file', envFile, '-f', path.join(root, 'docker-compose.yml'), '-f', override];
function docker(params: string[], options: { inherit?: boolean; extraEnv?: Record<string, string>; output?: string } = {}) {
  const fd = options.output ? fs.openSync(options.output, 'w') : undefined;
  try {
    return execFileSync('docker', params, { cwd: root, env: { ...env, ...options.extraEnv }, windowsHide: true, encoding: 'utf8', timeout: 1800000, maxBuffer: 32 * 1024 * 1024,
      stdio: fd !== undefined ? ['ignore', fd, 'pipe'] : options.inherit ? 'inherit' : 'pipe' });
  } finally { if (fd !== undefined) fs.closeSync(fd); }
}
const compose = (params: string[], inherit = false) => docker([...args, ...params], { inherit });
const sql = (query: string, database = config.DB_NAME) => docker(['exec', 'wedding-local-db', 'psql', '-U', config.DB_USER, '-d', database, '-At', '-v', 'ON_ERROR_STOP=1', '-c', query]).trim();
async function healthy() {
  for (let attempt = 0; attempt < 120; attempt++) {
    try { if ((await fetch(config.APP_URL + '/api/health', { signal: AbortSignal.timeout(2000) })).ok) return; } catch { /* starting */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Local application did not become healthy.');
}
try {
  if (command === 'start') {
    const resolved = JSON.parse(compose(['config', '--format', 'json']));
    for (const service of ['db', 'app']) {
      if (resolved.services[service].volumes.some((mount: { type: string }) => mount.type !== 'volume')) throw new Error('Local installation requires named volumes.');
    }
    compose(['build', 'app', 'migrate'], true);
    compose(['up', '-d', '--wait', '--wait-timeout', '180'], true);
    // Clean only unused legacy placeholder identities created by initial seeding.
    sql(`DELETE FROM users WHERE email IN ('groom.email@gmail.com','bride.email@gmail.com') AND NOT EXISTS (SELECT 1 FROM accounts WHERE accounts.user_id=users.id) AND NOT EXISTS (SELECT 1 FROM sessions WHERE sessions.user_id=users.id)`);
    docker([...args, 'run', '--rm', '--no-deps', '-e', 'DATABASE_URL', '-e', 'SEED_OWNER_EMAIL_1', '-e', 'SEED_OWNER_EMAIL_2', 'migrate', 'pnpm', 'exec', 'tsx', 'scripts/seed-owners.ts'], {
      extraEnv: { DATABASE_URL: `postgresql://${config.DB_USER}:${config.DB_PASSWORD}@db:5432/${config.DB_NAME}?sslmode=disable`, SEED_OWNER_EMAIL_1: config.OWNER_EMAIL_1, SEED_OWNER_EMAIL_2: config.OWNER_EMAIL_2 },
    });
    await healthy();
    console.log('Ready: http://localhost:3000 — persistent database/uploads; two configured owners; no business fixtures seeded.');
  } else if (command === 'stop') {
    compose(['stop', 'app', 'db'], true);
    console.log('Stopped. Database and uploads are preserved.');
  } else if (command === 'status') {
    console.log(compose(['ps']));
    await healthy(); console.log('Healthy: http://localhost:3000');
  } else {
    const backup = path.join(runtime, 'backups', new Date().toISOString().replace(/[:.]/g, '-'));
    fs.mkdirSync(backup, { recursive: true });
    const drill = `wedding_drill_${crypto.randomBytes(8).toString('hex')}`;
    compose(['stop', 'app'], true);
    try {
      docker(['exec', 'wedding-local-db', 'pg_dump', '-U', config.DB_USER, '-d', config.DB_NAME, '-Fc'], { output: path.join(backup, 'database.dump') });
      compose(['run', '--rm', '--no-deps', '-v', 'wedding-local-uploads:/data/uploads:ro', '-v', `${backup}:/backup`, '--entrypoint', 'tar', 'migrate', '-czf', '/backup/uploads.tar.gz', '-C', '/data/uploads', '.']);
      // Restore to a separate database using the server's own PostgreSQL tools.
      sql(`CREATE DATABASE ${drill}`);
      docker(['cp', path.join(backup, 'database.dump'), 'wedding-local-db:/tmp/wedding-local-drill.dump']);
      docker(['exec', 'wedding-local-db', 'pg_restore', '-U', config.DB_USER, '--exit-on-error', '--no-owner', '-d', drill, '/tmp/wedding-local-drill.dump']);
      const counts = `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`;
      const tables = sql(counts).split('\n').filter(Boolean);
      for (const table of tables) {
        const query = `SELECT count(*) FROM "${table.replace(/"/g, '""')}"`;
        if (sql(query) !== sql(query, drill)) throw new Error(`Restore count differs: ${table}`);
      }
      compose(['run', '--rm', '--no-deps', '-v', `${backup}:/backup:ro`, '--entrypoint', 'sh', 'migrate', '-c', 'mkdir /tmp/uploads-drill && tar -xzf /backup/uploads.tar.gz -C /tmp/uploads-drill']);
      const files = ['database.dump', 'uploads.tar.gz'].map(name => ({ name, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(backup, name))).digest('hex') }));
      fs.writeFileSync(path.join(backup, 'manifest.json'), JSON.stringify({ createdAt: new Date().toISOString(), source: 'wedding-local', consistentWriteFence: true, restoredTableCounts: tables.length, uploadsExtractionVerified: true, files }, null, 2));
      console.log(`Backup and isolated restore passed: ${path.relative(root, backup)}`);
    } finally {
      try {
        sql(`DROP DATABASE IF EXISTS ${drill} WITH (FORCE)`);
        docker(['exec', 'wedding-local-db', 'rm', '-f', '/tmp/wedding-local-drill.dump']);
      } finally { compose(['start', 'app'], true); await healthy(); }
    }
  }
} catch (error) {
  // Child-process error messages may contain sensitive seed output; keep it private.
  let detail = String(error);
  for (const value of Object.values(config)) if (value.length > 3) detail = detail.replaceAll(value, '[redacted]');
  fs.writeFileSync(path.join(runtime, 'last-error.log'), detail);
  console.error('Local runtime operation failed. Private details: .local-artifacts/runtime/last-error.log');
  process.exitCode = 1;
}
