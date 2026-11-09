import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QuantityInput } from '@/components/ui/quantity-input';

describe('QuantityInput Component (src/components/ui/quantity-input.tsx)', () => {
  it('renders minus button, centered input, plus button, and unit label', () => {
    const html = renderToStaticMarkup(
      React.createElement(QuantityInput, {
        label: 'Số bàn tiệc',
        value: 15,
        unitLabel: 'bàn',
        onChange: () => {},
      })
    );
    expect(html).toContain('Số bàn tiệc');
    expect(html).toContain('(bàn)');
    expect(html).toContain('value="15"');
    expect(html).toContain('aria-label="Giảm số lượng"');
    expect(html).toContain('aria-label="Tăng số lượng"');
    expect(html).toContain('min-h-[44px]');
    expect(html).toContain('min-w-[44px]');
  });

  it('disables minus button when value reaches min bound', () => {
    const html = renderToStaticMarkup(
      React.createElement(QuantityInput, {
        label: 'Số ghế phụ',
        value: 0,
        min: 0,
        onChange: () => {},
      })
    );
    // Find the minus button
    expect(html).toContain('aria-label="Giảm số lượng"');
    expect(html).toContain('disabled=""');
  });

  it('disables plus button when value reaches max bound', () => {
    const html = renderToStaticMarkup(
      React.createElement(QuantityInput, {
        label: 'Số lượng thiệp tối đa',
        value: 50,
        max: 50,
        onChange: () => {},
      })
    );
    expect(html).toContain('aria-label="Tăng số lượng"');
    expect(html).toContain('disabled=""');
  });

  it('renders error message and aria-invalid on input field', () => {
    const html = renderToStaticMarkup(
      React.createElement(QuantityInput, {
        label: 'Số khách',
        value: 0,
        error: 'Số khách phải lớn hơn 0',
        onChange: () => {},
      })
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('Số khách phải lớn hơn 0');
    expect(html).toContain('aria-invalid="true"');
  });
});
