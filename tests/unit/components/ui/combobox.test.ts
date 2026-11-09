import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Combobox } from '@/components/ui/combobox';

describe('Combobox Component (src/components/ui/combobox.tsx)', () => {
  const options = [
    { value: 'event-1', label: 'Tiệc cưới Nhà Gái', description: 'Trưa Chủ Nhật' },
    { value: 'event-2', label: 'Lễ Thành Hôn Nhà Trai', description: 'Tối Chủ Nhật' },
    { value: 'event-3', label: 'Lễ Ăn Hỏi', disabled: true },
  ];

  it('renders combobox button with label and selected option label', () => {
    const html = renderToStaticMarkup(
      React.createElement(Combobox, {
        label: 'Buổi tiệc tham dự',
        options,
        value: 'event-1',
        onChange: () => {},
      })
    );
    expect(html).toContain('Buổi tiệc tham dự');
    expect(html).toContain('Tiệc cưới Nhà Gái');
    expect(html).toContain('role="combobox"');
    expect(html).toContain('aria-expanded="false"');
  });

  it('renders placeholder when value is null', () => {
    const html = renderToStaticMarkup(
      React.createElement(Combobox, {
        label: 'Buổi tiệc',
        options,
        value: null,
        placeholder: 'Chọn buổi tiệc...',
        onChange: () => {},
      })
    );
    expect(html).toContain('Chọn buổi tiệc...');
  });

  it('renders clear button when an option is selected', () => {
    const html = renderToStaticMarkup(
      React.createElement(Combobox, {
        label: 'Nhóm khách',
        options,
        value: 'event-2',
        onChange: () => {},
      })
    );
    expect(html).toContain('aria-label="Xóa lựa chọn"');
  });

  it('renders red asterisk for required fields and connects error alerts', () => {
    const html = renderToStaticMarkup(
      React.createElement(Combobox, {
        label: 'Mối quan hệ',
        options,
        value: null,
        required: true,
        error: 'Vui lòng chọn mối quan hệ',
        onChange: () => {},
      })
    );
    expect(html).toContain('*');
    expect(html).toContain('role="alert"');
    expect(html).toContain('Vui lòng chọn mối quan hệ');
  });
});
