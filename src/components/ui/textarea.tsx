import * as React from 'react';
import { cn } from '@/lib/utils';

const h = React.createElement;

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  helperText?: string;
  error?: string;
  required?: boolean;
  maxCharacters?: number;
}

export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  (
    {
      className,
      label,
      helperText,
      error,
      required,
      maxCharacters,
      value,
      defaultValue,
      onChange,
      id: externalId,
      disabled,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const textareaId = externalId || generatedId;
    const errorId = `${textareaId}-error`;
    const helperId = `${textareaId}-helper`;
    const counterId = `${textareaId}-counter`;

    const [charCount, setCharCount] = React.useState<number>(() => {
      if (typeof value === 'string') return value.length;
      if (typeof defaultValue === 'string') return defaultValue.length;
      return 0;
    });

    React.useEffect(() => {
      if (typeof value === 'string') {
        setCharCount(value.length);
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setCharCount(e.target.value.length);
      if (onChange) {
        onChange(e);
      }
    };

    const describedByParts = [
      error ? errorId : null,
      helperText ? helperId : null,
      maxCharacters ? counterId : null,
    ].filter(Boolean);
    const describedBy = describedByParts.length > 0 ? describedByParts.join(' ') : undefined;
    const isOverLimit = maxCharacters ? charCount > maxCharacters : false;

    return h(
      'div',
      { className: 'w-full flex flex-col gap-1.5' },
      h(
        'div',
        { className: 'flex items-center justify-between' },
        h(
          'label',
          {
            htmlFor: textareaId,
            className: 'text-sm font-medium text-text-main flex items-center gap-1 select-none',
          },
          h('span', null, label),
          required && h('span', { className: 'text-danger font-bold', 'aria-hidden': 'true' }, '*')
        ),
        maxCharacters &&
          h(
            'span',
            {
              id: counterId,
              'aria-live': 'polite',
              className: cn(
                'text-xs',
                isOverLimit ? 'text-danger font-semibold' : 'text-text-muted'
              ),
            },
            `${charCount} / ${maxCharacters} ký tự`
          )
      ),
      h('textarea', {
        ref,
        id: textareaId,
        value,
        defaultValue,
        onChange: handleChange,
        disabled,
        required,
        'aria-invalid': !!error || isOverLimit,
        'aria-describedby': describedBy,
        'aria-required': required,
        className: cn(
          'w-full min-h-[100px] p-3 text-base text-text-main bg-surface border rounded-control transition-colors duration-150',
          'placeholder:text-text-muted/60 resize-y',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
          'disabled:bg-black/5 disabled:border-border-subtle disabled:cursor-not-allowed',
          error || isOverLimit
            ? 'border-danger bg-danger-bg/20 focus-visible:outline-danger'
            : 'border-border-control hover:border-text-main/70',
          className
        ),
        ...props,
      }),
      error
        ? h('p', { id: errorId, role: 'alert', className: 'text-sm text-danger font-medium mt-0.5' }, error)
        : helperText
        ? h('p', { id: helperId, className: 'text-xs text-text-muted mt-0.5' }, helperText)
        : null
    );
  }
);

TextArea.displayName = 'TextArea';
export const Textarea = TextArea;
