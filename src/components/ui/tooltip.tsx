import * as React from 'react';
import { cn } from '@/lib/utils';

const h = React.createElement;

export interface TooltipProps {
  content: React.ReactNode;
  children?: React.ReactElement;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delayMs?: number;
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delayMs = 200,
  className,
}) => {
  const [isVisible, setIsVisible] = React.useState(false);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const tooltipId = React.useId();

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => setIsVisible(true), delayMs);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const positionStyles = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const trigger = children
    ? React.cloneElement(children, {
        'aria-describedby': isVisible ? tooltipId : undefined,
      })
    : null;

  return h(
    'div',
    {
      className: 'relative inline-flex',
      onMouseEnter: showTooltip,
      onMouseLeave: hideTooltip,
      onFocus: showTooltip,
      onBlur: hideTooltip,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') hideTooltip();
      },
    },
    trigger,
    isVisible &&
      h(
        'div',
        {
          id: tooltipId,
          role: 'tooltip',
          className: cn(
            'absolute z-50 px-2.5 py-1.5 text-xs font-normal text-white bg-text-main rounded shadow-md pointer-events-none whitespace-nowrap',
            'animate-in fade-in zoom-in-95 duration-100',
            positionStyles[position],
            className
          ),
        },
        content
      )
  );
};
