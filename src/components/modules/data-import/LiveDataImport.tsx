'use client';
import React, { useRef, useState } from 'react';
import { IMPORT_COLUMNS, readGuestFile } from '@/lib/import/read-file';
import { api, jsonBody } from '@/lib/api/request';
import { useRole } from '@/context/RoleContext';
import { Button } from '@/components/ui/button';
import { controlClass } from '@/components/common/ResourceWorkspace';

interface Batch { batchId: string; totalRows: number; validRows: number; errorRows: number; rows: { rowIndex: number; isValid: boolean; errorMessages: string[] }[] }
export function LiveDataImport() {
  const { isOwner } = useRole(); const [rows, setRows] = useState<string[][]>([]); const [mapping, setMapping] = useState<Record<string, number>>({});
  const [name, setName] = useState(''); const [batch, setBatch] = useState<Batch | null>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false); const [notice, setNotice] = useState(''); const lock = useRef(false);
  const run = async (action: () => Promise<void>) => { if (lock.current) return; lock.current = true; setBusy(true); setError(''); try { await action(); } catch (f) { setError((f as Error).message); } finally { lock.current = false; setBusy(false); } };
  if (!isOwner) return <p>Chỉ chủ sở hữu được nhập dữ liệu.</p>;
  return <section className="space-y-5 max-w-4xl"><h1 className="text-2xl font-serif">Nhập danh sách khách mời</h1><p>Chọn tệp → ghép cột → kiểm tra → xác nhận nhập. Dữ liệu khách chỉ được tạo khi bạn xác nhận bước cuối.</p>
    {error && <p role="alert" className="text-danger whitespace-pre-wrap">{error}</p>}{notice && <p role="status">{notice}</p>}
    <label className="block space-y-2">Tệp CSV hoặc XLSX (tối đa 5 MB, 2.000 khách)<input className={controlClass} type="file" accept=".csv,.xlsx" disabled={busy} onChange={e => {
      const file = e.target.files?.[0]; if (!file) return;
      void run(async () => { const data = await readGuestFile(file); setRows(data); setName(file.name); setBatch(null); setDone(false); setNotice(''); setMapping(Object.fromEntries(IMPORT_COLUMNS.map(([key, label]) => [key, data[0].findIndex(h => h.trim().toLowerCase() === key || h.trim().toLowerCase() === label.toLowerCase())]))); }); e.target.value = '';
    }} /></label>
    {!!rows.length && !batch && <div className="surface-card p-5 space-y-4"><h2 className="font-semibold">Ghép cột — {rows.length - 1} dòng</h2>{IMPORT_COLUMNS.map(([key, label]) => <label className="block" key={key}>{label}{key === 'display_name' && ' *'}<select className={controlClass} value={mapping[key] ?? -1} disabled={busy} onChange={e => setMapping(v => ({ ...v, [key]: Number(e.target.value) }))}><option value={-1}>Không nhập cột này</option>{rows[0].map((header, i) => <option key={i} value={i}>{header || `Cột ${i + 1}`}</option>)}</select></label>)}
      <p className="text-sm">Số điện thoại cần giữ dưới dạng văn bản để không mất số 0 đầu. Tệp XLSX không được chứa công thức.</p>
      <Button disabled={busy || !(mapping.display_name >= 0)} onClick={() => void run(async () => {
        const data = rows.slice(1).map(row => Object.fromEntries(IMPORT_COLUMNS.filter(([key]) => mapping[key] >= 0).map(([key]) => [key, (row[mapping[key]] || '').trim()])));
        const result = await api<{ data: Batch }>('/api/v1/import/stage', { method: 'POST', body: jsonBody({ file_name: name, rows: data }) }); setBatch(result.data);
      })}>Kiểm tra dữ liệu</Button>
    </div>}
    {batch && <div className="surface-card p-5 space-y-4"><h2 className="font-semibold">{done ? 'Kết quả nhập' : 'Kiểm tra trước khi nhập'}</h2><p>{batch.totalRows} dòng • {batch.validRows} hợp lệ • {batch.errorRows} lỗi</p>
      <ul className="space-y-2 max-h-80 overflow-auto">{batch.rows.filter(r => !r.isValid).map(r => <li key={r.rowIndex} className="text-danger">Dòng {r.rowIndex + 1}: {r.errorMessages.join('; ')}</li>)}</ul>
      {!done ? <div className="flex flex-wrap gap-3"><Button disabled={busy || batch.errorRows > 0} onClick={() => {
        if (!window.confirm(`Nhập ${batch.validRows} khách vào danh sách thật?`)) return;
        void run(async () => { const result = await api<{ data: { committedCount: number } }>(`/api/v1/import/${batch.batchId}/commit`, { method: 'POST' }); setDone(true); setNotice(`Đã nhập ${result.data.committedCount} khách. Tải lại yêu cầu này sẽ không tạo trùng cùng lô.`); });
      }}>Xác nhận nhập {batch.validRows} khách</Button><Button variant="secondary" disabled={busy} onClick={() => setBatch(null)}>Quay lại sửa cột</Button></div> : <div className="flex gap-3"><a href="/guests" className="underline text-primary">Mở danh sách khách</a><Button variant="secondary" disabled={busy} onClick={() => {
        if (!window.confirm('Hoàn tác lô nhập? Chỉ được hoàn tác nếu khách chưa được sửa hoặc liên kết vào nghiệp vụ khác.')) return;
        void run(async () => { await api(`/api/v1/import/${batch.batchId}/rollback`, { method: 'POST' }); setBatch(null); setRows([]); setDone(false); setNotice('Đã hoàn tác lô nhập.'); });
      }}>Hoàn tác lô nhập</Button></div>}
    </div>}
  </section>;
}
