import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CurrencyInput } from '@/components/ui/currency-input';

describe('CurrencyInput Component (src/components/ui/currency-input.tsx)', () => {
  it('renders with formatted display value and ₫ suffix permanently visible', () => {
    const html = renderToStaticMarkup(
      React.createElement(CurrencyInput, {
        label: 'Số tiền đặt cọc',
        value: 15000000n,
        onChange: () => {},
      })
    );
    expect(html).toContain('Số tiền đặt cọc');
    expect(html).toContain('value="15.000.000"');
    expect(html).toContain('₫');
    expect(html).toContain('tabular-nums');
  });

  it('renders empty string in input when value is null', () => {
    const html = renderToStaticMarkup(
      React.createElement(CurrencyInput, {
        label: 'Chi phí chưa có giá',
        value: null,
        placeholder: 'Chưa có giá',
        onChange: () => {},
      })
    );
    expect(html).toContain('value=""');
    expect(html).toContain('placeholder="Chưa có giá"');
  });

  it('renders "0" when value is 0n (confirmed zero) distinguishing from null', () => {
    const html = renderToStaticMarkup(
      React.createElement(CurrencyInput, {
        label: 'Khoản miễn phí',
        value: 0n,
        onChange: () => {},
      })
    );
    expect(html).toContain('value="0"');
  });

  it('specifies inputMode="numeric" for mobile numeric keyboard triggering', () => {
    const html = renderToStaticMarkup(
      React.createElement(CurrencyInput, {
        label: 'Tiền mừng',
        value: 500000n,
        onChange: () => {},
      })
    );
    expect(html).toContain('inputMode="numeric"');
  });

  it('renders red asterisk for required fields and binds error alert message with aria-invalid', () => {
    const html = renderToStaticMarkup(
      React.createElement(CurrencyInput, {
        label: 'Giá chốt hợp đồng',
        value: null,
        required: true,
        error: 'Vui lòng nhập giá chốt hợp đồng',
        onChange: () => {},
      })
    );
    expect(html).toContain('*');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('role="alert"');
    expect(html).toContain('Vui lòng nhập giá chốt hợp đồng');
    expect(html).toContain('border-danger');
  });

  it('renders negative values with leading minus sign when value is negative', () => {
    const html = renderToStaticMarkup(
      React.createElement(CurrencyInput, {
        label: 'Khoản hoàn tiền',
        value: -2000000n,
        allowNegative: true,
        onChange: () => {},
      })
    );
    expect(html).toContain('value="-2.000.000"');
  });
});
