import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TabNavigation } from '@/components/ui/tabs';
import { Tooltip } from '@/components/ui/tooltip';
import { Alert, SystemAlertBanner } from '@/components/ui/alert';

describe('TabNavigation, Tooltip & Alert Components', () => {
  describe('TabNavigation (src/components/ui/tabs.tsx)', () => {
    const tabs = [
      { id: 'all', label: 'Tất cả', badge: 143 },
      { id: 'confirmed', label: 'Đã xác nhận', badge: 98 },
      { id: 'declined', label: 'Từ chối', badge: 12 },
      { id: 'disabled_tab', label: 'Không khả dụng', disabled: true },
    ];

    it('renders role="tablist" and role="tab" elements with aria-selected', () => {
      const html = renderToStaticMarkup(
        React.createElement(TabNavigation, {
          tabs,
          activeTab: 'confirmed',
          onChange: () => {},
        })
      );
      expect(html).toContain('role="tablist"');
      expect(html).toContain('role="tab"');
      expect(html).toContain('aria-selected="true"');
      expect(html).toContain('Đã xác nhận');
      expect(html).toContain('98');
      expect(html).toContain('border-primary text-primary');
    });

    it('renders pill variant correctly', () => {
      const html = renderToStaticMarkup(
        React.createElement(TabNavigation, {
          tabs,
          activeTab: 'all',
          variant: 'pill',
          onChange: () => {},
        })
      );
      expect(html).toContain('bg-primary text-white');
    });
  });

  describe('Tooltip (src/components/ui/tooltip.tsx)', () => {
    it('wraps child element and renders tooltip trigger', () => {
      const html = renderToStaticMarkup(
        React.createElement(
          Tooltip,
          { content: 'Chỉ xem dành cho người nhà' },
          React.createElement('button', null, 'Trạng thái')
        )
      );
      expect(html).toContain('Trạng thái');
    });
  });

  describe('Alert (src/components/ui/alert.tsx)', () => {
    it('renders role="alert" with title, message, and action button', () => {
      const html = renderToStaticMarkup(
        React.createElement(
          Alert,
          {
            variant: 'warning',
            title: 'Cảnh báo ngân sách',
            action: { label: 'Xem chi tiết', onClick: () => {} },
            onClose: () => {},
          },
          'Chi phí thực tế đã vượt 85% hạn mức'
        )
      );
      expect(html).toContain('role="alert"');
      expect(html).toContain('Cảnh báo ngân sách');
      expect(html).toContain('Chi phí thực tế đã vượt 85% hạn mức');
      expect(html).toContain('Xem chi tiết');
      expect(html).toContain('aria-label="Đóng thông báo"');
      expect(html).toContain('bg-warning-bg');
    });

    it('renders SystemAlertBanner for offline persistent banner', () => {
      const html = renderToStaticMarkup(
        React.createElement(SystemAlertBanner, {
          variant: 'offline',
          message: 'Bạn đang xem dữ liệu lưu tạm. Biểu mẫu của bạn vẫn được giữ nguyên.',
          actionButton: { label: 'Thử kết nối lại', onClick: () => {} },
        })
      );
      expect(html).toContain('role="alert"');
      expect(html).toContain('Mất kết nối mạng');
      expect(html).toContain('Bạn đang xem dữ liệu lưu tạm');
      expect(html).toContain('Thử kết nối lại');
    });
  });
});
