import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';

describe('Checkbox, RadioGroup & Switch Components', () => {
  describe('Checkbox (src/components/ui/checkbox.tsx)', () => {
    it('renders with label and description in a >=44px touch target area', () => {
      const html = renderToStaticMarkup(
        React.createElement(Checkbox, {
          label: 'Gửi thiệp điện tử',
          description: 'Gửi qua Zalo hoặc tin nhắn SMS',
          checked: true,
          onChange: () => {},
        })
      );
      expect(html).toContain('Gửi thiệp điện tử');
      expect(html).toContain('Gửi qua Zalo hoặc tin nhắn SMS');
      expect(html).toContain('min-h-[44px]');
      expect(html).toContain('bg-primary');
    });

    it('renders error message and connects aria-invalid', () => {
      const html = renderToStaticMarkup(
        React.createElement(Checkbox, {
          label: 'Tôi đồng ý điều khoản',
          error: 'Bắt buộc đồng ý điều khoản',
          onChange: () => {},
        })
      );
      expect(html).toContain('role="alert"');
      expect(html).toContain('Bắt buộc đồng ý điều khoản');
      expect(html).toContain('aria-invalid="true"');
    });
  });

  describe('RadioGroup (src/components/ui/radio-group.tsx)', () => {
    const options = [
      { value: 'confirmed', label: 'Chắc chắn tham dự', description: 'Đã báo số lượng' },
      { value: 'declined', label: 'Không tham dự' },
      { value: 'pending', label: 'Chưa phản hồi' },
    ];

    it('renders radiogroup with options and labels', () => {
      const html = renderToStaticMarkup(
        React.createElement(RadioGroup, {
          name: 'rsvp_status',
          label: 'Trạng thái phản hồi',
          options,
          value: 'confirmed',
          onChange: () => {},
        })
      );
      expect(html).toContain('role="radiogroup"');
      expect(html).toContain('Trạng thái phản hồi');
      expect(html).toContain('Chắc chắn tham dự');
      expect(html).toContain('Đã báo số lượng');
      expect(html).toContain('Không tham dự');
      expect(html).toContain('value="confirmed"');
    });

    it('supports horizontal layout direction', () => {
      const html = renderToStaticMarkup(
        React.createElement(RadioGroup, {
          name: 'gender',
          label: 'Xưng hô',
          options: [
            { value: 'mr', label: 'Anh/Chú' },
            { value: 'ms', label: 'Chị/Cô' },
          ],
          value: 'mr',
          direction: 'horizontal',
          onChange: () => {},
        })
      );
      expect(html).toContain('flex-row');
    });
  });

  describe('Switch (src/components/ui/switch.tsx)', () => {
    it('renders switch with role="switch" and aria-checked', () => {
      const htmlChecked = renderToStaticMarkup(
        React.createElement(Switch, {
          label: 'Chia sẻ với người nhà',
          checked: true,
          onChange: () => {},
        })
      );
      expect(htmlChecked).toContain('role="switch"');
      expect(htmlChecked).toContain('aria-checked="true"');
      expect(htmlChecked).toContain('bg-primary');

      const htmlUnchecked = renderToStaticMarkup(
        React.createElement(Switch, {
          label: 'Chia sẻ với người nhà',
          checked: false,
          onChange: () => {},
        })
      );
      expect(htmlUnchecked).toContain('aria-checked="false"');
      expect(htmlUnchecked).toContain('bg-border-control');
    });

    it('renders description and disabled state', () => {
      const html = renderToStaticMarkup(
        React.createElement(Switch, {
          label: 'Chế độ chỉnh sửa',
          description: 'Chỉ khả dụng cho tài khoản Owner',
          checked: false,
          disabled: true,
          onChange: () => {},
        })
      );
      expect(html).toContain('Chỉ khả dụng cho tài khoản Owner');
      expect(html).toContain('disabled=""');
      expect(html).toContain('cursor-not-allowed');
    });
  });
});
