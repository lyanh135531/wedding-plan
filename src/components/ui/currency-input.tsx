import * as React from 'react';
import { cn } from '@/lib/utils';

const h = React.createElement;

export interface CurrencyInputProps {
  id?: string;
  name?: string;
  label: string;
  value: bigint | null;
  onChange: (value: bigint | null) => void;
  required?: boolean;
  error?: string;
  helperText?: string;
  disabled?: boolean;
  allowNegative?: boolean;
  placeholder?: string;
  className?: string;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  id: externalId,
  name,
  label,
  value,
  onChange,
  required = false,
  error,
  helperText,
  disabled = false,
  allowNegative = false,
  placeholder = '0',
  className,
}) => {
  const generatedId = React.useId();
  const inputId = externalId || generatedId;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;

  const formatDisplay = React.useCallback(
    (val: bigint | null): string => {
      if (val === null || val === undefined) return '';
      const isNeg = val < 0n;
      const abs = isNeg ? -val : val;
      const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      return isNeg ? `-${formatted}` : formatted;
    },
    []
  );

  const [displayValue, setDisplayValue] = React.useState<string>(() => formatDisplay(value));

  React.useEffect(() => {
    setDisplayValue(formatDisplay(value));
  }, [value, formatDisplay]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '') {
      setDisplayValue('');
      onChange(null);
      return;
    }

    const isNeg = allowNegative && raw.trim().startsWith('-');
    const digits = raw.replace(/[^\d]/g, '');

    if (!digits) {
      if (isNeg) {
        setDisplayValue('-');
        return;
      }
      setDisplayValue('');
      onChange(null);
      return;
    }

    try {
      let parsed = BigInt(digits);
      if (isNeg && parsed !== 0n) {
        parsed = -parsed;
      }
      const formatted = formatDisplay(parsed);
      setDisplayValue(formatted);
      onChange(parsed);
    } catch {
      // Ignore parse failure
    }
  };

  const handleBlur = () => {
    setDisplayValue(formatDisplay(value));
  };

  const describedBy = error ? errorId : helperText ? helperId : undefined;

  return h(
    'div',
    { className: cn('w-full flex flex-col gap-1.5', className) },
    h(
      'label',
      {
        htmlFor: inputId,
        className: 'text-sm font-medium text-text-main flex items-center gap-1 select-none',
      },
      h('span', null, label),
      required && h('span', { className: 'text-danger font-bold', 'aria-hidden': 'true' }, '*')
    ),
    h(
      'div',
      { className: 'relative flex items-center' },
      h('input', {
        id: inputId,
        name,
        type: 'text',
        inputMode: 'numeric',
        autoComplete: 'off',
        value: displayValue,
        onChange: handleChange,
        onBlur: handleBlur,
        placeholder,
        disabled,
        'aria-invalid': !!error,
        'aria-describedby': describedBy,
        'aria-required': required,
        className: cn(
          'w-full h-11 pl-3 pr-10 text-base text-right text-text-main bg-surface border rounded-control transition-colors duration-150',
          'tabular-nums font-mono',
          'placeholder:text-text-muted/60',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
          'disabled:bg-black/5 disabled:border-border-subtle disabled:cursor-not-allowed',
          error
            ? 'border-danger bg-danger-bg/20 focus-visible:outline-danger'
            : 'border-border-control hover:border-text-main/70'
        ),
      }),
      h(
        'div',
        {
          className:
            'absolute right-3 flex items-center pointer-events-none text-text-muted font-medium select-none',
          'aria-hidden': 'true',
        },
        '₫'
      )
    ),
    error
      ? h('p', { id: errorId, role: 'alert', className: 'text-sm text-danger font-medium mt-0.5' }, error)
      : helperText
      ? h('p', { id: helperId, className: 'text-xs text-text-muted mt-0.5' }, helperText)
      : null
  );
};
