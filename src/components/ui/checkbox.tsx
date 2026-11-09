import * as React from 'react';
import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

const h = React.createElement;

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  indeterminate?: boolean;
  error?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      className,
      label,
      description,
      indeterminate = false,
      checked = false,
      disabled = false,
      id: externalId,
      error,
      onChange,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const inputId = externalId || generatedId;
    const internalRef = React.useRef<HTMLInputElement | null>(null);

    React.useImperativeHandle(ref, () => internalRef.current as HTMLInputElement);

    React.useEffect(() => {
      if (internalRef.current) {
        internalRef.current.indeterminate = indeterminate;
      }
    }, [indeterminate]);

    const isCheckedOrIndeterminate = checked || indeterminate;

    return h(
      'div',
      { className: 'flex flex-col gap-1' },
      h(
        'label',
        {
          htmlFor: inputId,
          className: cn(
            'min-h-[44px] flex items-start gap-3 py-1.5 cursor-pointer select-none group',
            disabled && 'cursor-not-allowed opacity-60',
            className
          ),
        },
        h(
          'div',
          { className: 'relative flex items-center justify-center shrink-0 mt-0.5' },
          h('input', {
            ref: internalRef,
            id: inputId,
            type: 'checkbox',
            checked,
            disabled,
            onChange,
            'aria-invalid': !!error,
            className: 'sr-only',
            ...props,
          }),
          h(
            'div',
            {
              className: cn(
                'w-5 h-5 rounded-[4px] border transition-colors flex items-center justify-center',
                'group-focus-within:outline group-focus-within:outline-2 group-focus-within:outline-offset-2 group-focus-within:outline-focus',
                error
                  ? 'border-danger'
                  : isCheckedOrIndeterminate
                  ? 'border-primary bg-primary text-white'
                  : 'border-border-control bg-surface group-hover:border-text-main/80'
              ),
            },
            indeterminate
              ? h(Minus, { className: 'w-3.5 h-3.5 stroke-[3]' })
              : checked
              ? h(Check, { className: 'w-3.5 h-3.5 stroke-[3]' })
              : null
          )
        ),
        (label || description) &&
          h(
            'div',
            { className: 'flex flex-col text-sm' },
            label &&
              h(
                'span',
                {
                  className: cn(
                    'font-medium',
                    disabled ? 'text-text-muted' : 'text-text-main'
                  ),
                },
                label
              ),
            description &&
              h('span', { className: 'text-xs text-text-muted mt-0.5' }, description)
          )
      ),
      error &&
        h('p', { role: 'alert', className: 'text-sm text-danger font-medium -mt-1 ml-8' }, error)
    );
  }
);

Checkbox.displayName = 'Checkbox';
