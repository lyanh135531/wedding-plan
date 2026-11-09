import * as React from 'react';
import { cn } from '@/lib/utils';

const h = React.createElement;

export interface AvatarProps {
  src?: string | null;
  alt?: string;
  fallback: string;
  size?: 'sm' | 'default' | 'lg' | 'xl';
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = 'Ảnh đại diện',
  fallback,
  size = 'default',
  className,
}) => {
  const [imageError, setImageError] = React.useState(false);

  const initials = React.useMemo(() => {
    if (!fallback) return '?';
    const words = fallback.trim().split(/\s+/);
    if (words.length === 1) {
      return words[0].slice(0, 2).toUpperCase();
    }
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }, [fallback]);

  const sizeStyles = {
    sm: 'w-8 h-8 text-xs',
    default: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg',
  };

  const showImage = src && !imageError;

  return h(
    'div',
    {
      role: 'img',
      'aria-label': alt || fallback,
      className: cn(
        'relative inline-flex items-center justify-center rounded-full overflow-hidden bg-primary/10 text-primary font-semibold select-none shrink-0 border border-border-subtle',
        sizeStyles[size],
        className
      ),
    },
    showImage
      ? h('img', {
          src,
          alt,
          onError: () => setImageError(true),
          className: 'w-full h-full object-cover',
        })
      : h('span', null, initials)
  );
};
