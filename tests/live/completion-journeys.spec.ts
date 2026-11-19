import { test, expect, BrowserContext, Page } from '@playwright/test';
import { Client } from 'pg';
import crypto from 'node:crypto';
import sharp from 'sharp';
if (!process.env.G11_DB_URL || new URL(process.env.G11_DB_URL).pathname !== '/wedding_g11_source') throw new Error('Run the isolated G11 harness.');
let db: Client;
test.beforeAll(async()=>{db=new Client({connectionString:process.env.G11_DB_URL});await db.connect();await db.query("INSERT INTO wedding_settings(bride_name,groom_name) SELECT 'Cô dâu kiểm thử','Chú rể kiểm thử' WHERE NOT EXISTS(SELECT 1 FROM wedding_settings)");});
test.afterAll(async()=>{await db.end();});
async function session(context:BrowserContext, role='owner'){
  const token=crypto.randomUUID();await db.query("INSERT INTO sessions(id,token,user_id,expires_at) VALUES($1,$1,$2,now()+interval '1 hour')",[token,role==='owner'?'g11-owner-1':'g11-family']);
  const sig=crypto.createHmac('sha256',process.env.BETTER_AUTH_SECRET!).update(token).digest('base64');await context.addCookies([{name:'session_token',value:encodeURIComponent(`${token}.${sig}`),url:process.env.PLAYWRIGHT_BASE_URL!,httpOnly:true}]);
}
async function event(){const id=crypto.randomUUID();await db.query("INSERT INTO events(id,title,event_type) VALUES($1,$2,'other')",[id,`Buổi kiểm thử ${id.slice(0,8)}`]);return id;}
async function choose(page:Page,id:string){const selector=page.getByLabel('Buổi lễ đang quản lý');await expect(selector).toBeVisible();await selector.selectOption(id);}

test('planning menus create, edit, reload and delete persistent records',async({page,context})=>{
  test.setTimeout(180000);await session(context);const eventId=await event();
  const scenarios=[
    {path:'/support',table:'support_assignments',column:'name',label:'Họ và tên',extra:[['Số điện thoại','0901234567']]},
    {path:'/ideas',table:'preparation_items',column:'title',label:'Tên ý tưởng',extra:[]},
    {path:'/preparation',table:'preparation_items',column:'title',label:'Tên đồ dùng',extra:[]},
    {path:'/preparation',tab:'Danh sách nhạc',table:'preparation_items',column:'title',label:'Tên bài hát',extra:[]},
    {path:'/preparation',tab:'Danh sách ảnh',table:'preparation_items',column:'title',label:'Cảnh chụp',extra:[]},
    {path:'/timeline',table:'timeline_items',column:'title',label:'Tên hoạt động',extra:[['Bắt đầu dự kiến','2028-03-20T10:00'],['Kết thúc dự kiến','2028-03-20T11:00']]},
    {path:'/logistics',table:'transport_trips',column:'name',label:'Tên chuyến',extra:[]},
    {path:'/logistics',tab:'Lưu trú',table:'accommodations',column:'name',label:'Tên nơi lưu trú',extra:[]},
    {path:'/menus',table:'menus',column:'name',label:'Tên thực đơn',extra:[]},
  ];
  for(const scenario of scenarios){
    const title=`Thật ${crypto.randomUUID().slice(0,8)}`;
    await page.goto(scenario.path);await choose(page,eventId);if(scenario.tab)await page.getByRole('button',{name:scenario.tab,exact:true}).or(page.getByRole('tab',{name:scenario.tab,exact:true})).click();
    await page.getByRole('button',{name:'Thêm mới',exact:true}).first().click();const dialog=page.getByRole('dialog');
    await dialog.getByLabel(scenario.label,{exact:false}).fill(title);for(const[label,value]of scenario.extra)await dialog.getByLabel(label,{exact:false}).fill(value);
    const createRequest=page.waitForRequest(request=>request.method()==='POST'&&request.url().includes('/api/v1/'));
    await dialog.getByRole('button',{name:'Lưu',exact:true}).click();await expect(dialog).toHaveCount(0);
    const original=await createRequest;expect((await context.request.post(original.url(),{data:original.postDataJSON(),headers:{'Idempotency-Key':original.headers()['idempotency-key']}})).status()).toBe(201);
    expect((await db.query(`SELECT count(*)::int n FROM ${scenario.table} WHERE ${scenario.column}=$1 AND event_id=$2`,[title,eventId])).rows[0].n).toBe(1);
    await page.reload();await choose(page,eventId);if(scenario.tab)await page.getByRole('button',{name:scenario.tab,exact:true}).or(page.getByRole('tab',{name:scenario.tab,exact:true})).click();
    const card=page.getByRole('article').filter({has:page.getByRole('heading',{name:title,exact:true})});await expect(card).toBeVisible();
    await card.getByRole('button',{name:'Sửa',exact:true}).click();await page.getByRole('dialog').getByLabel(scenario.label,{exact:false}).fill(`${title} sửa`);await page.getByRole('dialog').getByRole('button',{name:'Lưu',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
    expect((await db.query(`SELECT count(*)::int n FROM ${scenario.table} WHERE ${scenario.column}=$1 AND event_id=$2`,[`${title} sửa`,eventId])).rows[0].n).toBe(1);
    page.once('dialog',d=>d.accept());await page.getByRole('article').filter({has:page.getByRole('heading',{name:`${title} sửa`,exact:true})}).getByRole('button',{name:'Xóa',exact:true}).click();await expect(page.getByRole('heading',{name:`${title} sửa`,exact:true})).toHaveCount(0);
  }
});

test('invitations and CSV import persist through the actual menus',async({page,context})=>{
  test.setTimeout(90000);await session(context);const id=await event();const guestId=crypto.randomUUID();const name=`Khách ${guestId.slice(0,8)}`;
  await db.query("INSERT INTO guests(id,display_name,side,age_tier) VALUES($1,$2,'mutual','adult')",[guestId,name]);
  await page.goto('/invitations');await choose(page,id);await page.getByRole('button',{name:'Thêm mới',exact:true}).click();
  const d=page.getByRole('dialog');const cardName=`Thiệp ${guestId.slice(0,8)}`;await d.getByLabel('Tên trên thiệp').fill(cardName);await d.getByLabel('Người đại diện').selectOption(guestId);await d.getByLabel('Thành viên nhận chung thiệp').selectOption([guestId]);await d.getByRole('button',{name:'Lưu',exact:true}).click();await expect(d).toHaveCount(0);
  await page.reload();await choose(page,id);const card=page.getByRole('article').filter({has:page.getByRole('heading',{name:cardName})});await expect(card).toBeVisible();await card.getByRole('button',{name:'Ghi nhận đã gửi'}).click();await page.getByRole('dialog').getByLabel('Ngày gửi').fill('2028-03-01');await page.getByRole('dialog').getByRole('button',{name:'Lưu',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await db.query('SELECT status FROM invitations WHERE card_name=$1',[cardName])).rows[0].status).toBe('sent');expect((await db.query('SELECT rsvp_status FROM attendance WHERE guest_id=$1 AND event_id=$2',[guestId,id])).rows[0].rsvp_status).toBe('not_contacted');
  const bulkNames=[];for(let index=0;index<2;index++){const guest=crypto.randomUUID();const bulkName=`Thiệp nhóm ${guest.slice(0,8)}`;bulkNames.push(bulkName);await db.query("INSERT INTO guests(id,display_name) VALUES($1,$2)",[guest,bulkName]);expect((await context.request.post('/api/v1/invitations',{data:{event_id:id,card_name:bulkName,representative_guest_id:guest,member_guest_ids:[guest],delivery_method:'paper'}})).status()).toBe(201);}
  await page.reload();await choose(page,id);for(const bulkName of bulkNames)await page.getByLabel(`Chọn thiệp ${bulkName}`,{exact:true}).check();await page.getByRole('button',{name:'Đánh dấu đã gửi (2 thiệp đã chọn)',exact:true}).click();await page.getByRole('dialog').getByLabel('Ngày gửi',{exact:false}).fill('2028-03-02');await page.getByRole('dialog').getByRole('button',{name:'Lưu',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);expect((await db.query("SELECT count(*)::int n FROM invitations WHERE card_name=ANY($1) AND status='sent'",[bulkNames])).rows[0].n).toBe(2);
  const imported=`Nhập ${crypto.randomUUID().slice(0,8)}`;await page.goto('/data/import');await page.getByLabel('Tệp CSV hoặc XLSX',{exact:false}).setInputFiles({name:'guests.csv',mimeType:'text/csv',buffer:Buffer.from(`display_name,phone,side\r\n${imported},0901234567,bride\r\n`)});await page.getByRole('button',{name:'Kiểm tra dữ liệu'}).click();await expect(page.getByText('1 dòng • 1 hợp lệ • 0 lỗi')).toBeVisible();page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Xác nhận nhập 1 khách'}).click();await expect(page.getByRole('status')).toContainText('Đã nhập 1 khách');expect((await db.query('SELECT count(*)::int n FROM guests WHERE display_name=$1',[imported])).rows[0].n).toBe(1);
});

test('sharing, archive, media and workbook exports enforce real persistence and permissions',async({context,browser})=>{
  await session(context);const id=await event();
  const create=await context.request.post('/api/v1/archival/media',{data:{title:'Album thật',url:'https://example.com/album',mediaType:'photo_album'}});expect(create.status()).toBe(201);const media=(await create.json()).data;expect((await db.query('SELECT url FROM media_links WHERE id=$1',[media.id])).rows[0].url).toBe('https://example.com/album');
  const invite=await context.request.post('/api/v1/sharing',{data:{email:'family@g11.invalid',allowedEventIds:[id]}});expect(invite.status()).toBe(201);const token=new URL((await invite.json()).data.inviteUrl).searchParams.get('token');
  const family=await browser.newContext();await session(family,'family');try{expect((await family.request.post('/api/v1/sharing/redeem',{data:{token}})).status()).toBe(200);expect((await family.request.post('/api/v1/sharing/redeem',{data:{token}})).status()).toBe(403);expect((await family.request.get('/api/v1/archival/media')).status()).toBe(403);expect((await family.request.get('/api/v1/export/workbook?dataset=finance')).status()).toBe(403);}finally{await family.close();}
  const exported=await context.request.get('/api/v1/export/workbook?dataset=all');expect(exported.status()).toBe(200);expect(exported.headers()['content-type']).toContain('spreadsheetml');expect((await exported.body()).length).toBeGreaterThan(1000);
  const json=await context.request.get('/api/v1/export/workbook?dataset=all&format=json');expect(json.status()).toBe(200);expect((await json.json()).tables).not.toHaveProperty('sessions');
  expect((await context.request.post('/api/v1/archival/export-confirmation',{headers:{'Idempotency-Key':crypto.randomUUID()}})).status()).toBe(201);
  const freeze=await context.request.post('/api/v1/archival/freeze',{data:{archiveReason:'Kiểm thử chế độ lưu trữ',confirmed:true}});expect(freeze.status()).toBe(200);
  try{const blocked=await context.request.post('/api/v1/guests',{data:{display_name:'Không được ghi'}});expect(blocked.ok()).toBe(false);expect((await db.query("SELECT count(*)::int n FROM guests WHERE display_name='Không được ghi'")).rows[0].n).toBe(0);}finally{expect((await context.request.post('/api/v1/archival/unarchive',{data:{unarchiveReason:'Tiếp tục kiểm thử'}})).status()).toBe(200);}
});

test('nested menu operations, idea promotion, funding and event configuration are durable',async({page,context})=>{
  test.setTimeout(90000);await session(context);const eventId=await event();const guestId=crypto.randomUUID();
  await db.query("INSERT INTO guests(id,display_name,side,age_tier) VALUES($1,'Khách thao tác con','mutual','adult')",[guestId]);
  await db.query("INSERT INTO attendance(event_id,guest_id,rsvp_status,needs_meal,needs_seat) VALUES($1,$2,'accepted',true,true)",[eventId,guestId]);
  async function post(url:string,data:unknown){const r=await context.request.post(url,{data});expect(r.ok(),await r.text()).toBe(true);return(await r.json()).data;}
  const trip=await post('/api/v1/transport',{eventId,name:'Xe phân khách',capacity:1});
  await page.goto('/logistics');await choose(page,eventId);let card=page.getByRole('article').filter({has:page.getByRole('heading',{name:'Xe phân khách',exact:true})});await card.getByRole('button',{name:'Chi tiết',exact:true}).click();await card.getByRole('button',{name:'Thêm mới',exact:true}).click();await page.getByRole('dialog').getByLabel('Khách mời').selectOption(guestId);await page.getByRole('dialog').getByRole('button',{name:'Lưu',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);expect((await db.query('SELECT guest_id FROM trip_passengers WHERE trip_id=$1',[trip.id])).rows[0].guest_id).toBe(guestId);
  const hotel=await post('/api/v1/accommodations',{eventId,name:'Khách sạn phân phòng',totalRooms:1});await post(`/api/v1/accommodations/${hotel.id}/rooms`,{eventId,guestId,roomNumber:'101'});
  const second=crypto.randomUUID();await db.query("INSERT INTO guests(id,display_name) VALUES($1,'Khách thứ hai')",[second]);expect((await context.request.post(`/api/v1/accommodations/${hotel.id}/rooms`,{data:{eventId,guestId:second,roomNumber:'102'}})).status()).toBe(409);
  const menu=await post('/api/v1/menus',{eventId,name:'Thực đơn chốt thật'});await post(`/api/v1/menus/${menu.id}/items`,{name:'Món đã chốt',courseType:'main'});await post('/api/v1/menus/selections',{eventId,guestId,mealTier:'vegetarian'});
  await page.goto('/menus');await choose(page,eventId);card=page.getByRole('article').filter({has:page.getByRole('heading',{name:'Thực đơn chốt thật',exact:true})});await card.getByRole('button',{name:'Chi tiết',exact:true}).click();await card.getByRole('button',{name:'Chốt số suất với nhà hàng'}).click();await page.getByRole('dialog').getByRole('button',{name:'Lưu',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  const locked=(await db.query('SELECT * FROM catering_snapshots WHERE event_id=$1',[eventId])).rows[0];expect(locked.vegetarian_meals).toBe(1);expect(locked.locked_by).toBe('g11-owner-1');expect(locked.menu_snapshot.courses[0].name).toBe('Món đã chốt');await page.reload();await choose(page,eventId);await expect(page.getByRole('heading',{name:'Lịch sử chốt nhà hàng'})).toBeVisible();
  expect((await context.request.post('/api/v1/r2-signoff',{data:{eventId}})).status()).toBe(409);
  const table=await post('/api/v1/tables',{eventId,name:'Bàn nghiệm thu',capacity:10,shape:'round'});await post(`/api/v1/tables/${table.id}/seats`,{guestId});
  await page.goto('/handovers');await choose(page,eventId);await page.getByRole('button',{name:'Bản chốt nghiệm thu R2',exact:true}).click();await page.getByRole('button',{name:'Lưu bản chốt',exact:true}).click();await page.getByRole('dialog').getByLabel('Tên bản chốt',{exact:false}).fill('Nghiệm thu thực tế');await page.getByRole('dialog').getByRole('button',{name:'Lưu',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('status')).toContainText('Đã lưu bản chốt');
  const signoff=(await db.query("SELECT snapshot_data FROM handover_packets WHERE event_id=$1 AND title='Nghiệm thu thực tế'",[eventId])).rows[0].snapshot_data;expect(signoff.readiness.checks).toHaveLength(7);expect(signoff.seating.assignedSeatsCount).toBe(1);
  const timeline=await post('/api/v1/timeline',{eventId,title:'Mốc dời lịch',category:'other',scheduledStartTime:'2028-03-20T03:00:00.000Z',scheduledEndTime:'2028-03-20T04:00:00.000Z'});
  const stalePreview=(await(await context.request.post('/api/v1/timeline/shift',{data:{eventId,delayMinutes:15}})).json()).data;
  expect((await context.request.patch(`/api/v1/timeline/${timeline.id}`,{data:{title:'Mốc dời lịch đã sửa',version:timeline.version}})).ok()).toBe(true);
  expect((await context.request.post('/api/v1/timeline/shift',{data:{eventId,delayMinutes:15,confirmed:true,expectedVersions:stalePreview.affectedItems.map((item:{id:string;version:number})=>({id:item.id,version:item.version}))}})).status()).toBe(409);
  await page.goto('/timeline');await choose(page,eventId);await page.getByRole('button',{name:'Dời các mốc chưa diễn ra',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Lưu',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  const applyRequest=page.waitForRequest(request=>request.url().endsWith('/api/v1/timeline/shift')&&request.postDataJSON()?.confirmed===true);await page.getByRole('button',{name:'Xác nhận dời lịch',exact:true}).click();const applied=await applyRequest;await expect(page.getByRole('button',{name:'Xác nhận dời lịch',exact:true})).toHaveCount(0);
  expect((await context.request.post('/api/v1/timeline/shift',{data:applied.postDataJSON(),headers:{'Idempotency-Key':applied.headers()['idempotency-key']}})).status()).toBe(200);
  expect((await db.query('SELECT scheduled_start_time FROM timeline_items WHERE id=$1',[timeline.id])).rows[0].scheduled_start_time.toISOString()).toBe('2028-03-20T03:15:00.000Z');
  const idea=await post('/api/v1/preparation/ideas',{eventId,title:'Ý tưởng chuyển đổi'});const a=await post(`/api/v1/preparation/ideas/${idea.id}/promote`,{kind:'task',title:'Việc từ ý tưởng'});const b=await post(`/api/v1/preparation/ideas/${idea.id}/promote`,{kind:'task',title:'Việc từ ý tưởng'});expect(a.id).toBe(b.id);expect((await db.query('SELECT count(*)::int n FROM tasks WHERE id=$1',[a.id])).rows[0].n).toBe(1);
  const category=await post('/api/v1/finance/categories',{name:`Danh mục ${crypto.randomUUID()}`});const cost=await post('/api/v1/finance/costs',{name:'Khoản trả hộ',category_id:category.id,event_id:eventId,contracted_amount:'9000000',status:'contracted'});
  const key=crypto.randomUUID();const payload={entry_type:'direct_vendor_payment',amount:'1000000',contributor_name:'Người thân kiểm thử',linked_cost_item_id:cost.id,contribution_date:new Date().toISOString()};
  const funds=await Promise.all([1,2].map(()=>context.request.post('/api/v1/finance/funding-entries',{data:payload,headers:{'Idempotency-Key':key}})));expect(funds.map(r=>r.status())).toEqual([201,201]);expect((await db.query('SELECT count(*)::int n FROM payments WHERE cost_item_id=$1',[cost.id])).rows[0].n).toBe(1);
  const current=(await(await context.request.get('/api/v1/events')).json()).data.find((e:{id:string})=>e.id===eventId);const changed=await context.request.patch(`/api/v1/events/${eventId}`,{data:{...current,title:'Buổi đã cập nhật'}});expect(changed.status()).toBe(200);expect((await context.request.patch(`/api/v1/events/${eventId}`,{data:{...current,title:'Ghi đè cũ'}})).status()).toBe(409);
});

test('check-in, gifts, appointments and form recovery work through the live interface',async({page,context})=>{
  test.setTimeout(90000);await session(context);const eventId=await event();
  await page.goto('/settings');await page.getByRole('button',{name:'Chỉnh sửa thông tin',exact:true}).click();let settings=page.getByRole('dialog');await settings.getByLabel('Ngân sách mục tiêu',{exact:false}).fill('9007199254740993');await settings.getByLabel('Ngân sách dự phòng',{exact:false}).fill('0');await settings.getByRole('button',{name:'Lưu',exact:true}).click();await expect(settings).toHaveCount(0);
  expect((await db.query('SELECT budget_target::text FROM wedding_settings')).rows[0].budget_target).toBe('9007199254740993');
  const guestName=`Khách đến ${crypto.randomUUID().slice(0,8)}`;
  await page.goto('/attendance');await choose(page,eventId);
  await page.getByRole('button',{name:'+ Khách phát sinh',exact:true}).click();
  await page.getByLabel('Họ và tên khách phát sinh',{exact:true}).fill(guestName);
  await page.getByRole('button',{name:'Thêm & Điểm danh ngay',exact:true}).click();
  await expect(page.getByText(guestName,{exact:true})).toBeVisible();
  expect((await db.query('SELECT a.is_checked_in FROM attendance a JOIN guests g ON g.id=a.guest_id WHERE g.display_name=$1 AND a.event_id=$2',[guestName,eventId])).rows[0].is_checked_in).toBe(true);
  await page.reload();await choose(page,eventId);await expect(page.getByText(guestName,{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Hoàn tác',exact:true}).click();await expect(page.getByRole('button',{name:'Điểm danh',exact:true})).toBeVisible();
  const before=(await(await context.request.get('/api/v1/finance/overview')).json()).data.cashLedger;
  await page.goto('/gifts');await choose(page,eventId);await page.getByRole('button',{name:'+ Ghi nhận quà mừng',exact:true}).click();
  await page.getByLabel('Tên người gửi',{exact:true}).fill(guestName);
  for(const invalidAmount of ['-500000','1.5']){await page.getByLabel('Số tiền mừng (VND)',{exact:true}).fill(invalidAmount);await page.getByRole('button',{name:'Lưu quà mừng',exact:true}).click();await expect(page.getByRole('heading',{name:'Ghi Nhận Quà Mừng Mới'})).toBeVisible();expect((await db.query('SELECT count(*)::int n FROM gifts WHERE event_id=$1',[eventId])).rows[0].n).toBe(0);}
  await page.getByLabel('Số tiền mừng (VND)',{exact:true}).fill('500000');
  await page.getByRole('button',{name:'Lưu quà mừng',exact:true}).click();await expect(page.getByRole('heading',{name:'Ghi Nhận Quà Mừng Mới'})).toHaveCount(0);
  expect((await db.query('SELECT count(*)::int n FROM gifts WHERE event_id=$1 AND amount=500000 AND received_at IS NOT NULL',[eventId])).rows[0].n).toBe(1);
  const after=(await(await context.request.get('/api/v1/finance/overview')).json()).data.cashLedger;
  expect(BigInt(after.postOpeningGiftReceipts)-BigInt(before.postOpeningGiftReceipts)).toBe(500000n);
  const gift=(await db.query('SELECT id FROM gifts WHERE event_id=$1 AND amount=500000',[eventId])).rows[0];
  const returns=await Promise.all([1,2].map(()=>context.request.post(`/api/v1/gifts/${gift.id}/returns`,{data:{amount:'400000',returnReason:'Kiểm tra hoàn đồng thời'}})));expect(returns.map(response=>response.status()).sort()).toEqual([200,400]);expect((await db.query('SELECT sum(amount)::text total FROM gift_returns WHERE gift_id=$1',[gift.id])).rows[0].total).toBe('400000');
  await page.goto('/calendar');await page.getByRole('button',{name:'Thêm mới',exact:true}).click();
  let d=page.getByRole('dialog');const title=`Hẹn ${crypto.randomUUID().slice(0,8)}`;
  await d.getByLabel('Tên cuộc hẹn',{exact:false}).fill(title);await d.getByLabel('Bắt đầu cuộc hẹn',{exact:false}).fill('2028-03-20T10:00');await d.getByLabel('Kết thúc cuộc hẹn',{exact:false}).fill('2028-03-20T11:00');
  page.once('dialog',dialog=>dialog.accept());await page.reload();await page.getByRole('button',{name:'Thêm mới',exact:true}).click();d=page.getByRole('dialog');
  await expect(d.getByLabel('Tên cuộc hẹn',{exact:false})).toHaveValue(title);await expect(d.getByRole('status')).toContainText('Đã khôi phục bản nháp');
  await d.getByRole('button',{name:'Lưu',exact:true}).click();await expect(d).toHaveCount(0);
  expect((await db.query('SELECT start_time FROM appointments WHERE title=$1',[title])).rows[0].start_time.toISOString()).toBe('2028-03-20T03:00:00.000Z');
  await page.reload();await expect(page.getByRole('article').filter({has:page.getByRole('heading',{name:title,exact:true})})).toBeVisible();
  await page.goto('/documents');const prefix=crypto.randomUUID().slice(0,8);const picture=await sharp({create:{width:16,height:16,channels:3,background:'#aa7755'}}).png().toBuffer();
  await page.getByLabel('Tải tài liệu hoặc ảnh lên',{exact:true}).setInputFiles([{name:`${prefix}-one.png`,mimeType:'image/png',buffer:picture},{name:`${prefix}-bad.txt`,mimeType:'text/plain',buffer:Buffer.from('invalid file')},{name:`${prefix}-two.png`,mimeType:'image/png',buffer:picture}]);
  await expect(page.locator('ul[role="status"]')).toContainText(`${prefix}-two.png: đã tải lên`);await expect(page.locator('ul[role="status"]')).toContainText(`${prefix}-bad.txt:`);
  await page.getByLabel('Tìm tài liệu theo tên',{exact:true}).fill(prefix);await expect(page.getByRole('link',{name:`${prefix}-one.png`,exact:true})).toBeVisible();await expect(page.getByRole('link',{name:`${prefix}-two.png`,exact:true})).toBeVisible();
  expect((await db.query('SELECT count(*)::int n FROM attachments WHERE original_name LIKE $1',[`${prefix}%`])).rows[0].n).toBe(2);
  if(!await page.getByRole('button',{name:'Đăng xuất',exact:true}).isVisible())await page.getByRole('button',{name:'Mở thanh điều hướng',exact:true}).click();
  await page.getByRole('button',{name:'Đăng xuất',exact:true}).click();await expect(page).toHaveURL(/\/login$/);expect((await context.request.get('/api/v1/events')).status()).toBe(401);
  expect(await page.evaluate(()=>Object.keys(sessionStorage).filter(key=>key.startsWith('wedding-')).length)).toBe(0);
});

test('task editing, checklists, dependencies and cost installment forms persist through the UI',async({page,context})=>{
  test.setTimeout(90000);await session(context);const eventId=await event();
  async function post(url:string,data:unknown){const response=await context.request.post(url,{data});expect(response.ok(),await response.text()).toBe(true);return(await response.json()).data;}
  const prefix=crypto.randomUUID().slice(0,8);const prerequisite=await post('/api/v1/tasks',{title:`Tiên quyết ${prefix}`,event_id:eventId,deadline_type:'fixed_date',fixed_date:'2028-03-19'});const task=await post('/api/v1/tasks',{title:`Việc chi tiết ${prefix}`,event_id:eventId,deadline_type:'fixed_date',fixed_date:'2028-03-20'});
  await page.goto('/tasks');const card=page.getByTestId(`task-${task.id}`);await card.getByRole('button',{name:'Sửa công việc',exact:true}).click();let dialog=page.getByRole('dialog');await dialog.getByLabel('Tiêu đề công việc',{exact:false}).fill(`Việc đã sửa ${prefix}`);await dialog.getByRole('button',{name:'Lưu',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(card.getByRole('heading',{name:`Việc đã sửa ${prefix}`,exact:true})).toBeVisible();
  if(!await card.getByRole('button',{name:'Thêm mục checklist',exact:true}).isVisible())await card.getByRole('button',{name:'Checklist & Phụ thuộc',exact:true}).click();await card.getByRole('button',{name:'Thêm mục checklist',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('Nội dung checklist',{exact:false}).fill('Đã kiểm tra hiện trường');await dialog.getByRole('button',{name:'Lưu',exact:true}).click();await expect(dialog).toHaveCount(0);await card.getByLabel('Đã kiểm tra hiện trường',{exact:true}).check();
  await card.getByRole('button',{name:'Thêm việc tiên quyết',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('Công việc phải hoàn thành trước',{exact:false}).selectOption(prerequisite.id);await dialog.getByRole('button',{name:'Lưu',exact:true}).click();await expect(dialog).toHaveCount(0);
  expect((await db.query('SELECT is_completed FROM task_checklist_items WHERE task_id=$1',[task.id])).rows[0].is_completed).toBe(true);expect((await db.query('SELECT prerequisite_task_id FROM task_dependencies WHERE dependent_task_id=$1',[task.id])).rows[0].prerequisite_task_id).toBe(prerequisite.id);
  await card.getByRole('button',{name:'Hoàn thành vượt phụ thuộc',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('Lý do hoàn thành',{exact:false}).fill('Chủ sở hữu đã kiểm tra và xác nhận hoàn thành tại hiện trường');await dialog.getByRole('button',{name:'Lưu',exact:true}).click();await expect(dialog).toHaveCount(0);expect((await db.query('SELECT status FROM tasks WHERE id=$1',[task.id])).rows[0].status).toBe('completed');
  const category=await post('/api/v1/finance/categories',{name:`Nhóm chi ${prefix}`});const cost=await post('/api/v1/finance/costs',{name:`Khoản chi chi tiết ${prefix}`,category_id:category.id,event_id:eventId,contracted_amount:'9000000',status:'contracted'});
  await page.goto('/budget');const costCard=page.getByRole('article').filter({has:page.getByRole('heading',{name:`Khoản chi chi tiết ${prefix}`,exact:true})});await costCard.getByRole('button',{name:'Sửa khoản chi',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('Giá quyết toán',{exact:false}).fill('8500000');await dialog.getByRole('button',{name:'Lưu',exact:true}).click();await expect(dialog).toHaveCount(0);expect((await db.query('SELECT final_settlement_amount::text FROM cost_items WHERE id=$1',[cost.id])).rows[0].final_settlement_amount).toBe('8500000');
  await costCard.getByRole('button',{name:'Lịch thanh toán',exact:true}).click();await costCard.getByRole('button',{name:'Thêm đợt trả',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('Tên đợt trả',{exact:false}).fill('Thanh toán lần một');await dialog.getByLabel('Số tiền phải trả',{exact:false}).fill('5000000');await dialog.getByLabel('Ngày đến hạn',{exact:false}).fill('2028-03-20');await dialog.getByRole('button',{name:'Lưu',exact:true}).click();await expect(dialog).toHaveCount(0);await costCard.getByRole('button',{name:'Sửa đợt trả',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('Số tiền phải trả',{exact:false}).fill('4500000');await dialog.getByRole('button',{name:'Lưu',exact:true}).click();await expect(dialog).toHaveCount(0);expect((await db.query('SELECT amount_due::text FROM payment_schedules WHERE cost_item_id=$1',[cost.id])).rows[0].amount_due).toBe('4500000');
  await costCard.getByRole('button',{name:'Hủy dịch vụ',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('Phí hủy',{exact:false}).fill('500000');await dialog.getByLabel('Lý do và điều kiện hủy',{exact:false}).fill('Hai bên thống nhất hủy và chốt phí dịch vụ');await dialog.getByRole('button',{name:'Lưu',exact:true}).click();await expect(dialog).toHaveCount(0);expect((await db.query('SELECT cancellation_fee::text FROM cost_items WHERE id=$1',[cost.id])).rows[0].cancellation_fee).toBe('500000');
});
