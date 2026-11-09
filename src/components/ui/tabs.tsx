import * as React from 'react';
import { cn } from '@/lib/utils';

const h = React.createElement;

export interface TabItem {
  id: string;
  label: string;
  badge?: string | number;
  disabled?: boolean;
  icon?: React.ReactNode;
}

export interface TabNavigationProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: 'underline' | 'pill';
  className?: string;
}

export const TabNavigation: React.FC<TabNavigationProps> = ({
  tabs,
  activeTab,
  onChange,
  variant = 'underline',
  className,
}) => {
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = index;

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextIndex = (index + 1) % tabs.length;
      while (tabs[nextIndex]?.disabled && nextIndex !== index) {
        nextIndex = (nextIndex + 1) % tabs.length;
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      nextIndex = (index - 1 + tabs.length) % tabs.length;
      while (tabs[nextIndex]?.disabled && nextIndex !== index) {
        nextIndex = (nextIndex - 1 + tabs.length) % tabs.length;
      }
    }

    if (nextIndex !== index && !tabs[nextIndex]?.disabled) {
      tabRefs.current[nextIndex]?.focus();
      onChange(tabs[nextIndex].id);
    }
  };

  return h(
    'div',
    {
      role: 'tablist',
      className: cn(
        'w-full flex items-center gap-1 overflow-x-auto select-none no-scrollbar',
        variant === 'underline' && 'border-b border-border-subtle',
        variant === 'pill' && 'p-1 bg-[#FAF9F5] rounded-control border border-border-subtle',
        className
      ),
    },
    tabs.map((tab, idx) => {
      const isActive = activeTab === tab.id;
      const isDisabled = tab.disabled;

      const underlineClasses = cn(
        'min-h-[44px] px-4 py-2.5 text-sm font-medium border-b-2 -mb-[1px] transition-colors flex items-center gap-2 whitespace-nowrap',
        isActive
          ? 'border-primary text-primary font-semibold'
          : 'border-transparent text-text-muted hover:text-text-main hover:border-border-control',
        isDisabled && 'opacity-40 cursor-not-allowed hover:border-transparent'
      );

      const pillClasses = cn(
        'min-h-[40px] px-4 py-2 text-sm font-medium rounded-control transition-colors flex items-center gap-2 whitespace-nowrap',
        isActive
          ? 'bg-primary text-white shadow-sm'
          : 'text-text-muted hover:text-text-main hover:bg-black/5',
        isDisabled && 'opacity-40 cursor-not-allowed hover:bg-transparent'
      );

      return h(
        'button',
        {
          key: tab.id,
          ref: (el: HTMLButtonElement | null) => {
            tabRefs.current[idx] = el;
          },
          type: 'button',
          role: 'tab',
          'aria-selected': isActive,
          'aria-controls': `panel-${tab.id}`,
          id: `tab-${tab.id}`,
          tabIndex: isActive ? 0 : -1,
          disabled: isDisabled,
          onClick: () => !isDisabled && onChange(tab.id),
          onKeyDown: (e: React.KeyboardEvent) => handleKeyDown(e, idx),
          className: cn(
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
            variant === 'underline' ? underlineClasses : pillClasses
          ),
        },
        tab.icon && h('span', { className: 'inline-flex shrink-0' }, tab.icon),
        h('span', null, tab.label),
        tab.badge !== undefined &&
          h(
            'span',
            {
              className: cn(
                'px-2 py-0.5 text-xs rounded-full font-medium tabular-nums',
                isActive
                  ? variant === 'pill'
                    ? 'bg-white/20 text-white'
                    : 'bg-primary/10 text-primary'
                  : 'bg-black/5 text-text-muted'
              ),
            },
            tab.badge
          )
      );
    })
  );
};

export const Tabs = TabNavigation;
