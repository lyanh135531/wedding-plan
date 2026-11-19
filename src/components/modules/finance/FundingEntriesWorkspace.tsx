'use client';
import React, { useEffect, useState } from 'react';
import { ResourceWorkspace, RecordEditor, RecordData, Field } from '@/components/common/ResourceWorkspace';
import { api, allPages, jsonBody } from '@/lib/api/request';
import { Button } from '@/components/ui/button';
function VoidFunding({ record, reload }: { record: RecordData; reload: () => void }) {
  const [open, setOpen] = useState(false);
  return record.isVoided ? <span>Đã hủy</span> : <><Button variant="secondary" onClick={() => setOpen(true)}>Hủy ghi nhận</Button>{open && <RecordEditor title="Hủy khoản đóng góp" fields={[{ key: 'voided_reason', label: 'Lý do hủy', required: true, type: 'textarea' }]} close={() => setOpen(false)} save={async body => { await api(`/api/v1/finance/funding-entries/${record.id}/void`, { method: 'POST', body: jsonBody(body) }); reload(); }} />}</>;
}
export function FundingEntriesWorkspace({ onChanged }: { onChanged: () => void }) {
  const [costs, setCosts] = useState<{ id: string; name: string }[]>([]); const [error, setError] = useState('');
  useEffect(() => { let active = true; allPages<{ id: string; name: string }>('/api/v1/finance/costs').then(r => { if (active) setCosts(r); }).catch(f => { if (active) setError(f.message); }); return () => { active = false; }; }, []);
  const fields: Field[] = [{ key: 'contributorName', label: 'Người đóng góp', required: true }, { key: 'entryType', label: 'Loại đóng góp', type: 'select', default: 'cash_fund', options: [{ value: 'cash_fund', label: 'Đã nhận vào quỹ' }, { value: 'pledged_unreceived', label: 'Cam kết chưa nhận' }, { value: 'direct_vendor_payment', label: 'Trả trực tiếp nhà cung cấp' }] }, { key: 'amount', label: 'Số tiền (VND)', required: true }, { key: 'contributionDate', label: 'Thời điểm đóng góp (giờ Việt Nam)', type: 'datetime-local', required: true }, { key: 'linkedCostItemId', label: 'Khoản chi (bắt buộc khi trả hộ)', type: 'select', options: costs.map(c => ({ value: c.id, label: c.name })) }, { key: 'notes', label: 'Ghi chú', type: 'textarea' }];
  return <>{error && <p role="alert">{error}</p>}<ResourceWorkspace title="Nguồn tiền đóng góp" titleKey="contributorName" endpoint="/api/v1/finance/funding-entries" fields={fields} canEdit={false} canDelete={false} onChanged={onChanged} preparePayload={body => ({ contributor_name: body.contributorName, entry_type: body.entryType, amount: body.amount, contribution_date: body.contributionDate, linked_cost_item_id: body.linkedCostItemId, notes: body.notes })} actions={(r,reload) => <VoidFunding record={r} reload={reload} />} /></>;
}
