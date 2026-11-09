import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StatusBadge } from '@/components/ui/status-badge';

describe('StatusBadge Component (src/components/ui/status-badge.tsx)', () => {
  it('always contains readable text and never naked icons or colored dots alone', () => {
    const html = renderToStaticMarkup(
      React.createElement(StatusBadge, {
        text: 'Đã xác nhận',
        variant: 'success',
      })
    );
    expect(html).toContain('Đã xác nhận');
    expect(html).toContain('bg-success-bg');
    expect(html).toContain('text-success');
    expect(html).toContain('rounded-full');
  });

  it('renders all semantic variants with correct design token classes', () => {
    const variants = [
      { v: 'success', text: 'Đã hoàn thành', bg: 'bg-success-bg', clr: 'text-success' },
      { v: 'warning', text: 'Chờ duyệt', bg: 'bg-warning-bg', clr: 'text-warning' },
      { v: 'danger', text: 'Quá hạn', bg: 'bg-danger-bg', clr: 'text-danger' },
      { v: 'info', text: 'Chỉ xem', bg: 'bg-info-bg', clr: 'text-info' },
      { v: 'neutral', text: 'Nháp', bg: 'bg-[#EAE8E1]', clr: 'text-text-muted' },
    ] as const;

    for (const item of variants) {
      const html = renderToStaticMarkup(
        React.createElement(StatusBadge, {
          text: item.text,
          variant: item.v,
        })
      );
      expect(html).toContain(item.text);
      expect(html).toContain(item.bg);
      expect(html).toContain(item.clr);
    }
  });

  it('renders with optional icon and sm size', () => {
    const icon = React.createElement('span', { id: 'dot-icon' }, '•');
    const html = renderToStaticMarkup(
      React.createElement(StatusBadge, {
        text: 'Đang gửi',
        variant: 'info',
        size: 'sm',
        icon,
      })
    );
    expect(html).toContain('id="dot-icon"');
    expect(html).toContain('Đang gửi');
    expect(html).toContain('text-[11px]');
  });
});
