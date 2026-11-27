'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ResourceWorkspace, EventWorkspace, Field, RecordData, RecordEditor } from '@/components/common/ResourceWorkspace';
import { api, allPages, jsonBody } from '@/lib/api/request';
import { useRole } from '@/context/RoleContext';
import { Button } from '@/components/ui/button';

const text = (key: string, label: string, required = false): Field => ({ key, label, required });
const check = (key: string, label: string, value = false): Field => ({ key, label, type: 'checkbox', default: value });
const number = (key: string, label: string, value = 1, min = 0): Field => ({ key, label, type: 'number', default: value, required: true, min });
const select = (key: string, label: string, entries: [string, string][], value?: string): Field => ({ key, label, type: 'select', options: entries.map(([value, label]) => ({ value, label })), default: value || entries[0][0], required: true });
const notes: Field = { key: 'notes', label: 'Ghi chú', type: 'textarea' };
const shared = check('isShared', 'Chia sẻ với người nhà');
const dateTime = (key: string, label: string, required = false): Field => ({ key, label, type: 'datetime-local', required });
const status = (entries: [string, string][]) => select('status', 'Trạng thái', entries);
const ideaFields: Field[] = [text('title', 'Tên ý tưởng', true), text('category', 'Nhóm ý tưởng'), status([['reference', 'Tham khảo'], ['considering', 'Đang cân nhắc'], ['decided', 'Đã chọn'], ['discarded', 'Không chọn']]), { key: 'externalUrl', label: 'Link tham khảo', type: 'url' }, { key: 'colorSwatches', label: 'Mã màu (#RRGGBB)', type: 'tags' }, notes, shared];
const itemFields: Field[] = [text('title', 'Tên đồ dùng', true), text('category', 'Nhóm đồ dùng'), number('quantity', 'Số lượng', 1, 1), status([['not_prepared', 'Chưa chuẩn bị'], ['packed', 'Đã đóng gói'], ['brought', 'Đã mang đến'], ['returned', 'Đã trả']]), select('priority', 'Ưu tiên', [['medium', 'Vừa'], ['high', 'Cao'], ['low', 'Thấp']]), text('keeper', 'Người giữ'), text('location', 'Nơi để đồ'), text('bringTime', 'Giờ mang đến'), check('isRental', 'Đồ thuê / mượn'), { key: 'returnDueDate', label: 'Hạn trả đồ thuê / mượn', type: 'date' }, notes, shared];
const musicFields: Field[] = [text('title', 'Tên bài hát', true), text('artist', 'Nghệ sĩ'), select('moment', 'Khoảnh khắc', [['guest_arrival', 'Đón khách'], ['entrance', 'Tiến vào lễ'], ['vows_rings', 'Trao nhẫn'], ['toast', 'Nâng ly'], ['first_dance', 'Khiêu vũ'], ['party_games', 'Tiệc & trò chơi'], ['send_off', 'Tiễn khách']]), { key: 'externalUrl', label: 'Link bài hát', type: 'url' }, { key: 'durationSeconds', label: 'Thời lượng (giây)', type: 'number', min: 0 }, number('trackOrder', 'Thứ tự phát', 0), text('cueNotes', 'Hướng dẫn phát nhạc'), check('isBlacklisted', 'Không phát bài này'), shared];
const shotFields: Field[] = [text('title', 'Cảnh chụp', true), text('subjectGroup', 'Nhóm người chụp'), text('sessionName', 'Buổi chụp'), text('timeLocation', 'Thời gian & địa điểm'), select('priority', 'Ưu tiên', [['must_have', 'Bắt buộc'], ['nice_to_have', 'Nếu có thời gian']]), text('gatheringLead', 'Người tập hợp'), notes, { ...check('isExecuted', 'Đã chụp'), editOnly: true }, shared];
const supportFields: Field[] = [text('name', 'Họ và tên', true), { key: 'phone', label: 'Số điện thoại', type: 'tel', required: true }, { key: 'roles', label: 'Vai trò hỗ trợ', type: 'multi', required: true, default: ['dieu_phoi'], options: [['co_dau','Cô dâu'],['chu_re','Chú rể'],['phu_dau','Phù dâu'],['phu_re','Phù rể'],['mc','MC'],['dieu_phoi','Điều phối'],['nguoi_than','Người thân'],['nha_cung_cap','Nhà cung cấp'],['khac','Khác']].map(([value,label])=>({value,label})) }, text('arrivalTime', 'Giờ có mặt'), text('duties', 'Nhiệm vụ'), text('backupName', 'Người dự phòng'), { key: 'backupPhone', label: 'Điện thoại dự phòng', type: 'tel' }, text('attireNotes', 'Trang phục (riêng tư)'), shared];
const timelineFields: Field[] = [text('title', 'Tên hoạt động', true), select('category', 'Nhóm hoạt động', [['makeup', 'Trang điểm'], ['car_pickup', 'Đón xe'], ['ancestor_ceremony', 'Gia tiên'], ['transfer', 'Di chuyển'], ['hall_prep', 'Chuẩn bị sảnh'], ['guest_welcome', 'Đón khách'], ['ceremony', 'Nghi lễ'], ['banquet', 'Tiệc'], ['photoshoot', 'Chụp ảnh'], ['wrapup', 'Kết thúc'], ['handover', 'Bàn giao'], ['other', 'Khác']]), dateTime('scheduledStartTime', 'Bắt đầu dự kiến', true), dateTime('scheduledEndTime', 'Kết thúc dự kiến', true), text('locationName', 'Địa điểm'), text('personInCharge', 'Người phụ trách'), { key: 'inChargePhone', label: 'Điện thoại liên hệ', type: 'tel' }, text('backupPerson', 'Người dự phòng'), { key: 'backupPhone', label: 'Điện thoại dự phòng', type: 'tel' }, { key: 'operationalNotes', label: 'Ghi chú riêng', type: 'textarea' }, number('sortOrder', 'Thứ tự', 0), { ...status([['not_started', 'Chưa bắt đầu'], ['in_progress', 'Đang diễn ra'], ['completed', 'Hoàn thành'], ['skipped', 'Bỏ qua']]), editOnly: true }, { ...dateTime('actualStartTime', 'Bắt đầu thực tế'), editOnly: true }, { ...dateTime('actualEndTime', 'Kết thúc thực tế'), editOnly: true }, check('isShared', 'Chia sẻ lịch trình', true)];

function ShotHandover({ record, reload }: { record: RecordData; reload: () => void }) {
  const { isOwner } = useRole(); const [open, setOpen] = useState(false);
  return <>{record.handedOverAt && <p className="text-sm">Đã bàn giao: {new Date(String(record.handedOverAt)).toLocaleString('vi-VN')}</p>}{isOwner && !record.handedOverAt && <Button variant="secondary" onClick={() => setOpen(true)}>Bàn giao ekip</Button>}
    {open && <RecordEditor title="Bàn giao cảnh chụp" fields={[text('recipient', 'Người nhận', true), text('channel', 'Kênh bàn giao'), notes]} close={() => setOpen(false)} save={async body => { await api(`/api/v1/preparation/shots/${record.id}/handover`, { method: 'POST', body: jsonBody({ ...body, channel: body.channel || 'direct_handover' }) }); reload(); }} />}</>;
}

function Preparation({ eventId }: { eventId: string }) {
  const [tab, setTab] = useState('items');
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const requested = new URLSearchParams(window.location.search).get('tab');
    if (requested === 'items' || requested === 'music' || requested === 'shots') {
      setTab(requested);
    }
  }, []);
  const configs = { items: { title: 'Đồ dùng', fields: itemFields }, music: { title: 'Danh sách nhạc', fields: musicFields }, shots: { title: 'Danh sách ảnh', fields: shotFields } };
  const config = configs[tab as keyof typeof configs];
  return <>
    <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
      <div className="flex flex-wrap gap-2" role="tablist">
        {Object.entries(configs).map(([key, value]) => <Button key={key} variant={tab === key ? 'primary' : 'secondary'} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>{value.title}</Button>)}
      </div>
      {tab === 'music' && <Link href="/music" className="text-xs font-medium text-primary hover:underline">Mở trang Chọn nhạc chuyên biệt →</Link>}
    </div>
    <ResourceWorkspace key={tab} title={config.title} endpoint={`/api/v1/preparation/${tab}`} eventId={eventId} fields={config.fields} actions={tab === 'shots' ? (r, reload) => <ShotHandover record={r} reload={reload} /> : undefined} />
  </>;
}

function IdeaPromotion({ record, reload }: { record: RecordData; reload: () => void }) {
  const { isOwner } = useRole(); const [kind, setKind] = useState<'task' | 'cost' | null>(null); const [categories, setCategories] = useState<{ id: string; name: string }[]>([]); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  useEffect(() => { if (!isOwner || kind !== 'cost') return; let active = true; api<{ data: typeof categories }>('/api/v1/finance/categories').then(r => { if (active) setCategories(r.data); }).catch(f => { if (active) setError(f.message); }); return () => { active = false; }; }, [isOwner, kind]);
  if (!isOwner) return null;
  return <><Button variant="secondary" onClick={() => setKind('task')}>{record.metadata?.linkedTaskId ? 'Xem công việc đã tạo' : 'Tạo công việc'}</Button><Button variant="secondary" onClick={() => setKind('cost')}>{record.metadata?.linkedCostItemId ? 'Xem khoản chi đã tạo' : 'Tạo khoản chi'}</Button>{error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {kind && <RecordEditor title={kind === 'task' ? 'Tạo công việc từ ý tưởng' : 'Tạo khoản chi từ ý tưởng'} fields={[{ key: 'title', label: 'Tên bản ghi mới', required: true, default: record.title }, ...(kind === 'cost' ? [{ key: 'categoryId', label: 'Danh mục ngân sách', type: 'select', required: true, options: categories.map(c => ({ value: c.id, label: c.name })) } as Field] : [])]} close={() => setKind(null)} save={async body => { const r = await api<{ data: { id: string; existing: boolean } }>(`/api/v1/preparation/ideas/${record.id}/promote`, { method: 'POST', body: jsonBody({ ...body, kind }) }); setNotice(r.data.existing ? 'Bản ghi đã tồn tại, không tạo trùng.' : 'Đã tạo và liên kết nguồn ý tưởng.'); reload(); }} />}
  </>;
}

function MealSelections({ eventId, onChanged }: { eventId: string; onChanged: () => void }) {
  const [guests,setGuests] = useState<{id:string;display_name:string}[]>([]); const [error,setError] = useState('');
  useEffect(()=>{let active=true;allPages<{id:string;display_name:string}>('/api/v1/guests').then(r=>{if(active)setGuests(r);}).catch(f=>{if(active)setError(f.message);});return()=>{active=false;};},[]);
  return <>{error&&<p role="alert">{error}</p>}<ResourceWorkspace title="Lựa chọn suất ăn của khách" titleKey="guestId" endpoint="/api/v1/menus/selections" eventId={eventId} canEdit={false} canDelete={false} onChanged={onChanged} fields={[{key:'guestId',label:'Khách mời',type:'select',required:true,options:guests.map(g=>({value:g.id,label:g.display_name}))},select('mealTier','Suất ăn',[['standard','Thường'],['vegetarian','Chay'],['child','Trẻ em'],['special','Đặc biệt']]),text('dietaryNotes','Yêu cầu ăn uống'),text('allergyNotes','Dị ứng')]} /><p className="text-xs text-text-muted">Thêm lại cùng khách để cập nhật lựa chọn. Số suất chỉ tính cho khách xác nhận dự và cần suất ăn.</p></>;
}

function Assignments({ kind, record, eventId }: { kind: 'transport' | 'accommodations'; record: RecordData; eventId: string }) {
  const [guests, setGuests] = useState<{ id: string; display_name: string }[]>([]);
  const [error, setError] = useState('');
  useEffect(() => { let active = true; allPages<{ id: string; display_name: string }>('/api/v1/guests').then(v => { if (active) setGuests(v); }).catch(f => { if (active) setError(f.message); }); return () => { active = false; }; }, []);
  const fields: Field[] = [{ key: 'guestId', label: 'Khách mời', type: 'select', required: true, options: guests.map(g => ({ value: g.id, label: g.display_name })) }, ...(kind === 'transport' ? [text('pickupPoint', 'Điểm đón')] : [text('roomNumber', 'Số phòng', true), { key: 'checkInDate', label: 'Ngày nhận phòng', type: 'date' } as Field, { key: 'checkOutDate', label: 'Ngày trả phòng', type: 'date' } as Field]), notes];
  return <div className="border-t pt-4">{error && <p role="alert">{error}</p>}<ResourceWorkspace title={kind === 'transport' ? 'Hành khách' : 'Phân phòng'} endpoint={`/api/v1/${kind}/${record.id}/${kind === 'transport' ? 'passengers' : 'rooms'}`} defaults={{ eventId }} fields={fields} titleKey="guestId" canEdit={false} itemIdKey={kind === 'transport' ? 'guestId' : 'id'} /></div>;
}

function Logistics({ eventId }: { eventId: string }) {
  const [tab, setTab] = useState<'transport' | 'accommodations'>('transport');
  const transportFields: Field[] = [text('name', 'Tên chuyến', true), select('vehicleType', 'Loại xe', [['shuttle_bus', 'Xe khách'], ['van', 'Xe van'], ['car', 'Ô tô']]), number('capacity', 'Số chỗ', 1, 1), dateTime('departureTime', 'Thời gian khởi hành'), text('departureLocation', 'Điểm đi'), text('arrivalLocation', 'Điểm đến'), text('driverContact', 'Liên hệ tài xế'), notes];
  const accommodationFields: Field[] = [text('name', 'Tên nơi lưu trú', true), text('locationAddress', 'Địa chỉ'), number('totalRooms', 'Số phòng', 1, 1), dateTime('checkInTime', 'Nhận phòng'), dateTime('checkOutTime', 'Trả phòng'), { key: 'contactPhone', label: 'Điện thoại', type: 'tel' }, notes];
  return <><div className="flex gap-2 print:hidden"><Button variant={tab === 'transport' ? 'primary' : 'secondary'} onClick={() => setTab('transport')}>Xe đưa đón</Button><Button variant={tab === 'accommodations' ? 'primary' : 'secondary'} onClick={() => setTab('accommodations')}>Lưu trú</Button></div><ResourceWorkspace key={tab} title={tab === 'transport' ? 'Chuyến xe' : 'Nơi lưu trú'} endpoint={`/api/v1/${tab}`} titleKey="name" fields={tab === 'transport' ? transportFields : accommodationFields} eventId={eventId} detail={r => <Assignments kind={tab} record={r} eventId={eventId} />} /></>;
}

function MenuDetails({ record, eventId, onLocked }: { record: RecordData; eventId: string; onLocked:()=>void }) {
  const { isOwner } = useRole(); const [lockOpen, setLockOpen] = useState(false); const [snapshot, setSnapshot] = useState<Record<string, unknown> | null>(null);
  const fields: Field[] = [text('name', 'Tên món', true), number('courseOrder', 'Thứ tự món', 1), select('courseType', 'Loại món', [['appetizer', 'Khai vị'], ['main', 'Món chính'], ['dessert', 'Tráng miệng'], ['beverage', 'Đồ uống']]), { key: 'dietaryFlags', label: 'Chế độ ăn', type: 'tags' }, text('allergens', 'Thành phần dị ứng'), notes];
  return <div className="border-t pt-4 space-y-4"><ResourceWorkspace title="Món ăn" titleKey="name" endpoint={`/api/v1/menus/${record.id}/items`} fields={fields} defaults={{ eventId }} />
    {isOwner && <Button onClick={() => setLockOpen(true)}>Chốt số suất với nhà hàng</Button>}
    {snapshot && <p role="status">Đã lưu bản chốt số {String(snapshot.snapshotVersion)}: {String(snapshot.totalMeals)} suất. Bản chốt giữ nguyên khi danh sách khách thay đổi.</p>}
    {lockOpen && <RecordEditor title="Xác nhận chốt suất ăn" fields={[number('bufferPercentage', 'Dự phòng (%)', 0), notes]} close={() => setLockOpen(false)} save={async body => { const result = await api<{ data: Record<string, unknown> }>(`/api/v1/menus/${record.id}/lock`, { method: 'POST', body: jsonBody(body) }); setSnapshot(result.data); onLocked(); }} />}
  </div>;
}

function Menus({ eventId }: { eventId: string }) {
  const [revision,setRevision] = useState(0);
  const [snapshots,setSnapshots] = useState<RecordData[]>([]);
  const [summary, setSummary] = useState<Record<string, number> | null>(null); const [error, setError] = useState('');
  useEffect(() => { const controller = new AbortController(); api<{ data: Record<string, number> }>(`/api/v1/menus/summary?eventId=${eventId}`, { signal: controller.signal }).then(r => setSummary(r.data)).catch(f => { if (!controller.signal.aborted) setError(f.message); }); return () => controller.abort(); }, [eventId,revision]);
  useEffect(()=>{const c=new AbortController();api<{data:RecordData[]}>(`/api/v1/menus/snapshots?eventId=${eventId}`,{signal:c.signal}).then(r=>setSnapshots(r.data)).catch(f=>{if(!c.signal.aborted)setError(f.message);});return()=>c.abort();},[eventId,revision]);
  return <>{error && <p role="alert">{error}</p>}{summary && <div className="surface-card p-4 flex flex-wrap gap-5"><span>Suất chính: {summary.adultMeals}</span><span>Trẻ em: {summary.childMeals}</span><span>Chay: {summary.vegetarianMeals}</span><span>Đặc biệt: {summary.specialMeals}</span><strong>Tổng: {summary.totalMeals}</strong><span>Chưa chọn món: {summary.missingMealSelectionCount}</span></div>}
    <ResourceWorkspace title="Thực đơn" titleKey="name" endpoint="/api/v1/menus" eventId={eventId} fields={[text('name', 'Tên thực đơn', true), select('mealType', 'Hình thức', [['banquet', 'Tiệc bàn'], ['buffet', 'Buffet'], ['cocktail', 'Cocktail']]), { key: 'description', label: 'Mô tả', type: 'textarea' }, check('isActive', 'Đang sử dụng', true)]} detail={r => <MenuDetails record={r} eventId={eventId} onLocked={()=>setRevision(v=>v+1)} />} /><MealSelections eventId={eventId} onChanged={()=>setRevision(v=>v+1)} />
    {!!snapshots.length&&<section className="surface-card p-5 space-y-3"><h2 className="font-serif text-xl">Lịch sử chốt nhà hàng</h2>{snapshots.map(s=><details key={s.id} className="border-t pt-3"><summary>Bản {String(s.snapshotVersion)} • {String(s.totalMeals)} suất • {new Date(String(s.createdAt)).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}</summary><p>{String(s.notes||'')}</p>{Boolean(s.menuSnapshot)&&<p>Thực đơn: {String((s.menuSnapshot as Record<string,unknown>).name)}</p>}{Boolean(s.menuSnapshot)&&((s.menuSnapshot as {courses?:{id:string;name:string}[]}).courses||[]).map(c=><p key={c.id}>{c.name}</p>)}</details>)}{summary&&Number(snapshots[0].totalMeals)!==summary.totalMeals&&<p role="status" className="text-warning">Số suất hiện tại khác bản chốt gần nhất. Đối chiếu với nhà hàng và tạo bản mới khi cần.</p>}</section>}</>;
}

function TimelineStatus({ eventId, revision }: { eventId: string; revision: number }) {
  type Item = { id: string; title: string; scheduledStartTime: string };
  const [data, setData] = useState<{ current: Item[]; next: Item[]; delayed: Item[]; conflicts: { itemAId: string; itemATitle: string; itemBTitle: string; personName: string }[] } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    const load = () => api<{ data: NonNullable<typeof data> }>(`/api/v1/timeline/today?eventId=${eventId}`, { signal: controller.signal }).then(result => { setData(result.data); setError(''); }).catch(failure => { if (!controller.signal.aborted) setError(failure.message); });
    void load(); const timer = setInterval(() => void load(), 60000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [eventId, revision]);
  return <section className="surface-card p-5 space-y-3"><h2 className="font-serif text-xl">Điều phối hiện tại</h2>{error && <p role="alert">{error}</p>}{data && <>
    <p><strong>Đang diễn ra:</strong> {data.current.map(item => item.title).join(', ') || 'Chưa có hoạt động được đánh dấu bắt đầu.'}</p>
    <p><strong>Tiếp theo:</strong> {data.next.map(item => `${item.title} (${new Date(item.scheduledStartTime).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })})`).join(', ') || 'Không có mốc sắp tới.'}</p>
    {!!data.delayed.length && <p className="text-warning">Chưa bắt đầu dù đã đến giờ: {data.delayed.map(item => item.title).join(', ')}.</p>}
    {data.conflicts.map((conflict, index) => <p key={`${conflict.itemAId}:${index}`} className="text-warning">Trùng lịch {conflict.personName}: {conflict.itemATitle} / {conflict.itemBTitle}.</p>)}
  </>}</section>;
}

function TimelineWorkspace({eventId}:{eventId:string}) {
  const{isOwner}=useRole();const[open,setOpen]=useState(false);const[pending,setPending]=useState<{body:Record<string,unknown>;preview:{affectedCount:number;affectedItems:{id:string;title:string;currentStart:string;newStart:string;version:number}[]}}|null>(null);const[revision,setRevision]=useState(0);const[error,setError]=useState('');const[busy,setBusy]=useState(false);
  return <div className="space-y-5">{isOwner&&<Button variant="secondary" onClick={()=>setOpen(true)}>Dời các mốc chưa diễn ra</Button>}{error&&<p role="alert">{error}</p>}{pending&&<div className="surface-card p-5 space-y-3"><h2 className="font-semibold">Xem trước: {pending.preview.affectedCount} mốc sẽ thay đổi</h2>{pending.preview.affectedItems.map(i=><p key={i.id}>{i.title}: {new Date(i.currentStart).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})} → {new Date(i.newStart).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}</p>)}<div className="flex gap-2"><Button disabled={busy} onClick={async()=>{if(busy)return;setBusy(true);setError('');try{await api('/api/v1/timeline/shift',{method:'POST',body:jsonBody({...pending.body,confirmed:true,expectedVersions:pending.preview.affectedItems.map(i=>({id:i.id,version:i.version}))})});setPending(null);setRevision(v=>v+1);}catch(f){setError((f as Error).message);}finally{setBusy(false);}}}>Xác nhận dời lịch</Button><Button variant="secondary" disabled={busy} onClick={()=>setPending(null)}>Hủy</Button></div></div>}
    <TimelineStatus eventId={eventId} revision={revision}/><ResourceWorkspace onChanged={()=>setRevision(v=>v+1)} key={revision} title="Lịch trình ngày cưới" endpoint="/api/v1/timeline" eventId={eventId} fields={timelineFields}/>
    {open&&<RecordEditor title="Xem trước dời lịch" fields={[{key:'delayMinutes',label:'Số phút dời (âm để sớm hơn)',type:'number',required:true,min:-720,max:720,default:15},dateTime('pivotTime','Chỉ dời các mốc bắt đầu từ (để trống = tất cả mốc chưa diễn ra)')]} close={()=>setOpen(false)} save={async body=>{const payload={...body,eventId};const r=await api<{data:NonNullable<typeof pending>['preview']}>('/api/v1/timeline/shift',{method:'POST',body:jsonBody(payload)});setPending({body:payload,preview:r.data});}}/>}
  </div>;
}

export function LivePlanningWorkspace({ module }: { module: 'support' | 'ideas' | 'preparation' | 'timeline' | 'logistics' | 'menus' }) {
  return <EventWorkspace>{eventId => module === 'preparation' ? <Preparation eventId={eventId} /> : module === 'logistics' ? <Logistics eventId={eventId} /> : module === 'menus' ? <Menus eventId={eventId} /> : module === 'timeline' ? <TimelineWorkspace eventId={eventId}/> : <ResourceWorkspace
    title={module === 'support' ? 'Đội hỗ trợ' : module === 'ideas' ? 'Ý tưởng cưới' : 'Lịch trình ngày cưới'}
    endpoint={module === 'support' ? '/api/v1/support/members' : module === 'ideas' ? '/api/v1/preparation/ideas' : '/api/v1/timeline'}
    eventId={eventId} titleKey={module === 'support' ? 'name' : 'title'} fields={module === 'support' ? supportFields : module === 'ideas' ? ideaFields : timelineFields} actions={module === 'ideas' ? (r,reload)=><IdeaPromotion record={r} reload={reload} /> : undefined}
  />}</EventWorkspace>;
}
