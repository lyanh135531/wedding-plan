import * as React from 'react';
import { cn } from '@/lib/utils';

const h = React.createElement;

export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  helperText?: string;
  error?: string;
  required?: boolean;
  leftAddon?: React.ReactNode;
  rightAddon?: React.ReactNode;
  autoFocusOnError?: boolean;
}

export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  (
    {
      className,
      label,
      helperText,
      error,
      required,
      leftAddon,
      rightAddon,
      autoFocusOnError,
      id: externalId,
      disabled,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const inputId = externalId || generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;
    const inputRef = React.useRef<HTMLInputElement | null>(null);

    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    React.useEffect(() => {
      if (error && autoFocusOnError && inputRef.current) {
        inputRef.current.focus();
      }
    }, [error, autoFocusOnError]);

    const describedBy = error ? errorId : helperText ? helperId : undefined;

    return h(
      'div',
      { className: 'w-full flex flex-col gap-1.5' },
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
        leftAddon &&
          h(
            'div',
            { className: 'absolute left-3 flex items-center pointer-events-none text-text-muted' },
            leftAddon
          ),
        h('input', {
          ref: inputRef,
          id: inputId,
          disabled,
          'aria-invalid': !!error,
          'aria-describedby': describedBy,
          'aria-required': required,
          className: cn(
            'w-full h-11 px-3.5 text-base md:text-sm text-text-main bg-surface border rounded-control transition-all duration-150 focus:border-primary focus:ring-4 focus:ring-primary/5',
            'placeholder:text-text-muted/60',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
            'disabled:bg-black/5 disabled:border-border-subtle disabled:cursor-not-allowed',
            leftAddon ? 'pl-10' : 'pl-3',
            rightAddon ? 'pr-10' : 'pr-3',
            error
              ? 'border-danger bg-danger-bg/20 focus-visible:outline-danger'
              : 'border-border-control hover:border-text-main/70',
            className
          ),
          ...props,
        }),
        rightAddon &&
          h(
            'div',
            { className: 'absolute right-3 flex items-center pointer-events-none text-text-muted' },
            rightAddon
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

TextInput.displayName = 'TextInput';
export const Input = TextInput;
