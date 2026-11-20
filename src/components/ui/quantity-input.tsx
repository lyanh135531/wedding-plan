import * as React from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

const h = React.createElement;

export interface QuantityInputProps {
  id?: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unitLabel?: string;
  disabled?: boolean;
  error?: string;
  helperText?: string;
  className?: string;
}

export const QuantityInput: React.FC<QuantityInputProps> = ({
  id: externalId,
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  unitLabel,
  disabled = false,
  error,
  helperText,
  className,
}) => {
  const generatedId = React.useId();
  const inputId = externalId || generatedId;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;

  const handleDecrement = () => {
    if (disabled || value <= min) return;
    const nextVal = Math.max(min, value - step);
    onChange(nextVal);
  };

  const handleIncrement = () => {
    if (disabled || (max !== undefined && value >= max)) return;
    const nextVal = max !== undefined ? Math.min(max, value + step) : value + step;
    onChange(nextVal);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '') {
      onChange(min);
      return;
    }
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed)) {
      let clamped = parsed;
      if (clamped < min) clamped = min;
      if (max !== undefined && clamped > max) clamped = max;
      onChange(clamped);
    }
  };

  const isMin = value <= min;
  const isMax = max !== undefined && value >= max;
  const describedBy = error ? errorId : helperText ? helperId : undefined;

  return h(
    'div',
    { className: cn('w-full flex flex-col gap-1.5', className) },
    h(
      'label',
      {
        htmlFor: inputId,
        className:
          'text-sm font-medium text-text-main flex items-center justify-between select-none',
      },
      h('span', null, label),
      unitLabel && h('span', { className: 'text-xs text-text-muted' }, `(${unitLabel})`)
    ),
    h(
      'div',
      { className: 'quantity-stepper flex items-center gap-1' },
      h(
        'button',
        {
          type: 'button',
          onClick: handleDecrement,
          disabled: disabled || isMin,
          'aria-label': 'Giảm số lượng',
          className: cn(
            'min-h-[44px] min-w-[44px] h-11 w-11 inline-flex items-center justify-center rounded-control border border-border-control bg-surface text-text-main transition-colors select-none',
            'hover:bg-[#F0EEE6] active:bg-[#E2DFD6]',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
            'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-surface'
          ),
        },
        h(Minus, { className: 'w-4 h-4' })
      ),
      h('input', {
        id: inputId,
        type: 'text',
        inputMode: 'numeric',
        pattern: '[0-9]*',
        value,
        onChange: handleInputChange,
        disabled,
        'aria-invalid': !!error,
        'aria-describedby': describedBy,
        className: cn(
          'flex-1 h-11 text-center text-base font-semibold text-text-main bg-surface border rounded-control transition-colors duration-150 tabular-nums',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
          'disabled:bg-black/5 disabled:border-border-subtle disabled:cursor-not-allowed',
          error
            ? 'border-danger bg-danger-bg/20 focus-visible:outline-danger'
            : 'border-border-control hover:border-text-main/70'
        ),
      }),
      h(
        'button',
        {
          type: 'button',
          onClick: handleIncrement,
          disabled: disabled || isMax,
          'aria-label': 'Tăng số lượng',
          className: cn(
            'min-h-[44px] min-w-[44px] h-11 w-11 inline-flex items-center justify-center rounded-control border border-border-control bg-surface text-text-main transition-colors select-none',
            'hover:bg-[#F0EEE6] active:bg-[#E2DFD6]',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
            'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-surface'
          ),
        },
        h(Plus, { className: 'w-4 h-4' })
      )
    ),
    error
      ? h('p', { id: errorId, role: 'alert', className: 'text-sm text-danger font-medium mt-0.5' }, error)
      : helperText
      ? h('p', { id: helperId, className: 'text-xs text-text-muted mt-0.5' }, helperText)
      : null
  );
};
