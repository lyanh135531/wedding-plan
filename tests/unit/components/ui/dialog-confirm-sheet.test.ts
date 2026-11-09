import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ModalDialog } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DrawerSheet } from '@/components/ui/sheet';

describe('ModalDialog, ConfirmDialog & DrawerSheet Components', () => {
  describe('ModalDialog (src/components/ui/dialog.tsx)', () => {
    it('renders dialog with role="dialog", aria-modal="true", title, description and content', () => {
      const html = renderToStaticMarkup(
        React.createElement(
          ModalDialog,
          {
            isOpen: true,
            title: 'Thêm khách mời mới',
            description: 'Điền thông tin khách mời vào biểu mẫu',
            onClose: () => {},
          },
          React.createElement('div', { id: 'modal-body' }, 'Nội dung biểu mẫu')
        )
      );
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('Thêm khách mời mới');
      expect(html).toContain('Điền thông tin khách mời vào biểu mẫu');
      expect(html).toContain('id="modal-body"');
      expect(html).toContain('aria-label="Đóng hộp thoại"');
    });

    it('renders null when isOpen is false', () => {
      const html = renderToStaticMarkup(
        React.createElement(
          ModalDialog,
          {
            isOpen: false,
            title: 'Ẩn',
            onClose: () => {},
          },
          'hidden'
        )
      );
      expect(html).toBe('');
    });
  });

  describe('ConfirmDialog (src/components/ui/confirm-dialog.tsx)', () => {
    it('renders specific action phrasing and cancel button before confirm button', () => {
      const html = renderToStaticMarkup(
        React.createElement(ConfirmDialog, {
          isOpen: true,
          title: 'Xóa khoản chi phí',
          description: 'Bạn có chắc chắn muốn xóa khoản "Đặt cọc chụp ảnh cưới 5.000.000 ₫"?',
          confirmLabel: 'Xóa vĩnh viễn 5.000.000 ₫',
          cancelLabel: 'Giữ lại khoản này',
          variant: 'danger',
          onConfirm: () => {},
          onCancel: () => {},
        })
      );
      expect(html).toContain('Xóa khoản chi phí');
      expect(html).toContain('Xóa vĩnh viễn 5.000.000 ₫');
      expect(html).toContain('Giữ lại khoản này');
      expect(html).toContain('bg-danger');

      // Check Cancel appears before Confirm in markup to support default Cancel focus
      const cancelIndex = html.indexOf('Giữ lại khoản này');
      const confirmIndex = html.indexOf('Xóa vĩnh viễn 5.000.000 ₫');
      expect(cancelIndex).toBeLessThan(confirmIndex);
    });
  });

  describe('DrawerSheet (src/components/ui/sheet.tsx)', () => {
    it('renders side drawer with desktop width and mobile full-screen classes', () => {
      const html = renderToStaticMarkup(
        React.createElement(
          DrawerSheet,
          {
            isOpen: true,
            title: 'Chi tiết khách mời',
            description: 'Thông tin liên lạc và người đi cùng',
            width: 'md',
            footer: React.createElement('button', null, 'Lưu'),
            onClose: () => {},
          },
          React.createElement('p', null, 'Nội dung chi tiết')
        )
      );
      expect(html).toContain('role="dialog"');
      expect(html).toContain('Chi tiết khách mời');
      expect(html).toContain('md:max-w-[480px]');
      expect(html).toContain('w-full h-full');
      expect(html).toContain('Lưu');
    });
  });
});
