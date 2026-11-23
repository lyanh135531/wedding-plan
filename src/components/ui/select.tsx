import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const h = React.createElement;

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  error?: string;
  required?: boolean;
  options?: SelectOption[];
  containerClassName?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      containerClassName,
      label,
      helperText,
      error,
      required,
      options,
      children,
      id: externalId,
      disabled,
      style,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const selectId = externalId || generatedId;
    const errorId = `${selectId}-error`;
    const helperId = `${selectId}-helper`;
    const describedBy = error ? errorId : helperText ? helperId : undefined;

    return h(
      'div',
      { className: cn('w-full flex flex-col gap-1.5', containerClassName) },
      label &&
        h(
          'label',
          {
            htmlFor: selectId,
            className: 'text-sm font-medium text-text-main flex items-center gap-1 select-none whitespace-nowrap',
          },
          h('span', null, label),
          required && h('span', { className: 'text-danger font-bold', 'aria-hidden': 'true' }, '*')
        ),
      h(
        'div',
        { className: 'relative flex items-center w-full' },
        h(
          'select',
          {
            ref,
            id: selectId,
            disabled,
            required,
            'aria-invalid': !!error,
            'aria-describedby': describedBy,
            'aria-required': required,
            className: cn(
              'w-full h-11 pl-3.5 pr-10 text-base md:text-sm text-text-main bg-surface border rounded-control transition-all duration-150',
              'focus:border-primary focus:ring-4 focus:ring-primary/5',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
              'disabled:bg-black/5 disabled:border-border-subtle disabled:cursor-not-allowed',
              'appearance-none bg-none cursor-pointer truncate leading-[42px]',
              error
                ? 'border-danger bg-danger-bg/20 focus-visible:outline-danger'
                : 'border-border-control hover:border-text-main/70',
              className
            ),
            style: {
              backgroundImage: 'none',
              ...style,
            },
            ...props,
          },
          options
            ? options.map((opt) =>
                h('option', { key: opt.value, value: opt.value, disabled: opt.disabled }, opt.label)
              )
            : children
        ),
        h(
          'div',
          {
            className:
              'pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-text-muted',
          },
          h(ChevronDown, { className: 'w-4 h-4 stroke-[1.75]' })
        )
      ),
      error
        ? h('p', { id: errorId, role: 'alert', className: 'text-sm text-danger font-medium mt-0.5' }, error)
        : helperText
        ? h('p', { id: helperId, className: 'text-xs text-text-muted mt-0.5' }, helperText)
        : null
    );
  }
);

Select.displayName = 'Select';
