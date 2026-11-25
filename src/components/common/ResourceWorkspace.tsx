'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { api, jsonBody } from '@/lib/api/request';
import { useRole } from '@/context/RoleContext';
import { useEventScope } from '@/context/EventScopeContext';
import { Button } from '@/components/ui/button';
import { ModalDialog } from '@/components/ui/dialog';
import { MultiSelect } from '@/components/ui/multi-select';
import { CalendarInput } from '@/components/ui/calendar-input';
import { Pagination } from '@/components/ui/pagination';
import { usePagination } from './usePagination';
import { removeVietnameseDiacritics } from '@/lib/utils';

export type RecordData = { id: string; version?: number; metadata?: Record<string, unknown>; [key: string]: unknown };
export type Field = {
  key: string; label: string; type?: 'text' | 'textarea' | 'number' | 'date' | 'datetime-local' | 'checkbox' | 'url' | 'tel' | 'select' | 'tags' | 'multi';
  required?: boolean; min?: number; max?: number; default?: unknown; options?: { value: string; label: string }[]; editOnly?: boolean;
};
export const controlClass = 'w-full min-h-11 rounded-control border border-border-control bg-surface px-3.5 py-2.5 text-sm';

export function EventWorkspace({ children }: { children: (eventId: string) => React.ReactNode }) {
  const { currentScope, availableEvents, setScope } = useEventScope();
  const active = availableEvents.filter(e => !e.isCancelled);
  const eventId = active.some(e => e.id === currentScope) ? currentScope : active[0]?.id || '';
  return <div className="space-y-5">
    {active.length > 0 && <label className="block max-w-md space-y-2 print:hidden">Buổi lễ đang quản lý
      <select className={controlClass} value={eventId} onChange={e => setScope(e.target.value)}>{active.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
    </label>}
    {eventId ? <React.Fragment key={eventId}>{children(eventId)}</React.Fragment> : <div className="surface-card p-6">Chưa có buổi lễ. <a href="/settings" className="underline text-primary">Thêm buổi lễ trong Cài đặt</a> để bắt đầu.</div>}
  </div>;
}

export function initialValues(fields: Field[], record?: RecordData): Record<string, unknown> {
  return Object.fromEntries(fields.map(field => {
    let value = record?.[field.key] ?? record?.metadata?.[field.key] ?? field.default ?? (field.type === 'checkbox' ? false : '');
    if (field.type === 'tags') value = Array.isArray(value) ? value.map(v=>field.options?.find(o=>o.value===v)?.label || v).join(', ') : value;
    if (field.type === 'multi') value = Array.isArray(value) ? value : [];
    if (field.type === 'date' && value) value = String(value).slice(0, 10);
    if (field.type === 'datetime-local' && value) value = new Date(new Date(String(value)).getTime() + 7 * 3600000).toISOString().slice(0, 16);
    return [field.key, value];
  }));
}

export function fieldPayload(fields: Field[], values: Record<string, unknown>) {
  return Object.fromEntries(fields.map(field => {
    const value = values[field.key];
    if (field.type === 'checkbox') return [field.key, Boolean(value)];
    if (field.type === 'multi') return [field.key, Array.isArray(value) ? value : []];
    if (field.type === 'number') return [field.key, value === '' ? null : Number(value)];
    if (field.type === 'tags') return [field.key, String(value || '').split(',').map(v => v.trim()).filter(Boolean)];
    if (field.type === 'datetime-local') return [field.key, value ? new Date(`${value}:00+07:00`).toISOString() : null];
    return [field.key, value === '' ? null : value];
  }));
}

export function RecordEditor({ title, fields, record, save, close, draftScope }: {
  title: string; fields: Field[]; record?: RecordData; save: (payload: Record<string, unknown>) => Promise<void>; close: () => void; draftScope?: string;
}) {
  const visible = fields.filter(f => !f.editOnly || record);
  const [values, setValues] = useState(() => initialValues(visible, record));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [restored,setRestored] = useState(false);
  const [draftReady,setDraftReady] = useState(false);
  const [staleDraft,setStaleDraft] = useState<Record<string,unknown>|null>(null);
  const [needsLogin,setNeedsLogin] = useState(false);
  const {userId} = useRole();
  const lock = useRef(false);
  const id = useId();
  const { registerDirtyForm, unregisterDirtyForm, currentScope } = useEventScope();
  const storageKey = userId && typeof window !== 'undefined' ? `wedding-draft:${userId}:${window.location.pathname}:${draftScope||title}:${record?.id||'new'}:${currentScope}` : null;
  const initial = useRef(JSON.stringify(values));
  const dirty = JSON.stringify(values) !== initial.current;
  useEffect(()=>{
    if(storageKey)try{const raw=sessionStorage.getItem(storageKey);if(raw){const draft=JSON.parse(raw);if(draft.expiresAt>Date.now()&&draft.values&&typeof draft.values==='object'){if(draft.version===(record?.version||null)){setValues(Object.fromEntries(visible.map(f=>[f.key,draft.values[f.key]??initialValues(visible,record)[f.key]])));setRestored(true);}else setStaleDraft(draft.values);}else if(draft.expiresAt<=Date.now())sessionStorage.removeItem(storageKey);}}catch{}
    setDraftReady(true);
  },[storageKey]);
  useEffect(()=>{if(storageKey&&draftReady&&dirty)try{sessionStorage.setItem(storageKey,JSON.stringify({values,version:record?.version||null,expiresAt:Date.now()+2*3600000}));}catch{}},[storageKey,draftReady,dirty,values,record?.version]);
  useEffect(() => { registerDirtyForm(id, dirty); return () => unregisterDirtyForm(id); }, [id, dirty, registerDirtyForm, unregisterDirtyForm]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
  const dismiss = () => { if (!lock.current && (!dirty || window.confirm('Bỏ các thay đổi chưa lưu?'))) { if(storageKey)try{sessionStorage.removeItem(storageKey);}catch{} close(); } };
  return <ModalDialog isOpen title={title} onClose={dismiss}>
    <form className="space-y-4" onSubmit={async e => {
      e.preventDefault(); if (lock.current) return; lock.current = true; setSaving(true); setError('');
      try { await save(fieldPayload(visible, values)); if(storageKey)try{sessionStorage.removeItem(storageKey);}catch{} close(); }
      catch (failure) { setError((failure as Error).message); setNeedsLogin((failure as {status?:number}).status===401); }
      finally { lock.current = false; setSaving(false); }
    }}>
      {error && <p role="alert" className="text-danger whitespace-pre-wrap">{error}</p>}
      {restored && <p role="status">Đã khôi phục bản nháp chưa lưu của tài khoản này. Kiểm tra nội dung trước khi lưu.</p>}
      {needsLogin&&<a className="underline text-primary" href={`/login?returnTo=${encodeURIComponent(typeof window!=='undefined'?window.location.pathname:'/overview')}`}>Đăng nhập lại để tiếp tục. Bản nháp được giữ tối đa 2 giờ.</a>}
      {staleDraft&&<details className="border p-3"><summary>Bản ghi đã có phiên bản mới. Xem bản nháp cũ trước khi quyết định.</summary>{visible.map(f=><p key={f.key}><strong>{f.label}:</strong> {String(staleDraft[f.key]??'')}</p>)}<Button type="button" variant="secondary" onClick={()=>{setValues(Object.fromEntries(visible.map(f=>[f.key,staleDraft[f.key]??values[f.key]])));setStaleDraft(null);setRestored(true);}}>Dùng bản nháp để tiếp tục chỉnh sửa</Button></details>}
      {visible.map(field => <div className="block space-y-2 text-sm" key={field.key}>
        <label className="font-medium" htmlFor={`${id}-${field.key}`}>{field.label}{field.required ? ' *' : ''}</label>
        {field.type === 'multi' ? <MultiSelect id={`${id}-${field.key}`} label={field.label} options={field.options || []} required={field.required} disabled={saving} value={values[field.key] as string[]} onChange={selected => setValues(v => ({ ...v, [field.key]: selected }))} /> : field.type === 'select' ? <select id={`${id}-${field.key}`} className={controlClass} required={field.required} disabled={saving} value={String(values[field.key] ?? '')} onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))}>
          <option value="">Chọn {field.label.toLowerCase()}</option>{field.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select> : field.type === 'date' ? <CalendarInput id={`${id}-${field.key}`} label={field.label} className={controlClass} required={field.required} disabled={saving} value={String(values[field.key] ?? '')} onValueChange={date => setValues(v => ({ ...v, [field.key]: date }))} /> : field.type === 'textarea' ? <textarea id={`${id}-${field.key}`} className={controlClass} rows={3} disabled={saving} required={field.required} value={String(values[field.key] ?? '')} onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))} /> :
          <input id={`${id}-${field.key}`} className={field.type === 'checkbox' ? 'block h-6 w-6' : controlClass} type={field.type === 'tags' ? 'text' : field.type || 'text'} required={field.required} disabled={saving}
            min={field.min} max={field.max} maxLength={5000} step={field.type === 'number' ? 1 : undefined}
            {...(field.type === 'checkbox' ? { checked: Boolean(values[field.key]), onChange: (e: React.ChangeEvent<HTMLInputElement>) => setValues(v => ({ ...v, [field.key]: e.target.checked })) } : { value: String(values[field.key] ?? ''), onChange: (e: React.ChangeEvent<HTMLInputElement>) => setValues(v => ({ ...v, [field.key]: e.target.value })) })} />}
        {field.type === 'tags' && <span className="text-xs text-text-muted">Phân cách bằng dấu phẩy.</span>}
      </div>)}
      <div className="flex justify-end gap-3"><Button type="button" variant="secondary" disabled={saving} onClick={dismiss}>Đóng</Button><Button type="submit" loading={saving}>Lưu</Button></div>
    </form>
  </ModalDialog>;
}

export function ResourceWorkspace({ title, endpoint, eventId, fields, defaults = {}, titleKey = 'title', canEdit = true, canDelete = true, canCreate = true, paginate = true, detail, actions, itemIdKey = 'id', onChanged, preparePayload }: {
  title: string; endpoint: string; eventId?: string; fields: Field[]; defaults?: Record<string, unknown>; titleKey?: string;
  canEdit?: boolean; canDelete?: boolean; canCreate?: boolean; paginate?: boolean; itemIdKey?: string; onChanged?: () => void;
  preparePayload?: (body: Record<string, unknown>) => Record<string, unknown>;
  detail?: (record: RecordData) => React.ReactNode; actions?: (record: RecordData, reload: () => void) => React.ReactNode;
}) {
  const { isOwner } = useRole();
  const [records, setRecords] = useState<RecordData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState<RecordData | 'new' | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const lock = useRef(false);
  const requestKey = useRef({ body: '', key: '' });
  const reload = () => { setRevision(v => v + 1); onChanged?.(); };
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    const url = eventId ? `${endpoint}?eventId=${encodeURIComponent(eventId)}` : endpoint;
    api<{ data: RecordData[] }>(url, { signal: controller.signal }).then(result => { if (!controller.signal.aborted) setRecords(result.data); })
      .catch(f => { if (!controller.signal.aborted) setError(f.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [endpoint, eventId, revision]);
  const filtered = records.filter(r => removeVietnameseDiacritics(JSON.stringify(r)).toLowerCase().includes(removeVietnameseDiacritics(search).toLowerCase()));
  const pagination = usePagination(filtered, { defaultPageSize: 10, resetKey: `${endpoint}:${eventId ?? ''}:${search}` });
  const visibleRecords = paginate ? pagination.pagedItems : filtered;
  return <section className="space-y-4">
    <div className="flex flex-wrap gap-3 justify-between items-center"><h2 className="font-serif text-2xl">{title}</h2><div className="flex gap-2 print:hidden"><Button variant="secondary" onClick={reload} disabled={loading}>Tải lại</Button><Button variant="secondary" onClick={()=>window.print()} disabled={loading || !!error}>In danh sách</Button>{isOwner && canCreate && <Button disabled={loading || !!error} onClick={() => setEditor('new')}>Thêm mới</Button>}</div></div>
    <input aria-label={`Tìm trong ${title.toLowerCase()}`} placeholder="Tìm kiếm…" className={`${controlClass} print:hidden`} value={search} onChange={e => setSearch(e.target.value)} />
    {notice && <p role="status" className="text-success">{notice}</p>}
    {error && <p role="alert" className="text-danger">{error}</p>}
    {loading ? <p role="status">Đang tải…</p> : !error && <>
      {!filtered.length && <div className="surface-card p-6 text-text-muted">{records.length ? 'Không có kết quả phù hợp.' : 'Chưa có dữ liệu. Thêm bản ghi đầu tiên để bắt đầu.'}</div>}
      <div className="space-y-3">{visibleRecords.map(record => <article key={record.id} className="surface-card p-5 space-y-3">
        <h3 className="font-semibold break-words">{fields.find(f=>f.key===titleKey)?.options?.find(o=>o.value===record[titleKey])?.label || String(record[titleKey] ?? '')}</h3>
        <dl className="grid sm:grid-cols-2 gap-2 text-sm">{fields.filter(f => f.key !== titleKey).map(field => {
          const value = record[field.key] ?? record.metadata?.[field.key];
          if (value === null || value === undefined || value === '') return null;
          const shown = field.type === 'checkbox' ? value ? 'Có' : 'Không' : field.type === 'select' ? field.options?.find(o => o.value === value)?.label || String(value) : field.type === 'datetime-local' ? new Date(String(value)).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : Array.isArray(value) ? value.map(item => field.options?.find(option => option.value === item)?.label || item).join(', ') : String(value);
          return <div key={field.key} className="break-words"><dt className="text-text-muted">{field.label}</dt><dd className="whitespace-pre-wrap">{field.type === 'url' && /^https?:\/\//i.test(String(value)) ? <a className="underline text-primary" href={String(value)} target="_blank" rel="noopener noreferrer">Mở liên kết</a> : shown}</dd></div>;
        })}</dl>
        <div className="flex flex-wrap gap-2 print:hidden">
          {isOwner && canEdit && <Button variant="secondary" onClick={() => setEditor(record)}>Sửa</Button>}
          {isOwner && canDelete && <Button variant="secondary" disabled={deleting} onClick={async () => {
            if (lock.current || !window.confirm('Xóa bản ghi này? Các liên kết liên quan có thể bị ảnh hưởng.')) return;
            lock.current = true; setDeleting(true); setError(''); setNotice('');
            try { await api(`${endpoint}/${record[itemIdKey]}${record.version ? `?version=${record.version}` : ''}`, { method: 'DELETE' }); setNotice('Đã xóa.'); reload(); }
            catch (f) { setError((f as Error).message); } finally { lock.current = false; setDeleting(false); }
          }}>Xóa</Button>}
          {detail && <Button variant="secondary" onClick={() => setSelected(v => v === record.id ? null : record.id)}>{selected === record.id ? 'Đóng chi tiết' : 'Chi tiết'}</Button>}
          {actions?.(record, reload)}
        </div>
        {selected === record.id && detail?.(record)}
      </article>)}</div>
      {paginate && filtered.length > 0 && <Pagination className="print:hidden" currentPage={pagination.currentPage} pageSize={pagination.pageSize} totalItems={pagination.totalItems} onPageChange={pagination.setCurrentPage} onPageSizeChange={pagination.setPageSize} pageSizeOptions={[10, 25, 50, 100]} unitLabel="bản ghi" />}
    </>}
    {editor && <RecordEditor draftScope={endpoint} title={`${editor === 'new' ? 'Thêm' : 'Sửa'} ${title.toLowerCase()}`} fields={fields} record={editor === 'new' ? undefined : editor} close={() => setEditor(null)} save={async payload => {
      const body = jsonBody(preparePayload ? preparePayload(payload) : { ...defaults, ...(eventId ? { eventId } : {}), ...payload, ...(editor !== 'new' && editor.version ? { version: editor.version } : {}) });
      if (requestKey.current.body !== body) requestKey.current = { body, key: crypto.randomUUID() };
      await api(editor === 'new' ? endpoint : `${endpoint}/${editor[itemIdKey]}`, { method: editor === 'new' ? 'POST' : 'PATCH', body, headers: { 'Idempotency-Key': requestKey.current.key } });
      requestKey.current = { body: '', key: '' };
      setNotice('Đã lưu thay đổi.'); reload();
    }} />}
  </section>;
}
