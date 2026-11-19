import * as React from 'react';

export function BrandMark({ className = '' }: { className?: string }) {
  const h = React.createElement;
  return h('svg', { className, viewBox: '0 0 40 40', fill: 'none', 'aria-hidden': true },
    h('circle', { cx: 15, cy: 23, r: 9, stroke: 'currentColor', strokeWidth: 1.3 }),
    h('circle', { cx: 25, cy: 23, r: 9, stroke: 'currentColor', strokeWidth: 1.3 }),
    h('path', { d: 'm20 5 3.5 4.5L20 14l-3.5-4.5L20 5Z', stroke: 'currentColor', strokeWidth: 1.2 }),
    h('path', { d: 'M11 8v4M9 10h4M29 8v4M27 10h4', stroke: 'currentColor', strokeWidth: 1 }),
  );
}
