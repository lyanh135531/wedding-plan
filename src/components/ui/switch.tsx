import * as React from 'react';
import { cn } from '@/lib/utils';

const h = React.createElement;

export interface SwitchProps {
  id?: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  error?: string;
  className?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  id: externalId,
  label,
  description,
  checked,
  onChange,
  disabled = false,
  error,
  className,
}) => {
  const generatedId = React.useId();
  const switchId = externalId || generatedId;
  const labelId = `${switchId}-label`;
  const descId = `${switchId}-desc`;

  const handleToggle = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onChange(!checked);
    }
  };

  return h(
    'div',
    { className: cn('flex flex-col gap-1', className) },
    h(
      'div',
      {
        className: cn(
          'min-h-[44px] flex items-center justify-between gap-4 py-1.5 select-none cursor-pointer',
          disabled && 'cursor-not-allowed opacity-60'
        ),
        onClick: handleToggle,
      },
      h(
        'div',
        { className: 'flex flex-col text-sm pr-2' },
        h(
          'span',
          {
            id: labelId,
            className: cn('font-medium', disabled ? 'text-text-muted' : 'text-text-main'),
          },
          label
        ),
        description &&
          h('span', { id: descId, className: 'text-xs text-text-muted mt-0.5' }, description)
      ),
      h(
        'button',
        {
          id: switchId,
          type: 'button',
          role: 'switch',
          'aria-checked': checked,
          'aria-labelledby': labelId,
          'aria-describedby': description ? descId : undefined,
          disabled,
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            handleToggle();
          },
          onKeyDown: handleKeyDown,
          className: cn(
            'switch-control relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
            'disabled:cursor-not-allowed',
            checked ? 'bg-primary' : 'bg-border-control'
          ),
        },
        h('span', {
          'aria-hidden': 'true',
          className: cn(
            'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface shadow ring-0 transition duration-200 ease-in-out',
            checked ? 'translate-x-5' : 'translate-x-0'
          ),
        })
      )
    ),
    error &&
      h('p', { role: 'alert', className: 'text-sm text-danger font-medium -mt-1' }, error)
  );
};
