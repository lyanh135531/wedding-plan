/** Read-only HTTP smoke audit against an already running local application. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { Pool } from 'pg';

const require = createRequire(import.meta.url);
createRequire(require.resolve('next/package.json'))('@next/env').loadEnvConfig(process.cwd());
const baseURL = process.env.AUDIT_BASE_URL || 'http://localhost:3000';
if (!['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)) throw new Error('Audit requires a local server');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const results: Array<{ path: string; authenticated: boolean; status: number; redirect: string | null }> = [];
function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const name = path.join(dir, entry.name);
    return entry.isDirectory() ? files(name) : [name];
  });
}
try {
  const { rows } = await pool.query("SELECT s.token FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.expires_at>now() AND u.role='owner' ORDER BY s.created_at DESC LIMIT 1");
  if (!rows.length) throw new Error('An existing active owner session is required. Sign in first.');
  const token = rows[0].token;
  const signature = crypto.createHmac('sha256', process.env.BETTER_AUTH_SECRET || 'wedding_platform_auth_secret_minimum_32_chars_default').update(token).digest('base64');
  const cookieName = baseURL.startsWith('https:') ? '__Secure-session_token' : 'session_token';
  const cookie = `${cookieName}=${encodeURIComponent(`${token}.${signature}`)}`;
  const pageRoutes = files('src/app').filter((file) => file.endsWith('page.tsx') && !file.includes('['))
    .map((file) => '/' + path.relative('src/app', path.dirname(file)).split(path.sep).filter((part) => !part.startsWith('(')).join('/'));
  const navigation = fs.readFileSync('src/components/layout/DesktopSidebar.tsx', 'utf8');
  const pages = [...new Set([...pageRoutes, ...Array.from(navigation.matchAll(/href: '([^']+)'/g), (match) => match[1])])];
  const apis = files('src/app/api/v1').filter((file) => file.endsWith('route.ts') && !file.includes('[') && /export (?:async )?function GET/.test(fs.readFileSync(file, 'utf8')))
    .map((file) => '/api/v1/' + path.relative('src/app/api/v1', path.dirname(file)).split(path.sep).join('/'));
  for (const target of [...pages.map((url) => ({ url, authenticated: true })), ...apis.flatMap((url) => [{ url, authenticated: true }, { url, authenticated: false }])]) {
    const response = await fetch(baseURL + target.url, {
      headers: target.authenticated ? { cookie } : {}, redirect: 'manual', signal: AbortSignal.timeout(60_000),
    });
    await response.arrayBuffer();
    const result = { path: target.url, authenticated: target.authenticated, status: response.status, redirect: response.headers.get('location') };
    results.push(result);
    if (response.status >= 500 || (!target.authenticated && response.status !== 401) || (!target.url.startsWith('/api/') && response.status >= 400)) console.log(JSON.stringify(result));
  }
  fs.mkdirSync('test-results/audit', { recursive: true });
  fs.writeFileSync('test-results/audit/http-smoke.json', JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));
  const failures = results.filter((result) => result.status >= 500 || (!result.authenticated && result.status !== 401) || (!result.path.startsWith('/api/') && result.status >= 400));
  console.log(JSON.stringify({ requests: results.length, failures: failures.length, report: 'test-results/audit/http-smoke.json' }));
  if (failures.length) process.exitCode = 1;
} finally { await pool.end(); }
