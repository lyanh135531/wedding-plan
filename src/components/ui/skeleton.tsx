import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular' | 'card' | 'table-row';
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  variant = 'rectangular',
  width,
  height,
  style,
  ...props
}) => {
  const variantStyles = {
    text: 'h-4 w-full rounded',
    circular: 'rounded-full aspect-square',
    rectangular: 'rounded-control',
    card: 'rounded-card h-28 w-full p-4',
    'table-row': 'h-12 w-full rounded-control',
  };

  const computedStyle: React.CSSProperties = {
    width: width !== undefined ? width : undefined,
    height: height !== undefined ? height : undefined,
    ...style,
  };

  return React.createElement('div', {
    'aria-hidden': 'true',
    style: computedStyle,
    className: cn(
      'animate-pulse bg-[#EAE8E1] transition-opacity duration-150',
      variantStyles[variant],
      className
    ),
    ...props,
  });
};
