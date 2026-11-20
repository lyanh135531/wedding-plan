import * as React from 'react';
import { Check, ChevronDown, Plus, Search, X } from 'lucide-react';
import { cn, removeVietnameseDiacritics } from '@/lib/utils';

const h = React.createElement;

export interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
  badge?: string;
  disabled?: boolean;
}

export interface ComboboxProps {
  id?: string;
  label: string;
  options: ComboboxOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  onCreateNew?: (query: string) => void;
  createNewLabel?: (query: string) => string;
  canCreateNew?: boolean;
  error?: string;
  helperText?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export const Combobox: React.FC<ComboboxProps> = ({
  id: externalId,
  label,
  options,
  value,
  onChange,
  placeholder = 'Chọn hoặc tìm kiếm...',
  onCreateNew,
  createNewLabel = (q) => `+ Tạo mới "${q}"`,
  canCreateNew = false,
  error,
  helperText,
  disabled = false,
  required = false,
  className,
}) => {
  const generatedId = React.useId();
  const inputId = externalId || generatedId;
  const listboxId = `${inputId}-listbox`;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;

  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [activeIndex, setActiveIndex] = React.useState<number>(-1);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  const selectedOption = React.useMemo(
    () => options.find((opt) => opt.value === value) || null,
    [options, value]
  );

  const filteredOptions = React.useMemo(() => {
    if (!query.trim()) return options;
    const normQ = removeVietnameseDiacritics(query.trim());
    return options.filter((opt) => {
      const normLabel = removeVietnameseDiacritics(opt.label);
      const normDesc = opt.description ? removeVietnameseDiacritics(opt.description) : '';
      return normLabel.includes(normQ) || normDesc.includes(normQ);
    });
  }, [options, query]);

  const showCreateOption =
    canCreateNew &&
    onCreateNew &&
    query.trim().length > 0 &&
    !options.some(
      (opt) =>
        removeVietnameseDiacritics(opt.label) === removeVietnameseDiacritics(query.trim())
    );

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  React.useEffect(() => {
    if (isOpen) {
      setActiveIndex(-1);
      const timer = setTimeout(() => searchInputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  React.useEffect(() => {
    if (isOpen && activeIndex >= 0) {
      document.getElementById(`${listboxId}-option-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex, isOpen, listboxId]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    const totalItems = filteredOptions.length + (showCreateOption ? 1 : 0);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => {
        for (let offset = 1; offset <= totalItems; offset++) {
          const next = (prev + offset + totalItems) % totalItems;
          if (!filteredOptions[next]?.disabled) return next;
        }
        return -1;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => {
        const start = prev < 0 ? 0 : prev;
        for (let offset = 1; offset <= totalItems; offset++) {
          const next = (start - offset + totalItems) % totalItems;
          if (!filteredOptions[next]?.disabled) return next;
        }
        return -1;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < filteredOptions.length) {
        const target = filteredOptions[activeIndex];
        if (!target.disabled) handleSelect(target.value);
      } else if (showCreateOption && activeIndex === filteredOptions.length) {
        onCreateNew(query.trim());
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setIsOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === 'Tab') {
      setIsOpen(false);
      triggerRef.current?.focus();
    }
  };

  const describedBy = error ? errorId : helperText ? helperId : undefined;

  return h(
    'div',
    { ref: containerRef, className: cn('relative w-full flex flex-col gap-1.5', className) },
    h(
      'label',
      {
        htmlFor: inputId,
        className: 'text-sm font-medium text-text-main flex items-center gap-1 select-none',
      },
      h('span', null, label),
      required && h('span', { className: 'text-danger font-bold', 'aria-hidden': 'true' }, '*')
    ),
    h('div', { className: 'relative' }, h(
      'button',
      {
        ref: triggerRef,
        id: inputId,
        type: 'button',
        role: 'combobox',
        'aria-expanded': isOpen,
        'aria-controls': listboxId,
        'aria-haspopup': 'listbox',
        'aria-invalid': !!error,
        'aria-required': required,
        'aria-describedby': describedBy,
        disabled,
        onClick: () => !disabled && setIsOpen(!isOpen),
        onKeyDown: handleKeyDown,
        className: cn(
          'w-full min-h-[44px] h-11 pl-3.5 pr-10 text-base md:text-sm text-left bg-surface border rounded-control transition-colors duration-150',
          selectedOption && !disabled && 'pr-20',
          'flex items-center justify-between gap-2',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
          'disabled:bg-black/5 disabled:border-border-subtle disabled:cursor-not-allowed',
          error
            ? 'border-danger bg-danger-bg/20 focus-visible:outline-danger'
            : 'border-border-control hover:border-text-main/70'
        ),
      },
      h(
        'span',
        {
          className: cn(
            'truncate',
            selectedOption ? 'text-text-main font-medium' : 'text-text-muted/70'
          ),
        },
        selectedOption ? selectedOption.label : placeholder
      ),
      h(
        'div',
        { className: 'absolute right-3.5 text-text-muted pointer-events-none' },
        h(ChevronDown, {
          className: cn('w-4 h-4 transition-transform duration-150', isOpen && 'rotate-180'),
        })
      )
    ), selectedOption && !disabled && h('button', {
      type: 'button',
      'aria-label': 'Xóa lựa chọn',
      onClick: (event: React.MouseEvent) => { handleClear(event); triggerRef.current?.focus(); },
      className: 'absolute right-9 top-1 bottom-1 w-9 flex items-center justify-center text-text-muted hover:text-primary hover:bg-page rounded-lg transition-colors',
    }, h(X, { className: 'w-3.5 h-3.5', 'aria-hidden': true }))),
    isOpen &&
      h(
        'div',
        {
          className:
            'combobox-popover absolute z-50 left-0 right-0 top-full mt-2 bg-surface border border-border-control rounded-control shadow-overlay overflow-hidden flex flex-col max-h-80',
        },
        h(
          'div',
          { className: 'combobox-search-row px-3 py-2 border-b border-border-subtle flex items-center gap-2 bg-page/60' },
          h(Search, { className: 'w-4 h-4 text-text-muted shrink-0' }),
          h('input', {
            ref: searchInputRef,
            type: 'text',
            role: 'combobox',
            'aria-label': `Tìm ${label.toLowerCase()}`,
            'aria-expanded': true,
            'aria-controls': listboxId,
            'aria-activedescendant': activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined,
            value: query,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            },
            onKeyDown: handleKeyDown,
            placeholder: 'Gõ để tìm kiếm...',
            className:
              'combobox-search w-full bg-transparent text-sm text-text-main placeholder:text-text-muted focus:outline-none',
          })
        ),
        h(
          'div',
          { id: listboxId, role: 'listbox', 'aria-label': label, className: 'min-h-0 overflow-y-auto py-1.5' },
          filteredOptions.length === 0 && !showCreateOption
            ? h(
                'div',
                { className: 'p-3 text-center text-sm text-text-muted' },
                'Không tìm thấy kết quả'
              )
            : filteredOptions.map((opt, index) => {
                const isSelected = opt.value === value;
                const isItemActive = index === activeIndex;

                return h(
                  'div',
                  {
                    key: opt.value,
                    id: `${listboxId}-option-${index}`,
                    role: 'option',
                    'aria-selected': isSelected,
                    'aria-disabled': !!opt.disabled,
                    onMouseEnter: () => !opt.disabled && setActiveIndex(index),
                    onClick: () => !opt.disabled && handleSelect(opt.value),
                    className: cn(
                      'min-h-[44px] px-3 py-2 flex items-center justify-between gap-2 cursor-pointer text-sm select-none transition-colors',
                      isItemActive && 'bg-[#F0EEE6]',
                      isSelected ? 'font-semibold text-primary' : 'text-text-main',
                      opt.disabled && 'opacity-40 cursor-not-allowed hover:bg-transparent'
                    ),
                  },
                  h(
                    'div',
                    { className: 'flex flex-col' },
                    h('span', null, opt.label),
                    opt.description &&
                      h('span', { className: 'text-xs text-text-muted' }, opt.description)
                  ),
                  h(
                    'div',
                    { className: 'flex items-center gap-2 shrink-0' },
                    opt.badge &&
                      h(
                        'span',
                        {
                          className:
                            'text-xs px-2 py-0.5 rounded bg-black/5 text-text-muted',
                        },
                        opt.badge
                      ),
                    isSelected && h(Check, { className: 'w-4 h-4 text-primary' })
                  )
                );
              }),
          showCreateOption &&
            h(
              'div',
              {
                role: 'option',
                id: `${listboxId}-option-${filteredOptions.length}`,
                'aria-selected': activeIndex === filteredOptions.length,
                onClick: () => {
                  onCreateNew(query.trim());
                  setIsOpen(false);
                },
                className: cn(
                  'min-h-[44px] px-3 py-2.5 flex items-center gap-2 cursor-pointer text-sm font-medium text-primary border-t border-border-subtle hover:bg-primary/5 transition-colors',
                  activeIndex === filteredOptions.length && 'bg-primary/10'
                ),
              },
              h(Plus, { className: 'w-4 h-4 shrink-0' }),
              h('span', null, createNewLabel(query.trim()))
            )
        )
      ),
    error
      ? h('p', { id: errorId, role: 'alert', className: 'text-sm text-danger font-medium mt-0.5' }, error)
      : helperText
      ? h('p', { id: helperId, className: 'text-xs text-text-muted mt-0.5' }, helperText)
      : null
  );
};
