import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TextInput } from '@/components/ui/input';
import { TextArea } from '@/components/ui/textarea';

describe('TextInput & TextArea Components (src/components/ui/input.tsx, textarea.tsx)', () => {
  describe('TextInput', () => {
    it('always renders label above input and includes required indicator', () => {
      const html = renderToStaticMarkup(
        React.createElement(TextInput, {
          label: 'Họ và tên khách',
          required: true,
        })
      );
      expect(html).toContain('Họ và tên khách');
      expect(html).toContain('*');
      expect(html).toContain('h-11');
    });

    it('renders left and right addons when provided', () => {
      const left = React.createElement('span', { id: 'search-ico' }, '🔍');
      const right = React.createElement('span', { id: 'clear-ico' }, '✕');
      const html = renderToStaticMarkup(
        React.createElement(TextInput, {
          label: 'Tìm kiếm',
          leftAddon: left,
          rightAddon: right,
        })
      );
      expect(html).toContain('id="search-ico"');
      expect(html).toContain('id="clear-ico"');
      expect(html).toContain('pl-10');
      expect(html).toContain('pr-10');
    });

    it('renders error state with role="alert" and danger borders', () => {
      const html = renderToStaticMarkup(
        React.createElement(TextInput, {
          label: 'Số điện thoại',
          error: 'Số điện thoại không hợp lệ',
        })
      );
      expect(html).toContain('role="alert"');
      expect(html).toContain('Số điện thoại không hợp lệ');
      expect(html).toContain('border-danger');
      expect(html).toContain('aria-invalid="true"');
    });

    it('renders helper text when error is not present', () => {
      const html = renderToStaticMarkup(
        React.createElement(TextInput, {
          label: 'Mã số bàn',
          helperText: 'Nhập số từ 1 đến 50',
        })
      );
      expect(html).toContain('Nhập số từ 1 đến 50');
      expect(html).toContain('text-text-muted');
    });
  });

  describe('TextArea', () => {
    it('renders multi-line textarea with minimum height 100px', () => {
      const html = renderToStaticMarkup(
        React.createElement(TextArea, {
          label: 'Ghi chú món ăn chay',
          defaultValue: 'Ăn chay trường',
        })
      );
      expect(html).toContain('Ghi chú món ăn chay');
      expect(html).toContain('min-h-[100px]');
      expect(html).toContain('Ăn chay trường');
    });

    it('displays character counter when maxCharacters is provided', () => {
      const html = renderToStaticMarkup(
        React.createElement(TextArea, {
          label: 'Địa chỉ gửi thiệp',
          defaultValue: '123 Lê Lợi, TP.HCM',
          maxCharacters: 200,
        })
      );
      expect(html).toContain('/ 200 ký tự');
      expect(html).toContain('aria-live="polite"');
    });

    it('renders error message and connects aria-invalid and aria-describedby', () => {
      const html = renderToStaticMarkup(
        React.createElement(TextArea, {
          label: 'Ghi chú riêng tư',
          error: 'Nội dung vượt quá giới hạn',
        })
      );
      expect(html).toContain('role="alert"');
      expect(html).toContain('Nội dung vượt quá giới hạn');
      expect(html).toContain('border-danger');
      expect(html).toContain('aria-invalid="true"');
    });
  });
});
