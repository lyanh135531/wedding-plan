'use client';

import * as React from 'react';
import { Search } from 'lucide-react';
import { removeVietnameseDiacritics } from '@/lib/utils';

export interface MultiSelectProps {
  id: string;
  label: string;
  options: { value: string; label: string; disabled?: boolean }[];
  value: string[];
  onChange: (value: string[]) => void;
  required?: boolean;
  disabled?: boolean;
}

/** A checkable list: selecting several items never requires Ctrl/Cmd. */
export function MultiSelect({ id, label, options, value, onChange, required, disabled }: MultiSelectProps) {
  const [query, setQuery] = React.useState('');
  const [invalid, setInvalid] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement>(null);
  const filtered = options.filter(option => removeVietnameseDiacritics(option.label).includes(removeVietnameseDiacritics(query.trim())));

  return <div className="multi-select-field">
    <select id={id} className="sr-only" multiple required={required} disabled={disabled} value={value} tabIndex={-1}
      aria-label={label} aria-hidden="true" onChange={() => {}} onInvalid={event => {
        event.preventDefault(); setInvalid(true); listRef.current?.focus();
      }}>
      {options.map(option => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
    </select>
    <div ref={listRef} role="group" tabIndex={-1} aria-label={label} aria-invalid={invalid}
      aria-describedby={invalid ? `${id}-error` : `${id}-hint`} aria-disabled={disabled}
      className="multi-select-panel overflow-hidden rounded-xl border border-border-control bg-surface">
      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 border-b border-border-subtle bg-page/50">
        <span id={`${id}-hint`} className="text-xs text-text-muted">{value.length ? `Đã chọn ${value.length} mục` : 'Chọn một hoặc nhiều mục'}</span>
        {value.length > 0 && <button type="button" disabled={disabled} onClick={() => { onChange([]); setInvalid(false); }} className="text-xs font-medium text-primary hover:underline disabled:opacity-50">Bỏ chọn tất cả</button>}
      </div>
      {options.length > 5 && <div className="relative px-2.5 py-2 border-b border-border-subtle">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" aria-hidden="true" />
        <input aria-label={`Tìm ${label.toLowerCase()}`} type="search" value={query} disabled={disabled}
          onChange={event => setQuery(event.target.value)} placeholder="Tìm trong danh sách…" className="w-full pl-9 pr-3 py-2" />
      </div>}
      <div className="max-h-44 overflow-y-auto overscroll-contain p-1.5">
        {filtered.length ? filtered.map(option => <label key={option.value}
          className={`flex items-center gap-3 min-h-11 px-2.5 py-2 rounded-lg text-sm transition-colors ${value.includes(option.value) ? 'bg-primary/5 text-primary' : 'hover:bg-page'} ${disabled || option.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
          <input type="checkbox" checked={value.includes(option.value)} disabled={disabled || option.disabled}
            onChange={event => {
              onChange(event.target.checked ? [...value, option.value] : value.filter(item => item !== option.value));
              setInvalid(false);
            }} />
          <span>{option.label}</span>
        </label>) : <p className="px-3 py-5 text-center text-sm text-text-muted">{query ? 'Không tìm thấy kết quả.' : 'Chưa có mục để chọn.'}</p>}
      </div>
    </div>
    {invalid && <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs text-danger">Vui lòng chọn ít nhất một mục.</p>}
  </div>;
}
