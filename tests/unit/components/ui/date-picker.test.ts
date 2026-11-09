import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DatePicker } from '@/components/ui/date-picker';

describe('DatePicker Component (src/components/ui/date-picker.tsx)', () => {
  it('renders standard date input with Vietnamese formatted preview (dd/mm/yyyy)', () => {
    const html = renderToStaticMarkup(
      React.createElement(DatePicker, {
        label: 'Ngày tổ chức lễ cưới',
        value: '2028-03-15',
        onChange: () => {},
      })
    );
    expect(html).toContain('Ngày tổ chức lễ cưới');
    expect(html).toContain('value="2028-03-15"');
    expect(html).toContain('(15/03/2028)');
  });

  it('renders "Chưa chốt ngày" checkbox when onToggleUnset is provided', () => {
    const html = renderToStaticMarkup(
      React.createElement(DatePicker, {
        label: 'Ngày tiệc cưới',
        value: null,
        isUnset: false,
        onToggleUnset: () => {},
        onChange: () => {},
      })
    );
    expect(html).toContain('Chưa chốt ngày');
    expect(html).toContain('type="checkbox"');
  });

  it('renders note input instead of date input when isUnset is true', () => {
    const html = renderToStaticMarkup(
      React.createElement(DatePicker, {
        label: 'Ngày dạm ngõ',
        value: null,
        isUnset: true,
        unsetTextNote: 'Sau Tết âm lịch 2028',
        onToggleUnset: () => {},
        onChange: () => {},
      })
    );
    expect(html).toContain('Ghi chú mốc thời gian dự kiến');
    expect(html).toContain('value="Sau Tết âm lịch 2028"');
    expect(html).not.toContain('type="date"');
  });

  it('renders time picker input when includeTime is true', () => {
    const html = renderToStaticMarkup(
      React.createElement(DatePicker, {
        label: 'Giờ đón khách',
        value: '2028-03-15',
        includeTime: true,
        timeValue: '17:30',
        onChange: () => {},
      })
    );
    expect(html).toContain('type="time"');
    expect(html).toContain('value="17:30"');
  });

  it('renders error message when error prop is set', () => {
    const html = renderToStaticMarkup(
      React.createElement(DatePicker, {
        label: 'Ngày thanh toán',
        value: null,
        error: 'Ngày thanh toán không được để trống',
        onChange: () => {},
      })
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('Ngày thanh toán không được để trống');
  });
});
