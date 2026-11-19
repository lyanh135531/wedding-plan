import { test, expect, type BrowserContext } from '@playwright/test';
import { Client } from 'pg';
import crypto from 'node:crypto';
import sharp from 'sharp';
import fs from 'node:fs/promises';

// Only the verification harness may select this disposable database.
if (!process.env.G11_DB_URL || new URL(process.env.G11_DB_URL).pathname !== '/wedding_g11_source') {
  throw new Error('Run pnpm exec tsx scripts/verify-g11.ts to provision the isolated live test environment');
}
let db: Client;
test.beforeAll(async () => {
  db = new Client({ connectionString: process.env.G11_DB_URL });
  await db.connect();
});
test.afterAll(async () => { await db.end(); });

async function useSession(context: BrowserContext, role: 'owner' | 'family') {
  const token = crypto.randomUUID();
  await db.query('INSERT INTO sessions(id,token,user_id,expires_at) VALUES($1,$1,$2,now()+interval \'1 hour\')', [token, role === 'owner' ? 'g11-owner-1' : 'g11-family']);
  const signature = crypto.createHmac('sha256', process.env.BETTER_AUTH_SECRET!).update(token).digest('base64');
  await context.addCookies([{ name: 'session_token', value: encodeURIComponent(`${token}.${signature}`), url: process.env.PLAYWRIGHT_BASE_URL!, httpOnly: true }]);
  return token;
}

test('anonymous dashboard navigation requires authentication', async ({ page }) => {
  await page.goto('/vendors');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('button', { name: /Thêm nhà cung cấp/i })).toHaveCount(0);
});

test('setup persists without example data, retries failures and prevents duplicate initialization', async ({ page, context, browser }) => {
  await db.query('DELETE FROM wedding_settings');
  await useSession(context, 'owner');
  await page.goto('/setup');
  await expect(page.getByLabel('Họ và tên Chú rể', { exact: false })).toHaveValue('');
  await page.getByLabel('Họ và tên Chú rể', { exact: false }).fill('Chú rể kiểm thử');
  await page.getByLabel('Họ và tên Cô dâu', { exact: false }).fill('Cô dâu kiểm thử');
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  await page.getByLabel('Ghi chú thời gian dự kiến').fill('Chưa chốt ngày kiểm thử');
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  await page.route('**/api/v1/settings', async (route) => {
    if (route.request().method() === 'POST') await route.fulfill({ status: 500, json: { error: 'Lỗi thử nghiệm lưu thiết lập' } });
    else await route.continue();
  });
  await page.getByRole('button', { name: 'Hoàn tất thiết lập', exact: true }).click();
  await expect(page.getByText('Lỗi thử nghiệm lưu thiết lập')).toBeVisible();
  await expect(page).toHaveURL(/\/setup$/);
  await page.unroute('**/api/v1/settings');
  await page.getByRole('button', { name: 'Hoàn tất thiết lập', exact: true }).click();
  await expect(page).toHaveURL(/\/overview$/);
  await expect(page.getByRole('heading', { name: 'Chú rể kiểm thử & Cô dâu kiểm thử', exact: true })).toBeVisible();
  const settings = (await db.query('SELECT * FROM wedding_settings')).rows;
  expect(settings).toHaveLength(1);
  expect(settings[0].is_date_confirmed).toBe(false);
  const event = (await db.query('SELECT start_time FROM events WHERE id=$1', [settings[0].representative_event_id])).rows[0];
  expect(event.start_time).toBeNull();
  const before = (await db.query('SELECT count(*)::int AS count FROM events')).rows[0].count;
  const duplicatePayload = { groomName: 'Duplicate', brideName: 'Duplicate', weddingDate: null, isUnconfirmedDate: true, estimatedDateNote: 'Later', categories: [] };
  const duplicates = await Promise.all([1, 2].map(() => context.request.post('/api/v1/settings', { data: duplicatePayload })));
  expect(duplicates.map((response) => response.status())).toEqual([200, 200]);
  expect((await db.query('SELECT count(*)::int AS count FROM events')).rows[0].count).toBe(before);
  await page.goto('/setup');
  await expect(page).toHaveURL(/\/overview$/);
  await page.goto('/settings');
  const title = `Tên cưới ${crypto.randomUUID().slice(0, 8)}`;
  await page.getByLabel('Tên hiển thị đám cưới').fill(title);
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByText('Đã lưu cài đặt.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Tên hiển thị đám cưới')).toHaveValue(title);
  const stale = await context.request.patch('/api/v1/settings', { data: { shortTitle: 'Stale', version: settings[0].version } });
  expect(stale.status()).toBe(409);
  const family = await browser.newContext();
  try {
    await useSession(family, 'family');
    expect((await family.request.patch('/api/v1/settings', { data: { shortTitle: 'Forbidden', version: 2 } })).status()).toBe(403);
    const publicData = (await (await family.request.get('/api/v1/settings')).json()).data;
    expect(publicData).not.toHaveProperty('budgetTarget');
  } finally { await family.close(); }
});

test('tasks, event filters, family DTOs, documents and CSV exports use persistent data', async ({ page, context, browser }) => {
  test.setTimeout(90_000);
  await useSession(context, 'owner');
  const title = `Việc thật ${crypto.randomUUID().slice(0, 8)}`;
  await page.goto('/tasks');
  await page.getByRole('button', { name: 'Thêm công việc', exact: true }).click();
  await page.getByLabel('Tiêu đề công việc', { exact: false }).fill(title);
  await page.getByLabel('Buổi lễ liên quan').selectOption('00000000-0000-4000-8000-000000000011');
  await page.getByLabel('Tính hạn theo ngày buổi lễ').check();
  await page.getByLabel('Chia sẻ công việc này với người nhà').check();
  await page.getByRole('button', { name: 'Lưu công việc', exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  const select = page.locator('select:visible').filter({ has: page.locator('option[value="common"]') }).first();
  await select.selectOption('common');
  await expect(page.getByRole('heading', { name: title, exact: true })).toHaveCount(0);
  await select.selectOption('all');
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await page.getByLabel(`Trạng thái ${title}`).selectOption('completed');
  await expect.poll(async () => (await db.query('SELECT status FROM tasks WHERE title=$1', [title])).rows[0]?.status).toBe('completed');
  await page.reload();
  await expect(page.getByLabel(`Trạng thái ${title}`)).toHaveValue('completed');

  const family = await browser.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL });
  let fileId: string;
  try {
    await useSession(family, 'family');
    const tasks = await family.request.get('/api/v1/tasks');
    expect(tasks.status()).toBe(200);
    const publicTask = (await tasks.json()).data.find((task: { title: string }) => task.title === title);
    expect(publicTask).toBeTruthy();
    expect(publicTask).not.toHaveProperty('privateNotes');
    expect(publicTask).not.toHaveProperty('inChargeUserId');
    const detail = await family.request.get(`/api/v1/tasks/${publicTask.id}`);
    expect(detail.status()).toBe(200);

    await page.goto('/documents');
    const name = `Ảnh kiểm thử ${crypto.randomUUID().slice(0, 8)}.png`;
    const image = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#aa7755' } }).png().toBuffer();
    const upload = page.waitForResponse((response) => response.url().endsWith('/api/upload') && response.request().method() === 'POST');
    await page.getByLabel('Tải tài liệu hoặc ảnh lên').setInputFiles({ name, mimeType: 'image/png', buffer: image });
    const uploaded = await upload;
    expect(uploaded.status()).toBe(201);
    fileId = (await uploaded.json()).id;
    await expect(page.getByRole('link', { name, exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('link', { name, exact: true })).toBeVisible();
    expect((await context.request.get(`/api/files/${fileId}`)).status()).toBe(200);
    expect((await family.request.get(`/api/files/${fileId}?variant=preview`)).status()).toBe(404);
    const documents = (await (await family.request.get('/api/v1/documents')).json()).data;
    expect(documents.some((file: { id: string }) => file.id === fileId)).toBe(false);
    expect((await family.request.get('/api/v1/history')).status()).toBe(403);
  } finally { await family.close(); }
  await page.goto('/history');
  await expect(page.getByRole('heading', { name: 'Nhật ký hoạt động', exact: true })).toBeVisible();
  await expect(page.locator('main').getByText('CREATE • tasks', { exact: true }).first()).toBeVisible();
  await page.goto('/data/export');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Tải CSV an toàn', exact: true }).click();
  const csv = await download;
  expect(csv.suggestedFilename()).toBe('danh-sach-khach-moi.csv');
  const csvContent = await fs.readFile((await csv.path())!, 'utf8');
  expect(csvContent).toContain('Họ và tên');
  await page.goto('/calendar');
  await expect(page.getByLabel('Từ ngày')).toHaveValue(/\d{4}-\d{2}-\d{2}/);
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.goto('/fund');
  await page.getByLabel('Số dư ban đầu (VND)', { exact: false }).fill('0');
  await page.getByLabel('Thời điểm mở sổ (giờ Việt Nam)', { exact: false }).fill('2026-11-19T08:00');
  await page.getByLabel('Đã đối chiếu số dư và phạm vi quỹ').check();
  const saveFund = page.waitForResponse((response) => response.url().endsWith('/api/v1/finance/fund-settings') && response.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Lưu mốc mở sổ' }).click();
  expect((await saveFund).status()).toBe(200);
  await page.reload();
  await expect(page.getByLabel('Số dư ban đầu (VND)', { exact: false })).toHaveValue('0');
  const fund = (await (await context.request.get('/api/v1/finance/fund-settings')).json()).data;
  const updateFund = { initial_balance: '0', opening_as_of: fund.openingAsOf, fund_scope_confirmed: true, version: fund.version };
  expect((await context.request.put('/api/v1/finance/fund-settings', { data: updateFund })).status()).toBe(200);
  expect((await context.request.put('/api/v1/finance/fund-settings', { data: updateFund })).status()).toBe(409);
});

test('unfinished screens clearly identify previews and cannot claim successful writes', async ({ page, context }) => {
  await useSession(context, 'owner');
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  for (const route of ['/menus', '/logistics', '/ideas', '/support', '/preparation', '/timeline', '/after-wedding', '/data/import']) {
    await page.goto(route);
    await expect(page.getByText('Tính năng đang hoàn thiện', { exact: true })).toBeVisible();
    const preview = page.getByRole('group', { name: 'Bản xem trước, chưa hỗ trợ lưu dữ liệu' });
    expect(await preview.locator(':scope > div').evaluate((element) => (element as HTMLElement).inert)).toBe(true);
  }
  expect(runtimeErrors).toEqual([]);
});

test('offline form retains input, sends no writes, then persists exactly once after reconnect', async ({ page, context }) => {
  await useSession(context, 'owner');
  await page.goto('/vendors');
  await expect(page.getByRole('region', { name: 'Bảng điều khiển Prototype Testing' })).toHaveCount(0);
  expect(await page.getByRole('button', { name: 'Thêm nhà cung cấp', exact: true }).evaluate((button) => getComputedStyle(button).minHeight)).toBe('44px');
  await page.getByRole('button', { name: 'Thêm nhà cung cấp', exact: true }).click();
  const name = `G11 live ${crypto.randomUUID()}`;
  const input = page.getByLabel(/^Tên nhà cung cấp/);
  await input.fill(name);
  let writes = 0;
  page.on('request', (request) => { if (request.method() === 'POST' && request.url().endsWith('/api/v1/vendors')) writes++; });
  await context.setOffline(true);
  await expect(page.getByTestId('offline-banner')).toBeVisible();
  await page.getByRole('button', { name: 'Thêm đối tác', exact: true }).click();
  await expect(input).toHaveValue(name);
  const error = await page.evaluate(async () => {
    try { await fetch('/api/v1/vendors', { method: 'POST', body: '{}' }); return ''; }
    catch (failure) { return (failure as Error).message; }
  });
  expect(error).toContain('Đang mất mạng');
  expect(writes).toBe(0);
  expect((await db.query('SELECT count(*)::int AS count FROM vendors WHERE name=$1', [name])).rows[0].count).toBe(0);
  await context.setOffline(false);
  await expect(page.getByTestId('offline-banner')).toHaveCount(0);
  await expect(input).toHaveValue(name);
  const response = page.waitForResponse((res) => res.url().endsWith('/api/v1/vendors') && res.request().method() === 'POST');
  await page.getByRole('button', { name: 'Thêm đối tác', exact: true }).click();
  expect((await response).status()).toBe(201);
  expect(writes).toBe(1);
  expect((await db.query('SELECT count(*)::int AS count FROM vendors WHERE name=$1', [name])).rows[0].count).toBe(1);
  await page.reload();
  await expect(page.getByRole('link', { name, exact: true })).toBeVisible();
});

test('family role hides owner actions, forbids writes and revokes sessions immediately', async ({ page, context }) => {
  const token = await useSession(context, 'family');
  await page.goto('/overview');
  await page.goto('/guests');
  await expect(page.locator('select option[value="00000000-0000-4000-8000-000000000011"]').first()).toHaveCount(1);
  await expect(page.getByTitle('Chuyển vai trò giả lập (Dev Test)')).toHaveCount(0);
  await page.goto('/vendors');
  await expect(page.getByText('Chế độ Người nhà (Chỉ xem)', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Thêm nhà cung cấp', exact: true })).toHaveCount(0);
  const forbidden = await context.request.post('/api/v1/vendors', { data: { name: 'Forbidden', service_type: 'other' } });
  expect(forbidden.status()).toBe(403);
  await db.query('DELETE FROM sessions WHERE token=$1', [token]);
  expect((await context.request.get('/api/v1/vendors')).status()).toBe(401);
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
});

test('guest RSVP, seating, finance and immutable handover persist across reloads', async ({ page, context, browser }) => {
  test.setTimeout(90_000);
  await useSession(context, 'owner');
  const unique = crypto.randomUUID().slice(0, 8);
  const guestName = `Khách live ${unique}`;
  await page.goto('/guests');
  await page.getByRole('button', { name: 'Thêm khách mời', exact: true }).click();
  const guestDialog = page.getByRole('dialog');
  await guestDialog.getByLabel(/^Họ và tên khách mời/).fill(guestName);
  await guestDialog.getByLabel('Số điện thoại', { exact: true }).fill('0912345678');
  await guestDialog.getByPlaceholder('Lưu ý về sở thích, chỗ ngồi VIP, thói quen ăn uống...').fill('Private note ' + unique);
  await guestDialog.getByRole('button', { name: 'Thêm khách mời', exact: true }).click();
  await expect(guestDialog).toHaveCount(0);
  const guest = (await db.query('SELECT id FROM guests WHERE display_name=$1', [guestName])).rows[0];
  expect(guest).toBeTruthy();
  const guestCard = page.getByTestId(`guest-${guest.id}`);
  await guestCard.getByRole('button', { name: 'Mời dự buổi', exact: true }).click();
  await guestCard.getByRole('button', { name: 'Cập nhật RSVP', exact: true }).click();
  const rsvp = page.getByRole('dialog');
  await rsvp.getByRole('button', { name: 'Tham dự', exact: true }).click();
  await rsvp.getByRole('button', { name: /Lưu/ }).click();
  await expect(rsvp).toHaveCount(0);
  await page.reload();
  await expect(guestCard.getByText('Sẽ tham dự', { exact: true })).toBeVisible();

  const tableName = `Bàn live ${unique}`;
  await page.goto('/seating');
  await page.getByRole('button', { name: 'Thêm bàn tiệc', exact: true }).click();
  await page.getByLabel('Tên bàn tiệc *', { exact: true }).fill(tableName);
  await page.getByRole('button', { name: 'Tạo bàn', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const table = (await db.query('SELECT id FROM tables WHERE name=$1', [tableName])).rows[0];
  await page.getByRole('button', { name: guestName, exact: true }).click();
  await page.getByTestId(`table-card-${table.id}`).getByRole('button', { name: /Xếp vào bàn này/ }).click();
  await expect.poll(async () => (await db.query('SELECT count(*)::int AS count FROM seat_assignments WHERE guest_id=$1 AND table_id=$2', [guest.id, table.id])).rows[0].count).toBe(1);
  await page.reload();
  await expect(page.getByTestId(`table-card-${table.id}`).getByText(guestName, { exact: true })).toBeVisible();

  await page.goto('/budget');
  await page.getByRole('button', { name: 'Thêm danh mục', exact: true }).click();
  await page.getByLabel(/^Tên\ danh\ mục/).fill(`Danh mục ${unique}`);
  await page.getByRole('dialog').getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Thêm khoản chi', exact: true }).click();
  await page.getByLabel(/^Tên\ khoản\ chi/).fill(`Khoản chi ${unique}`);
  await page.getByLabel(/^Danh\ mục\ chi\ tiêu/).selectOption({ label: `Danh mục ${unique}` });
  await page.getByLabel(/^Số\ tiền\ \(VND\)/).fill('9007199254740993');
  await page.getByRole('dialog').getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const cost = (await db.query('SELECT id FROM cost_items WHERE name=$1', [`Khoản chi ${unique}`])).rows[0];
  await page.goto('/payments');
  await page.getByRole('button', { name: 'Ghi nhận chi tiền', exact: true }).click();
  await page.getByLabel(/^Khoản\ chi\ liên\ kết/).selectOption(cost.id);
  await page.getByLabel(/^Số\ tiền\ \(VND\)/).fill('9007199254740993');
  await page.getByRole('dialog').getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const payment = (await db.query('SELECT id,amount::text FROM payments WHERE cost_item_id=$1 AND payment_type=\'outflow\'', [cost.id])).rows[0];
  expect(payment.amount).toBe('9007199254740993');
  const paymentCard = page.getByTestId(`payment-${payment.id}`);
  await paymentCard.getByRole('button', { name: 'Hoàn tiền', exact: true }).click();
  await page.getByLabel(/^Số\ tiền\ \(VND\)/).fill('1000');
  await page.getByLabel(/^Lý\ do/).fill('Hoàn một phần');
  await page.getByRole('dialog').getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  expect((await db.query('SELECT sum(CASE WHEN payment_type=\'outflow\' THEN amount ELSE -amount END)::text AS net FROM payments WHERE cost_item_id=$1 AND NOT is_voided', [cost.id])).rows[0].net).toBe('9007199254739993');
  const audit = (await db.query("SELECT after_state FROM audit_logs WHERE entity_id=$1 AND entity_type='payments' ORDER BY created_at LIMIT 1", [payment.id])).rows[0];
  expect(JSON.stringify(audit)).toContain('9007199254740993');

  const privateTitle = `Private timeline ${unique}`;
  const scheduled = new Date().toISOString();
  for (const [title, shared] of [[privateTitle, false], [`Public timeline ${unique}`, true]] as const) {
    const created = await context.request.post('/api/v1/timeline', { data: {
      eventId: '00000000-0000-4000-8000-000000000011', title, scheduledStartTime: scheduled, scheduledEndTime: scheduled, isShared: shared,
    } });
    expect(created.status()).toBe(201);
  }
  await page.goto('/handovers');
  await page.getByRole('button', { name: /Chốt bản bàn giao/i }).click();
  const title = `Bàn giao ${unique}`;
  await page.getByLabel('Tên bản chốt *', { exact: true }).fill(title);
  await page.getByLabel('Chia sẻ bản chốt với người nhà').check();
  await page.getByRole('button', { name: 'Tạo bản chốt', exact: true }).click();
  await expect.poll(async () => (await db.query('SELECT id FROM handover_packets WHERE title=$1', [title])).rows.length).toBe(1);
  const savedSnapshot = (await db.query('SELECT id,snapshot_data FROM handover_packets WHERE title=$1', [title])).rows[0];
  const frozenSeats = savedSnapshot.snapshot_data.seating.assignedSeatsCount;
  const family = await browser.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL });
  try {
    await useSession(family, 'family');
    const people = await family.request.get('/api/v1/guests');
    const publicGuest = (await people.json()).data.find((person: { id: string }) => person.id === guest.id);
    expect(publicGuest).toBeTruthy();
    expect(publicGuest).not.toHaveProperty('phone');
    expect(publicGuest).not.toHaveProperty('private_notes');
    expect((await family.request.get('/api/v1/finance/payments')).status()).toBe(403);
    const shared = await family.request.get('/api/v1/handovers/snapshots?eventId=00000000-0000-4000-8000-000000000011');
    expect(shared.status()).toBe(200);
    const sharedSnapshot = (await shared.json()).data.find((snapshot: { id: string }) => snapshot.id === savedSnapshot.id);
    expect(sharedSnapshot).toBeTruthy();
    expect(JSON.stringify(sharedSnapshot)).not.toContain(privateTitle);
    expect(JSON.stringify(sharedSnapshot)).toContain(`Public timeline ${unique}`);
    const diff = await family.request.get(`/api/v1/handovers/snapshots/${savedSnapshot.id}/diff`);
    expect(diff.status()).toBe(200);
    expect((await diff.json()).data.hasChanges).toBe(false);
  } finally { await family.close(); }

  await page.reload();
  await expect(page.getByText(new RegExp(`Đang xem bản chốt v[0-9]+: ${title}`))).toBeVisible();
  await page.getByRole('button', { name: 'Ghi nhận bàn giao', exact: true }).click();
  await page.getByLabel('Người / Đơn vị nhận bàn giao *', { exact: true }).fill(`Quản lý ${unique}`);
  await page.getByRole('button', { name: 'Xác nhận đã bàn giao', exact: true }).click();
  await expect.poll(async () => (await db.query('SELECT handover_status FROM handover_packets WHERE id=$1', [savedSnapshot.id])).rows[0].handover_status).toBe('handed_over');

  // Same row count but changed placement must invalidate the old snapshot.
  const rename = await context.request.patch(`/api/v1/tables/${table.id}`, { data: { name: tableName + ' changed' } });
  expect(rename.status()).toBe(200);
  await page.reload();
  await expect(page.getByText('Phát hiện thay đổi sau bản chốt bàn giao!', { exact: true })).toBeVisible();
  expect((await context.request.post(`/api/v1/handovers/snapshots/${savedSnapshot.id}/deliver`, { data: { handedOverTo: 'Outdated delivery' } })).status()).toBe(409);

  expect((await db.query('SELECT snapshot_data FROM handover_packets WHERE id=$1', [savedSnapshot.id])).rows[0].snapshot_data.seating.assignedSeatsCount).toBe(frozenSeats);

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/guests');
  await guestCard.getByRole('button', { name: 'Cập nhật RSVP', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Không đến', exact: true }).click();
  await page.getByRole('button', { name: 'Đồng ý gỡ bàn', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Lưu/ }).click();
  await expect.poll(async () => (await db.query('SELECT count(*)::int AS count FROM seat_assignments WHERE guest_id=$1', [guest.id])).rows[0].count).toBe(0);
});

test('financial retries are atomic and concurrent refunds cannot exceed the original payment', async ({ context }) => {
  await useSession(context, 'owner');
  const category = await context.request.post('/api/v1/finance/categories', { data: { name: `Concurrency ${crypto.randomUUID()}` } });
  expect(category.status()).toBe(201);
  const categoryId = (await category.json()).data.id;
  const created = await context.request.post('/api/v1/finance/costs', { data: { name: 'Concurrency cost', category_id: categoryId, contracted_amount: '100' } });
  expect(created.status()).toBe(201);
  const costId = (await created.json()).data.id;
  const key = crypto.randomUUID();
  const data = { cost_item_id: costId, amount: '100', payment_type: 'outflow', transaction_time: new Date().toISOString() };
  const repeats = await Promise.all([0, 1].map(() => context.request.post('/api/v1/finance/payments', { data, headers: { 'Idempotency-Key': key } })));
  expect(repeats.map((response) => response.status())).toEqual([201, 201]);
  const ids = await Promise.all(repeats.map(async (response) => (await response.json()).data.id));
  expect(ids[0]).toBe(ids[1]);
  expect((await db.query('SELECT count(*)::int AS count FROM payments WHERE cost_item_id=$1', [costId])).rows[0].count).toBe(1);
  const refunds = await Promise.all([0, 1].map(() => context.request.post('/api/v1/finance/payments', {
    data: { ...data, amount: '70', payment_type: 'refund', parent_payment_id: ids[0] }, headers: { 'Idempotency-Key': crypto.randomUUID() },
  })));
  expect(refunds.map((response) => response.status()).sort()).toEqual([201, 400]);
  expect((await db.query("SELECT sum(amount)::text AS total FROM payments WHERE cost_item_id=$1 AND payment_type='refund' AND NOT is_voided", [costId])).rows[0].total).toBe('70');

  // Force the cached-result write to fail after the payment insert: neither may commit.
  const failureKey = crypto.randomUUID();
  await db.query(`CREATE OR REPLACE FUNCTION g11_fail_completed() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.idempotency_key='${failureKey}' AND NEW.status='completed' THEN RAISE EXCEPTION 'G11 injected failure'; END IF; RETURN NEW; END $$`);
  await db.query('CREATE TRIGGER g11_fail_completed BEFORE UPDATE ON idempotency_records FOR EACH ROW EXECUTE FUNCTION g11_fail_completed()');
  try {
    const failed = await context.request.post('/api/v1/finance/payments', { data: { ...data, amount: '3' }, headers: { 'Idempotency-Key': failureKey } });
    expect(failed.status()).toBe(500);
    expect((await db.query("SELECT count(*)::int AS count FROM payments WHERE cost_item_id=$1 AND amount=3", [costId])).rows[0].count).toBe(0);
    expect((await db.query('SELECT count(*)::int AS count FROM idempotency_records WHERE idempotency_key=$1', [failureKey])).rows[0].count).toBe(0);
  } finally {
    await db.query('DROP TRIGGER g11_fail_completed ON idempotency_records');
    await db.query('DROP FUNCTION g11_fail_completed()');
  }
  const retry = await context.request.post('/api/v1/finance/payments', { data: { ...data, amount: '3' }, headers: { 'Idempotency-Key': failureKey } });
  expect(retry.status()).toBe(201);
});

test('seating capacity, stale versions, baby policy and RSVP races hold in PostgreSQL', async ({ context }) => {
  await useSession(context, 'owner');
  const unique = crypto.randomUUID();
  const eventId = '00000000-0000-4000-8000-000000000011';
  const household = await context.request.post('/api/v1/guests/household', { data: {
    groupName: `Seat race ${crypto.randomUUID()}`, eventId,
    members: [
      { displayName: 'Adult A', rsvpStatus: 'accepted', isRepresentative: true },
      { displayName: 'Adult B', rsvpStatus: 'accepted' },
      { displayName: 'Baby', ageTier: 'baby', rsvpStatus: 'accepted', needsSeat: false },
    ],
  } });
  expect(household.status()).toBe(201);
  const guests = (await household.json()).data.guests;
  const response = await context.request.post('/api/v1/tables', { data: { name: `Capacity race ${unique}`, capacity: 1, eventId } });
  expect(response.status()).toBe(201);
  const table = (await response.json()).data;
  const otherTableResponse = await context.request.post('/api/v1/tables', { data: { name: `Other table ${unique}`, capacity: 1, eventId } });
  expect(otherTableResponse.status()).toBe(201);
  const otherTable = (await otherTableResponse.json()).data;

  const assignments = await Promise.all(guests.slice(0, 2).map((guest: { id: string }) => context.request.post(`/api/v1/tables/${table.id}/seats`, { data: { guestId: guest.id } })));
  expect(assignments.map((item) => item.status()).sort()).toEqual([201, 409]);
  const seated = (await db.query('SELECT guest_id FROM seat_assignments WHERE table_id=$1', [table.id])).rows[0].guest_id;
  expect((await context.request.delete(`/api/v1/tables/${otherTable.id}/seats/${seated}`)).status()).toBe(404);
  expect((await db.query('SELECT table_id FROM seat_assignments WHERE guest_id=$1', [seated])).rows[0].table_id).toBe(table.id);

  expect((await context.request.post(`/api/v1/tables/${table.id}/seats`, { data: { guestId: guests[2].id } })).status()).toBe(201);
  expect((await db.query('SELECT count(*)::int AS count FROM seat_assignments WHERE table_id=$1', [table.id])).rows[0].count).toBe(2);
  expect((await context.request.patch(`/api/v1/tables/${table.id}`, { data: { name: `Updated capacity race ${unique}`, version: table.version } })).status()).toBe(200);
  expect((await context.request.patch(`/api/v1/tables/${table.id}`, { data: { name: 'Stale update', version: table.version } })).status()).toBe(409);
  const attendance = (await context.request.get(`/api/v1/attendance?guestId=${seated}&eventId=${eventId}`));
  const current = (await attendance.json()).data[0];
  const race = await Promise.all([
    context.request.post(`/api/v1/tables/${table.id}/seats`, { data: { guestId: seated } }),
    context.request.patch('/api/v1/attendance', { data: { ...current, rsvp_status: 'declined', accommodation_needed: false, transport_needed: false } }),
  ]);
  expect([201, 409]).toContain(race[0].status());
  expect(race[1].status()).toBe(200);
  expect((await db.query('SELECT count(*)::int AS count FROM seat_assignments WHERE guest_id=$1', [seated])).rows[0].count).toBe(0);
});
