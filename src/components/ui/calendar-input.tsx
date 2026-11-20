'use client';

import * as React from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function parseCalendarDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setHours(0, 0, 0, 0);
  date.setFullYear(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

export function calendarDateValue(date: Date) {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function calendarMonthDays(year: number, month: number) {
  const start = new Date(0);
  start.setHours(0, 0, 0, 0);
  start.setFullYear(year, month, 1);
  start.setDate(1 - (start.getDay() + 6) % 7);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return calendarDateValue(date);
  });
}

export interface CalendarInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'defaultValue' | 'onChange' | 'min' | 'max'> {
  value: string;
  onValueChange: (value: string) => void;
  label: string;
  min?: string;
  max?: string;
}

function displayDate(value: string) {
  const date = value.slice(0, 10);
  return parseCalendarDate(date) ? date.split('-').reverse().join('/') : '';
}

export const CalendarInput = React.forwardRef<HTMLInputElement, CalendarInputProps>(function CalendarInput({
  value, onValueChange, label, min, max, disabled, readOnly, required, className, id, name, onBlur, ...props
}, forwardedRef) {
  const generatedId = React.useId();
  const inputId = id || generatedId;
  const popupId = `${inputId}-calendar`;
  const headingId = `${popupId}-heading`;
  const selected = parseCalendarDate(value.slice(0, 10));
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(() => displayDate(value));
  const [month, setMonth] = React.useState(() => selected || new Date());
  const [active, setActive] = React.useState(() => calendarDateValue(selected || new Date()));
  const [position, setPosition] = React.useState<React.CSSProperties>({ visibility: 'hidden' });
  const fieldRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const popupRef = React.useRef<HTMLDivElement>(null);
  const toggleRef = React.useRef<HTMLButtonElement>(null);
  React.useImperativeHandle(forwardedRef, () => inputRef.current!);

  React.useEffect(() => {
    setDraft(displayDate(value));
    inputRef.current?.setCustomValidity('');
  }, [value]);

  const minDay = min?.slice(0, 10);
  const maxDay = max?.slice(0, 10);
  const allowed = (day: string) => (!minDay || day >= minDay) && (!maxDay || day <= maxDay);
  const close = (restoreFocus = false) => { setOpen(false); if (restoreFocus) toggleRef.current?.focus(); };
  const show = () => {
    if (disabled || readOnly) return;
    let start = value.slice(0, 10) || calendarDateValue(new Date());
    if (minDay && start < minDay) start = minDay;
    if (maxDay && start > maxDay) start = maxDay;
    setMonth(parseCalendarDate(start) || new Date());
    setActive(start);
    setOpen(true);
  };

  React.useEffect(() => {
    if (!open) return;
    const popup = popupRef.current;
    // The top layer avoids clipping inside scrolling dialogs, while keeping the
    // calendar in the same DOM subtree for the parent dialog's focus handling.
    if (popup && typeof popup.showPopover === 'function') popup.showPopover();
    const place = () => {
      const field = fieldRef.current?.getBoundingClientRect();
      const panel = popupRef.current;
      if (!field || !panel) return;
      const width = Math.min(312, window.innerWidth - 24);
      const height = Math.min(panel.offsetHeight, window.innerHeight - 24);
      const below = window.innerHeight - field.bottom - 8;
      const top = below >= height || field.top < height + 8
        ? Math.min(field.bottom + 8, window.innerHeight - height - 12)
        : field.top - height - 8;
      setPosition({ width, left: Math.max(12, Math.min(field.left, window.innerWidth - width - 12)), top: Math.max(12, top), visibility: 'visible' });
    };
    place();
    const timer = setTimeout(() => popupRef.current?.querySelector<HTMLButtonElement>(`[data-day="${active}"]`)?.focus(), 50);
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!fieldRef.current?.contains(target) && !popupRef.current?.contains(target)) setOpen(false);
    };
    const focusOutside = (event: FocusEvent) => {
      const target = event.target as Node;
      if (!fieldRef.current?.contains(target) && !popupRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('focusin', focusOutside);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('focusin', focusOutside);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      if (popup && typeof popup.hidePopover === 'function' && popup.matches(':popover-open')) popup.hidePopover();
    };
    // Opening captures the initially focused date; arrow keys manage later focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  React.useEffect(() => { if (disabled || readOnly) setOpen(false); }, [disabled, readOnly]);

  const choose = (day: string) => {
    onValueChange(day);
    setDraft(displayDate(day));
    inputRef.current?.setCustomValidity('');
    close(true);
  };
  const viewMonth = (year: number, monthNumber: number) => {
    let date = new Date(year, monthNumber, 1);
    let day = calendarDateValue(date);
    if (minDay && day < minDay) { day = minDay; date = parseCalendarDate(day)!; }
    if (maxDay && day > maxDay) { day = maxDay; date = parseCalendarDate(day)!; }
    setMonth(date); setActive(day);
  };
  const keyboardDay = (event: React.KeyboardEvent, day: string) => {
    const date = parseCalendarDate(day)!;
    const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -(date.getDay() + 6) % 7, End: 6 - (date.getDay() + 6) % 7 };
    if (event.key in offsets) date.setDate(date.getDate() + offsets[event.key]);
    else if (event.key === 'PageUp' || event.key === 'PageDown') {
      const dayOfMonth = date.getDate();
      date.setDate(1);
      date.setMonth(date.getMonth() + (event.key === 'PageUp' ? -1 : 1));
      const end = new Date(date); end.setMonth(end.getMonth() + 1, 0);
      date.setDate(Math.min(dayOfMonth, end.getDate()));
    } else return;
    event.preventDefault();
    let target = calendarDateValue(date);
    if (minDay && target < minDay) target = minDay;
    if (maxDay && target > maxDay) target = maxDay;
    const next = parseCalendarDate(target)!;
    setMonth(next); setActive(target);
    requestAnimationFrame(() => popupRef.current?.querySelector<HTMLButtonElement>(`[data-day="${target}"]`)?.focus());
  };

  const year = month.getFullYear();
  const monthNumber = month.getMonth();
  const days = calendarMonthDays(year, monthNumber);
  const firstYear = minDay ? Number(minDay.slice(0, 4)) : Math.min(year, new Date().getFullYear()) - 100;
  const lastYear = maxDay ? Number(maxDay.slice(0, 4)) : Math.max(year, new Date().getFullYear()) + 100;
  const years = Array.from({ length: Math.min(lastYear - firstYear + 1, 1000) }, (_, index) => firstYear + index);
  const today = calendarDateValue(new Date());
  const firstOfMonth = `${String(year).padStart(4, '0')}-${String(monthNumber + 1).padStart(2, '0')}-01`;
  const lastOfMonth = new Date(month); lastOfMonth.setMonth(monthNumber + 1, 0);

  return <div ref={fieldRef} className="relative min-w-0 w-full">
    {name && <input type="hidden" name={name} value={value} />}
    <input {...props} ref={inputRef} id={inputId} type="text" value={draft} disabled={disabled} readOnly={readOnly} required={required}
      inputMode="numeric" placeholder="dd/mm/yyyy" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? popupId : undefined}
      className={cn('w-full h-11 pl-3.5 pr-12', className)}
      onChange={event => {
        const next = event.target.value;
        setDraft(next);
        const parts = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(next);
        const iso = parts ? `${parts[3]}-${parts[2]}-${parts[1]}` : '';
        const valid = !!parseCalendarDate(iso) && allowed(iso);
        event.target.setCustomValidity(next && !valid ? 'Nhập ngày hợp lệ theo định dạng dd/mm/yyyy và trong khoảng cho phép.' : '');
        if (valid || !next) onValueChange(iso);
      }} onBlur={onBlur}
      onKeyDown={event => { props.onKeyDown?.(event); if (!event.defaultPrevented && event.key === 'ArrowDown') { event.preventDefault(); show(); } }} />
    <button ref={toggleRef} type="button" disabled={disabled || readOnly} onClick={() => open ? close() : show()}
      aria-label={`Mở lịch: ${label}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? popupId : undefined}
      className="calendar-toggle absolute right-1 top-1 bottom-1 w-10 inline-flex items-center justify-center rounded-lg text-text-muted hover:bg-page hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
      <CalendarDays className="h-4 w-4" aria-hidden="true" />
    </button>
    {open && <div ref={popupRef} id={popupId} popover="manual" role="dialog" aria-label={`Chọn ngày: ${label}`} className="calendar-popover" style={position}
      onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); } }}>
      <div className="calendar-heading">
        <div className="flex min-w-0 items-center gap-1">
          <select aria-label="Tháng" value={monthNumber} onChange={event => viewMonth(year, Number(event.target.value))}>
            {Array.from({ length: 12 }, (_, index) => <option key={index} value={index}>Tháng {index + 1}</option>)}
          </select>
          <select aria-label="Năm" value={year} onChange={event => viewMonth(Number(event.target.value), monthNumber)}>
            {years.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
        </div>
        <div className="flex shrink-0 gap-0.5">
          <button type="button" aria-label="Tháng trước" disabled={!!minDay && firstOfMonth <= minDay} onClick={() => viewMonth(year, monthNumber - 1)} className="calendar-nav"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" aria-label="Tháng sau" disabled={!!maxDay && calendarDateValue(lastOfMonth) >= maxDay} onClick={() => viewMonth(year, monthNumber + 1)} className="calendar-nav"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
      <p id={headingId} aria-live="polite" className="sr-only">Tháng {monthNumber + 1} năm {year}</p>
      <div role="grid" aria-labelledby={headingId} className="calendar-grid">
        <div role="row" className="calendar-week">
          {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(day => <span key={day} role="columnheader" className="calendar-weekday">{day}</span>)}
        </div>
        {Array.from({ length: 6 }, (_, row) => <div role="row" key={row} className="calendar-week">
          {days.slice(row * 7, row * 7 + 7).map(day => {
            const date = parseCalendarDate(day)!;
            return <button key={day} type="button" role="gridcell" data-day={day} aria-selected={day === value} aria-current={day === today ? 'date' : undefined}
              aria-label={date.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              disabled={!allowed(day)} tabIndex={day === active ? 0 : -1} onFocus={() => setActive(day)}
              onKeyDown={event => keyboardDay(event, day)} onClick={() => choose(day)}
              className={cn('calendar-day', date.getMonth() !== monthNumber && 'calendar-day--outside')}>
              {date.getDate()}
            </button>;
          })}
        </div>)}
      </div>
      <div className="calendar-footer">
        <button type="button" disabled={!!required || !value} onClick={() => choose('')}>Xóa ngày</button>
        <button type="button" disabled={!allowed(today)} onClick={() => choose(today)}>Hôm nay</button>
      </div>
    </div>}
  </div>;
});
