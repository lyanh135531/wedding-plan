import * as React from 'react';
import { Calendar, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const h = React.createElement;

export interface DatePickerProps {
  id?: string;
  label: string;
  value: string | null;
  onChange: (date: string | null) => void;
  isUnset?: boolean;
  onToggleUnset?: (unset: boolean) => void;
  unsetTextNote?: string;
  onChangeUnsetTextNote?: (note: string) => void;
  includeTime?: boolean;
  timeValue?: string | null;
  onChangeTime?: (time: string | null) => void;
  required?: boolean;
  error?: string;
  helperText?: string;
  minDate?: string;
  maxDate?: string;
  disabled?: boolean;
  className?: string;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  id: externalId,
  label,
  value,
  onChange,
  isUnset = false,
  onToggleUnset,
  unsetTextNote = '',
  onChangeUnsetTextNote,
  includeTime = false,
  timeValue,
  onChangeTime,
  required = false,
  error,
  helperText,
  minDate,
  maxDate,
  disabled = false,
  className,
}) => {
  const generatedId = React.useId();
  const inputId = externalId || generatedId;
  const unsetCheckboxId = `${inputId}-unset`;
  const noteInputId = `${inputId}-note`;
  const timeInputId = `${inputId}-time`;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val ? val : null);
  };

  const handleUnsetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    if (onToggleUnset) {
      onToggleUnset(checked);
    }
    if (checked) {
      onChange(null);
    }
  };

  const formattedDisplay = React.useMemo(() => {
    if (!value) return '';
    const parts = value.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return value;
  }, [value]);

  const describedBy = error ? errorId : helperText ? helperId : undefined;

  return h(
    'div',
    { className: cn('w-full flex flex-col gap-2', className) },
    h(
      'div',
      { className: 'flex items-center justify-between' },
      h(
        'label',
        {
          htmlFor: inputId,
          className: 'text-sm font-medium text-text-main flex items-center gap-1 select-none',
        },
        h('span', null, label),
        required &&
          !isUnset &&
          h('span', { className: 'text-danger font-bold', 'aria-hidden': 'true' }, '*')
      ),
      onToggleUnset &&
        h(
          'label',
          {
            htmlFor: unsetCheckboxId,
            className:
              'flex items-center gap-2 cursor-pointer select-none text-xs text-text-muted hover:text-text-main',
          },
          h('input', {
            id: unsetCheckboxId,
            type: 'checkbox',
            checked: isUnset,
            onChange: handleUnsetChange,
            disabled,
            className:
              'w-4 h-4 rounded text-primary focus:ring-focus focus:ring-2 border-border-control cursor-pointer',
          }),
          h('span', null, 'Chưa chốt ngày')
        )
    ),
    isUnset
      ? h(
          'div',
          {
            className:
              'flex flex-col gap-1.5 p-3 rounded-control bg-warning-bg/40 border border-warning/30',
          },
          h(
            'label',
            { htmlFor: noteInputId, className: 'text-xs font-medium text-warning' },
            'Ghi chú mốc thời gian dự kiến (tùy chọn)'
          ),
          h('input', {
            id: noteInputId,
            type: 'text',
            value: unsetTextNote,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
              onChangeUnsetTextNote?.(e.target.value),
            disabled,
            placeholder: 'Ví dụ: Sau Tết âm lịch 2028, Chờ xem ngày...',
            className:
              'w-full h-10 px-3 text-sm bg-surface border border-border-control rounded-control focus-visible:outline-2 focus-visible:outline-focus',
          })
        )
      : h(
          'div',
          { className: 'flex flex-wrap items-center gap-2' },
          h(
            'div',
            { className: 'relative flex-1 min-w-[160px] flex items-center' },
            h(
              'div',
              {
                className:
                  'absolute left-3 flex items-center pointer-events-none text-text-muted',
              },
              h(Calendar, { className: 'w-4 h-4' })
            ),
            h('input', {
              id: inputId,
              type: 'date',
              value: value || '',
              min: minDate,
              max: maxDate,
              onChange: handleDateChange,
              disabled: disabled || isUnset,
              required: required && !isUnset,
              'aria-invalid': !!error,
              'aria-describedby': describedBy,
              className: cn(
                'w-full h-11 pl-10 pr-3 text-base text-text-main bg-surface border rounded-control transition-colors duration-150',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                'disabled:bg-black/5 disabled:border-border-subtle disabled:cursor-not-allowed',
                error
                  ? 'border-danger bg-danger-bg/20 focus-visible:outline-danger'
                  : 'border-border-control hover:border-text-main/70'
              ),
            })
          ),
          includeTime &&
            h(
              'div',
              { className: 'relative w-32 flex items-center' },
              h(
                'div',
                {
                  className:
                    'absolute left-3 flex items-center pointer-events-none text-text-muted',
                },
                h(Clock, { className: 'w-4 h-4' })
              ),
              h('input', {
                id: timeInputId,
                type: 'time',
                value: timeValue || '',
                onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                  onChangeTime?.(e.target.value ? e.target.value : null),
                disabled: disabled || isUnset,
                'aria-label': 'Giờ',
                className: cn(
                  'w-full h-11 pl-10 pr-2 text-base text-text-main bg-surface border rounded-control transition-colors duration-150',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                  'disabled:bg-black/5 disabled:border-border-subtle disabled:cursor-not-allowed',
                  'border-border-control hover:border-text-main/70'
                ),
              })
            ),
          formattedDisplay &&
            h(
              'span',
              {
                className:
                  'text-xs text-text-muted select-none ml-1 hidden sm:inline-block',
              },
              `(${formattedDisplay})`
            )
        ),
    error
      ? h('p', { id: errorId, role: 'alert', className: 'text-sm text-danger font-medium mt-0.5' }, error)
      : helperText
      ? h('p', { id: helperId, className: 'text-xs text-text-muted mt-0.5' }, helperText)
      : null
  );
};
