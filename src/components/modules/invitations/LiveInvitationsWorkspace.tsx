'use client';
import React, { useEffect, useState } from 'react';
import { EventWorkspace, ResourceWorkspace, Field, RecordEditor, RecordData } from '@/components/common/ResourceWorkspace';
import { allPages, api, jsonBody } from '@/lib/api/request';
import { useRole } from '@/context/RoleContext';
import { Button } from '@/components/ui/button';

function MarkSent({ record, reload }: { record: RecordData; reload: () => void }) {
  const [open, setOpen] = useState(false); const { isOwner } = useRole();
  return <>{isOwner && record.status !== 'sent' && <Button variant="secondary" onClick={() => setOpen(true)}>Ghi nhận đã gửi</Button>}{open && <RecordEditor title="Xác nhận đã gửi thiệp" fields={[{ key: 'sentDate', label: 'Ngày gửi', type: 'date', required: true }]} close={() => setOpen(false)} save={async body => { await api('/api/v1/invitations/bulk-sent', { method: 'POST', body: jsonBody({ ...body, invitationIds: [record.id] }) }); reload(); }} />}</>;
}
function Invitations({ eventId }: { eventId: string }) {
  const { isOwner } = useRole();
  const [selected, setSelected] = useState<string[]>([]); const [bulkOpen, setBulkOpen] = useState(false); const [revision, setRevision] = useState(0); const [notice, setNotice] = useState('');
  const [guests, setGuests] = useState<{ id: string; display_name: string }[]>([]); const [error, setError] = useState('');
  useEffect(() => { let active = true; allPages<{ id: string; display_name: string }>('/api/v1/guests').then(r => { if (active) setGuests(r); }).catch(f => { if (active) setError(f.message); }); return () => { active = false; }; }, []);
  const options = guests.map(g => ({ value: g.id, label: g.display_name }));
  const fields: Field[] = [{ key: 'card_name', label: 'Tên trên thiệp', required: true }, { key: 'representative_guest_id', label: 'Người đại diện', type: 'select', required: true, options }, { key: 'member_guest_ids', label: 'Thành viên nhận chung thiệp', type: 'multi', required: true, options }, { key: 'delivery_method', label: 'Cách gửi', type: 'select', required: true, default: 'paper', options: [{ value: 'paper', label: 'Thiệp giấy' }, { value: 'electronic', label: 'Thiệp điện tử' }, { value: 'in_person', label: 'Mời trực tiếp' }] }, { key: 'status', label: 'Tiến độ', type: 'select', default: 'save_the_date', options: [{ value: 'save_the_date', label: 'Đã giữ lịch' }, { value: 'preparing', label: 'Đang chuẩn bị' }, { value: 'sent', label: 'Đã gửi' }] }, { key: 'sent_date', label: 'Ngày gửi', type: 'date' }, { key: 'notes', label: 'Ghi chú riêng', type: 'textarea' }];
  return <>{error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}<p className="text-text-muted text-sm">Một thiệp có thể gồm nhiều người. Gửi thiệp không thay đổi xác nhận tham dự của từng khách.</p>
    {isOwner && <Button variant="secondary" disabled={!selected.length} onClick={() => setBulkOpen(true)}>Đánh dấu đã gửi ({selected.length} thiệp đã chọn)</Button>}
    <ResourceWorkspace key={revision} title="Thiệp mời" titleKey="card_name" endpoint="/api/v1/invitations" eventId={eventId} defaults={{ event_id: eventId }} fields={fields} canDelete={false} actions={(r, reload) => <>
      {isOwner && r.status !== 'sent' && <label className="flex gap-2 items-center min-h-11"><input type="checkbox" checked={selected.includes(r.id)} onChange={event => setSelected(ids => event.target.checked ? [...ids, r.id] : ids.filter(id => id !== r.id))}/>Chọn thiệp {String(r.card_name)}</label>}
      <MarkSent record={r} reload={reload}/>
    </>}/>
    {bulkOpen && <RecordEditor title={`Ghi nhận gửi ${selected.length} thiệp`} draftScope={`bulk-invitations:${eventId}`} fields={[{ key: 'sentDate', label: 'Ngày gửi', type: 'date', required: true }]} close={() => setBulkOpen(false)} save={async body => {
      const result = await api<{ updatedCount: number }>('/api/v1/invitations/bulk-sent', { method: 'POST', body: jsonBody({ ...body, invitationIds: selected }) });
      setNotice(`Đã ghi nhận gửi ${result.updatedCount} thiệp. RSVP của khách được giữ nguyên.`); setSelected([]); setRevision(value => value + 1);
    }}/>}</>;
}
export function LiveInvitationsWorkspace() { return <EventWorkspace>{id => <Invitations eventId={id} />}</EventWorkspace>; }
