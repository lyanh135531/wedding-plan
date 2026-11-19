'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ResourceWorkspace, Field, RecordEditor, RecordData } from '@/components/common/ResourceWorkspace';
import { api, jsonBody } from '@/lib/api/request';
import { Button } from '@/components/ui/button';
import { useRole } from '@/context/RoleContext';
import { SharingWorkspace } from './SharingWorkspace';
const eventFields: Field[] = [
  { key: 'title', label: 'Tên buổi lễ', required: true }, { key: 'eventType', label: 'Loại buổi lễ', type: 'select', default: 'wedding_party', options: [{ value: 'engagement', label: 'Ăn hỏi' }, { value: 'ancestor_ceremony', label: 'Gia tiên' }, { value: 'wedding_party', label: 'Tiệc cưới' }, { value: 'other', label: 'Khác' }] },
  { key: 'status', label: 'Trạng thái', type: 'select', default: 'tentative', options: [{ value: 'tentative', label: 'Dự kiến' }, { value: 'confirmed', label: 'Đã chốt' }, { value: 'completed', label: 'Đã kết thúc' }, { value: 'cancelled', label: 'Đã hủy' }] },
  { key: 'startTime', label: 'Bắt đầu (giờ Việt Nam)', type: 'datetime-local' }, { key: 'endTime', label: 'Kết thúc', type: 'datetime-local' }, { key: 'confirmDateChange', label: 'Xác nhận đổi ngày sau khi đã xem ảnh hưởng (khi sửa)', type: 'checkbox', editOnly: true },
  { key: 'locationName', label: 'Địa điểm' }, { key: 'locationAddress', label: 'Địa chỉ' }, { key: 'mapUrl', label: 'Link bản đồ', type: 'url' }, { key: 'contactPerson', label: 'Người liên hệ' }, { key: 'contactPhone', label: 'Số điện thoại', type: 'tel' }, { key: 'publicNotes', label: 'Ghi chú chia sẻ', type: 'textarea' }, { key: 'privateNotes', label: 'Ghi chú riêng', type: 'textarea' }, { key: 'isCheckInEnabled', label: 'Cho phép điểm danh', type: 'checkbox', default: true },
];
export function SettingsAdvancedWorkspace() {
  const { isOwner } = useRole(); const router = useRouter(); const [config, setConfig] = useState<RecordData | null>(null); const [events, setEvents] = useState<RecordData[]>([]); const [open, setOpen] = useState(false); const [error, setError] = useState(''); const [revision, setRevision] = useState(0);
  useEffect(() => { if (!isOwner) return; const controller = new AbortController(); Promise.all([api<{ data: RecordData | null }>('/api/v1/configuration', { signal: controller.signal }), api<{ data: RecordData[] }>('/api/v1/events', { signal: controller.signal })]).then(([c,e]) => { setConfig(c.data); setEvents(e.data); }).catch(f => { if (!controller.signal.aborted) setError(f.message); }); return () => controller.abort(); }, [revision, isOwner]);
  if (!isOwner) return null;
  return <div className="space-y-8">{error && <p role="alert" className="text-danger">{error}</p>}<div className="surface-card p-5 space-y-3"><h2 className="text-xl font-serif">Thông tin hai người & Ngân sách chung</h2><Button disabled={!config} onClick={() => setOpen(true)}>Chỉnh sửa thông tin</Button></div>
    {open && config && <RecordEditor title="Thông tin đám cưới" record={config} close={() => setOpen(false)} fields={[{ key: 'groomName', label: 'Họ và tên chú rể', required: true }, { key: 'brideName', label: 'Họ và tên cô dâu', required: true }, { key: 'tentativeDateNote', label: 'Ghi chú thời gian dự kiến' }, { key: 'representativeEventId', label: 'Buổi lễ đại diện', type: 'select', options: events.filter(e => e.status !== 'cancelled').map(e => ({ value: e.id, label: String(e.title) })) }, { key: 'budgetTarget', label: 'Ngân sách mục tiêu (VND, để trống nếu chưa chốt)' }, { key: 'contingencyBudget', label: 'Ngân sách dự phòng (VND)' }]} save={async body => { const r = await api<{ data: RecordData }>('/api/v1/configuration', { method: 'PATCH', body: jsonBody({ ...body, version: config.version }) }); setConfig(r.data); router.refresh(); }} />}
    <ResourceWorkspace title="Buổi lễ" endpoint="/api/v1/events" fields={eventFields} canDelete={false} onChanged={() => { setRevision(v => v + 1); router.refresh(); }} />
    <SharingWorkspace />
  </div>;
}
