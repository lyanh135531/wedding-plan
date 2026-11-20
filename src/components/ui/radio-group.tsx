import * as React from 'react';
import { cn } from '@/lib/utils';

const h = React.createElement;

export interface RadioOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface RadioGroupProps {
  id?: string;
  name: string;
  label: string;
  options: RadioOption[];
  value: string;
  onChange: (value: string) => void;
  direction?: 'vertical' | 'horizontal';
  error?: string;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export const RadioGroup: React.FC<RadioGroupProps> = ({
  id: externalId,
  name,
  label,
  options,
  value,
  onChange,
  direction = 'vertical',
  error,
  helperText,
  required = false,
  disabled = false,
  className,
}) => {
  const generatedId = React.useId();
  const groupId = externalId || generatedId;
  const labelId = `${groupId}-label`;
  const errorId = `${groupId}-error`;
  const helperId = `${groupId}-helper`;

  const describedBy = error ? errorId : helperText ? helperId : undefined;

  return h(
    'div',
    {
      role: 'radiogroup',
      'aria-labelledby': labelId,
      'aria-describedby': describedBy,
      'aria-required': required,
      className: cn('w-full flex flex-col gap-2', className),
    },
    h(
      'div',
      {
        id: labelId,
        className: 'text-sm font-medium text-text-main flex items-center gap-1 select-none',
      },
      h('span', null, label),
      required && h('span', { className: 'text-danger font-bold', 'aria-hidden': 'true' }, '*')
    ),
    h(
      'div',
      {
        className: cn(
          'flex',
          direction === 'vertical' ? 'flex-col gap-1' : 'flex-row flex-wrap gap-4'
        ),
      },
      options.map((opt) => {
        const optId = `${groupId}-opt-${opt.value}`;
        const isSelected = value === opt.value;
        const isOptDisabled = disabled || opt.disabled;

        return h(
          'label',
          {
            key: opt.value,
            htmlFor: optId,
            className: cn(
              'min-h-[44px] flex items-start gap-3 py-1.5 cursor-pointer select-none group',
              isOptDisabled && 'cursor-not-allowed opacity-60'
            ),
          },
          h(
            'div',
            { className: 'relative flex items-center justify-center shrink-0 mt-0.5' },
            h('input', {
              id: optId,
              type: 'radio',
              name,
              value: opt.value,
              checked: isSelected,
              disabled: isOptDisabled,
              onChange: () => !isOptDisabled && onChange(opt.value),
              className: 'sr-only',
            }),
            h(
              'div',
              {
                className: cn(
                  'choice-indicator w-5 h-5 rounded-full border transition-colors flex items-center justify-center',
                  'group-focus-within:outline group-focus-within:outline-2 group-focus-within:outline-offset-2 group-focus-within:outline-focus',
                  error
                    ? 'border-danger'
                    : isSelected
                    ? 'border-primary bg-primary'
                    : 'border-border-control bg-surface group-hover:border-text-main/80'
                ),
              },
              isSelected && h('div', { className: 'w-2 h-2 rounded-full bg-surface' })
            )
          ),
          h(
            'div',
            { className: 'flex flex-col text-sm' },
            h(
              'span',
              {
                className: cn(
                  'font-medium',
                  isOptDisabled ? 'text-text-muted' : 'text-text-main'
                ),
              },
              opt.label
            ),
            opt.description &&
              h('span', { className: 'text-xs text-text-muted mt-0.5' }, opt.description)
          )
        );
      })
    ),
    error
      ? h('p', { id: errorId, role: 'alert', className: 'text-sm text-danger font-medium mt-0.5' }, error)
      : helperText
      ? h('p', { id: helperId, className: 'text-xs text-text-muted mt-0.5' }, helperText)
      : null
  );
};
