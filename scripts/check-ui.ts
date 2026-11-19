/** Read-only typography/responsive checks against the local development server. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Pool } from 'pg';
import { chromium, webkit } from '@playwright/test';

const require = createRequire(import.meta.url);
createRequire(require.resolve('next/package.json'))('@next/env').loadEnvConfig(process.cwd());
const baseURL = 'http://localhost:3000';
const out = path.resolve('test-results/ui-refresh');
await fs.mkdir(out, { recursive: true });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
let token: string;
try {
  const { rows } = await pool.query("SELECT s.token FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.expires_at>now() AND u.role='owner' ORDER BY s.created_at DESC LIMIT 1");
  assert.ok(rows.length, 'Sign in with an owner account before running UI checks.');
  token = rows[0].token;
} finally { await pool.end(); }
const signature = crypto.createHmac('sha256', process.env.BETTER_AUTH_SECRET || 'wedding_platform_auth_secret_minimum_32_chars_default').update(token).digest('base64');
const routes = ['/overview', '/guests', '/budget', '/payments', '/tasks', '/calendar', '/seating', '/vendors', '/settings', '/documents', '/fund', '/history', '/invitations', '/gifts', '/handovers', '/menus', '/preparation', '/support', '/ideas', '/logistics', '/timeline', '/data/export', '/data/import', '/after-wedding'];
const checks: unknown[] = [];
for (const [name, engine, width, height] of [
  ['desktop', chromium, 1440, 1000], ['tablet', chromium, 768, 1024],
  ['mobile', webkit, 390, 844], ['narrow', chromium, 360, 800],
] as const) {
  const browser = await engine.launch();
  try {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: width < 640, hasTouch: width < 1024 });
    const page = await context.newPage();
    const fontFailures: string[] = [];
    page.on('response', (response) => { if (response.request().resourceType() === 'font' && response.status() >= 400) fontFailures.push(`${response.status()} ${response.url()}`); });
    await page.goto(baseURL + '/login', { waitUntil: 'networkidle' });
    const fonts = await page.evaluate(async () => {
      const sample = 'Đám cưới Nguyễn Trần Phương Linh Ắ ằ ễ ộ ờ ứ ỵ';
      const results: Array<{ font: string; loaded: boolean }> = [];
      for (const font of ['400 16px "Be Vietnam Pro"', '500 16px "Be Vietnam Pro"', '600 16px "Be Vietnam Pro"', '700 16px "Be Vietnam Pro"', '500 36px "Playfair Display"']) {
        const loaded = await document.fonts.load(font, sample);
        results.push({ font, loaded: loaded.length > 0 && document.fonts.check(font, sample) });
      }
      return results;
    });
    assert.ok(fonts.every((font) => font.loaded), `${name}: a declared font failed to load`);
    await page.screenshot({ path: path.join(out, `${name}-login.png`), fullPage: true });
    await context.addCookies([{ name: 'session_token', value: encodeURIComponent(`${token}.${signature}`), url: baseURL, httpOnly: true }]);
    for (const route of routes) {
      const response = await page.goto(baseURL + route, { waitUntil: 'domcontentloaded' });
      assert.ok(response?.ok(), `${name} ${route}: HTTP ${response?.status()}`);
      assert.ok(!page.url().endsWith('/login'), `${name} ${route}: session rejected`);
      await page.waitForFunction(() => !Array.from(document.querySelectorAll('[role="status"]')).some((element) => /đang tải/i.test(element.textContent || '')));
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(async () => {
        await Promise.all(document.getAnimations().filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
          .map((animation) => animation.finished.catch(() => {})));
      });
      const layout = await page.evaluate(() => ({
        width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
        font: getComputedStyle(document.body).fontFamily,
        offenders: Array.from(document.querySelectorAll('main *')).filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.right > innerWidth + 1 && getComputedStyle(element).position !== 'fixed';
        }).slice(0, 5).map((element) => ({ tag: element.tagName, className: element.getAttribute('class')?.slice(0, 120) })),
      }));
      checks.push({ viewport: name, route, fonts, ...layout });
      if (layout.scrollWidth > layout.width + 1) console.log(JSON.stringify({ overflow: true, viewport: name, route, ...layout }));
      if (['/overview', '/guests', '/budget', '/vendors'].includes(route)) await page.screenshot({ path: path.join(out, `${name}-${route.slice(1)}.png`), fullPage: true });
    }
    assert.deepEqual(fontFailures, [], `${name}: font requests must succeed`);
    console.log(`${name}: ${routes.length} pages checked; all five font faces loaded`);
  } finally { await browser.close(); }
}
await fs.writeFile(path.join(out, 'checks.json'), JSON.stringify(checks, null, 2));
assert.ok(checks.every((value) => { const check = value as { scrollWidth: number; width: number }; return check.scrollWidth <= check.width + 1; }), 'Some pages overflow; see checks.json and output above.');
console.log(`PASS: ${checks.length} page/viewport combinations; screenshots in ${out}`);
