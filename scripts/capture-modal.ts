import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Pool } from 'pg';
import { chromium } from '@playwright/test';

const require = createRequire(import.meta.url);
createRequire(require.resolve('next/package.json'))('@next/env').loadEnvConfig(process.cwd());
const baseURL = 'http://localhost:3000';
const out = 'C:/Users/lylya/.gemini/antigravity-cli/brain/d4a366e8-fc63-451d-b432-3a28718f8b51/screenshots';
await fs.mkdir(out, { recursive: true });

// Sync session token
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
let token: string;
try {
  const { rows } = await pool.query(
    "SELECT s.token FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.expires_at>now() AND u.role='owner' ORDER BY s.created_at DESC LIMIT 1"
  );
  assert.ok(rows.length, 'No owner session found');
  token = rows[0].token;
} finally {
  await pool.end();
}

const signature = crypto
  .createHmac('sha256', process.env.BETTER_AUTH_SECRET || 'wedding_platform_auth_secret_minimum_32_chars_default')
  .update(token)
  .digest('base64');

const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 950 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  await context.addCookies([
    { name: 'session_token', value: encodeURIComponent(`${token}.${signature}`), url: baseURL, httpOnly: true },
    { name: 'better-auth.session_token', value: encodeURIComponent(`${token}.${signature}`), url: baseURL, httpOnly: true },
  ]);

  await page.goto(baseURL + '/guests', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !Array.from(document.querySelectorAll('[role="status"]')).some((e) => /đang tải/i.test(e.textContent || '')));

  // 1. Open Add Guest Modal
  const addGuestBtn = page.locator('button:has-text("Thêm khách mời")').first();
  await addGuestBtn.click();
  await page.waitForSelector('div[role="dialog"]');
  await page.waitForTimeout(300);

  const dialog = page.locator('div[role="dialog"]');
  await dialog.screenshot({ path: path.join(out, 'modal-add-guest-redesigned.png') });
  await page.screenshot({ path: path.join(out, 'page-add-guest-modal.png') });
  console.log('Saved modal-add-guest-redesigned.png');

  // Close Add Guest Modal
  const closeBtn = page.locator('button[aria-label="Đóng hộp thoại"]');
  await closeBtn.click();
  await page.waitForTimeout(200);

  // 2. Open Add Family Modal
  const addFamilyBtn = page.locator('button:has-text("Thêm gia đình")').first();
  if (await addFamilyBtn.isVisible() && !(await addFamilyBtn.isDisabled())) {
    await addFamilyBtn.click();
    await page.waitForSelector('div[role="dialog"]');
    await page.waitForTimeout(300);
    const familyDialog = page.locator('div[role="dialog"]');
    await familyDialog.screenshot({ path: path.join(out, 'modal-add-family-redesigned.png') });
    console.log('Saved modal-add-family-redesigned.png');
  }
} finally {
  await browser.close();
}
