import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Button } from '@/components/ui/button';

describe('Button Component (src/components/ui/button.tsx)', () => {
  it('renders primary variant with proper styling and minimum 44px touch target by default', () => {
    const html = renderToStaticMarkup(
      React.createElement(Button, null, 'Lưu thông tin')
    );
    expect(html).toContain('Lưu thông tin');
    expect(html).toContain('bg-primary');
    expect(html).toContain('min-h-[44px]');
    expect(html).toContain('min-w-[44px]');
  });

  it('renders all semantic variants correctly', () => {
    const variants = ['primary', 'secondary', 'ghost', 'danger'] as const;
    for (const v of variants) {
      const html = renderToStaticMarkup(
        React.createElement(Button, { variant: v }, v)
      );
      expect(html).toContain(v);
      if (v === 'secondary') expect(html).toContain('border-border-control');
      if (v === 'danger') expect(html).toContain('bg-danger');
      if (v === 'ghost') expect(html).toContain('hover:bg-black/5');
    }
  });

  it('renders lg size with 48px height for mobile primary action ergonomics', () => {
    const html = renderToStaticMarkup(
      React.createElement(Button, { size: 'lg' }, 'Xác nhận tạo thiệp cưới')
    );
    expect(html).toContain('h-12'); // 48px height
  });

  it('renders loading state with spinner, aria-busy="true", disabled attribute, and loadingText', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        Button,
        { loading: true, loadingText: 'Đang gửi mã xác nhận...' },
        'Gửi mã'
      )
    );
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('disabled=""');
    expect(html).toContain('Đang gửi mã xác nhận...');
    expect(html).toContain('animate-spin');
    expect(html).not.toContain('Gửi mã');
  });

  it('renders left and right icons when not in loading state', () => {
    const leftIcon = React.createElement('span', { id: 'left-ico' }, 'L');
    const rightIcon = React.createElement('span', { id: 'right-ico' }, 'R');

    const html = renderToStaticMarkup(
      React.createElement(
        Button,
        { leftIcon, rightIcon },
        'Tiếp tục'
      )
    );
    expect(html).toContain('id="left-ico"');
    expect(html).toContain('id="right-ico"');
    expect(html).toContain('Tiếp tục');
  });

  it('renders disabled attribute and prevents interaction when disabled is true', () => {
    const html = renderToStaticMarkup(
      React.createElement(Button, { disabled: true }, 'Vô hiệu hóa')
    );
    expect(html).toContain('disabled=""');
    expect(html).toContain('disabled:opacity-50');
  });
});
