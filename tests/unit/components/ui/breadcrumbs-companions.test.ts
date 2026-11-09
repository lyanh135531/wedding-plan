import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Toast } from '@/components/ui/toast';
import { ErrorState } from '@/components/ui/error-state';
import { StickyActionBar } from '@/components/ui/sticky-action-bar';
import { FilterBar } from '@/components/ui/filter-bar';
import { FileUploadDropzone } from '@/components/ui/file-upload-dropzone';
import { VersionConflictModal } from '@/components/ui/version-conflict-modal';
import { PrintView } from '@/components/ui/print-view';

describe('Breadcrumbs & Companion Components', () => {
  describe('Breadcrumbs (src/components/ui/breadcrumbs.tsx)', () => {
    it('renders navigation with ordered list, links and current page marker', () => {
      const items = [
        { label: 'Trang chủ', href: '/' },
        { label: 'Khách mời', href: '/guests' },
        { label: 'Nguyễn Văn Hoàng', current: true },
      ];
      const html = renderToStaticMarkup(React.createElement(Breadcrumbs, { items }));
      expect(html).toContain('role="navigation"');
      expect(html).toContain('aria-label="Breadcrumb"');
      expect(html).toContain('href="/"');
      expect(html).toContain('href="/guests"');
      expect(html).toContain('aria-current="page"');
      expect(html).toContain('Nguyễn Văn Hoàng');
    });
  });

  describe('Toast (src/components/ui/toast.tsx)', () => {
    it('renders toast with role="status", aria-live="polite", title and message', () => {
      const toast = {
        id: 't1',
        title: 'Cập nhật thành công',
        message: 'Thông tin khách mời đã được lưu an toàn.',
        variant: 'success' as const,
      };
      const html = renderToStaticMarkup(
        React.createElement(Toast, { toast, onDismiss: () => {} })
      );
      expect(html).toContain('role="status"');
      expect(html).toContain('aria-live="polite"');
      expect(html).toContain('Cập nhật thành công');
      expect(html).toContain('Thông tin khách mời đã được lưu an toàn.');
      expect(html).toContain('aria-label="Đóng thông báo"');
    });
  });

  describe('ErrorState (src/components/ui/error-state.tsx)', () => {
    it('renders error state with request tracking ID and retry button', () => {
      const html = renderToStaticMarkup(
        React.createElement(ErrorState, {
          title: 'Không thể kết nối máy chủ',
          message: 'Hệ thống không thể tải danh sách chi phí.',
          requestId: 'req_abc123',
          onRetry: () => {},
        })
      );
      expect(html).toContain('role="alert"');
      expect(html).toContain('Không thể kết nối máy chủ');
      expect(html).toContain('Mã yêu cầu: req_abc123');
      expect(html).toContain('Thử lại');
    });
  });

  describe('StickyActionBar (src/components/ui/sticky-action-bar.tsx)', () => {
    it('renders fixed bottom action bar with save and cancel triggers', () => {
      const html = renderToStaticMarkup(
        React.createElement(StickyActionBar, {
          saveLabel: 'Lưu hợp đồng',
          cancelLabel: 'Bỏ thay đổi',
          isDirty: true,
          onSave: () => {},
          onCancel: () => {},
        })
      );
      expect(html).toContain('role="region"');
      expect(html).toContain('Lưu hợp đồng');
      expect(html).toContain('Bỏ thay đổi');
      expect(html).toContain('fixed bottom-0');
    });
  });

  describe('FilterBar (src/components/ui/filter-bar.tsx)', () => {
    it('renders search input and dropdown filter selects', () => {
      const filters = [
        {
          id: 'status',
          label: 'Trạng thái',
          options: [
            { label: 'Tất cả trạng thái', value: 'all' },
            { label: 'Đã xác nhận', value: 'confirmed' },
          ],
          value: 'all',
          onChange: () => {},
        },
      ];
      const html = renderToStaticMarkup(
        React.createElement(FilterBar, {
          searchQuery: 'Hoàng',
          onSearchChange: () => {},
          filters,
        })
      );
      expect(html).toContain('value="Hoàng"');
      expect(html).toContain('Tất cả trạng thái');
      expect(html).toContain('Đã xác nhận');
    });
  });

  describe('FileUploadDropzone (src/components/ui/file-upload-dropzone.tsx)', () => {
    it('renders drag-and-drop file upload target with supported extension guidelines', () => {
      const html = renderToStaticMarkup(
        React.createElement(FileUploadDropzone, {
          onFilesSelected: () => {},
        })
      );
      expect(html).toContain('Kéo thả tệp vào đây');
      expect(html).toContain('Hỗ trợ ảnh JPEG, PNG, WebP (tối đa 20MB) và PDF (tối đa 10MB)');
    });
  });

  describe('VersionConflictModal (src/components/ui/version-conflict-modal.tsx)', () => {
    it('renders two-column side-by-side diff comparing server vs local draft', () => {
      const diffs = [
        { field: 'Giá chốt hợp đồng', serverValue: '15.000.000 ₫', localValue: '18.000.000 ₫' },
      ];
      const html = renderToStaticMarkup(
        React.createElement(VersionConflictModal, {
          isOpen: true,
          diffs,
          serverUpdatedBy: 'Cô Dâu (Mobile)',
          onUseServer: () => {},
          onKeepLocal: () => {},
        })
      );
      expect(html).toContain('Xung đột phiên bản dữ liệu');
      expect(html).toContain('Bản trên máy chủ (Server)');
      expect(html).toContain('Bản bạn đang nhập (Local Draft)');
      expect(html).toContain('15.000.000 ₫');
      expect(html).toContain('18.000.000 ₫');
      expect(html).toContain('Tải bản mới của máy chủ');
      expect(html).toContain('Chép lại nội dung đang nhập');
    });
  });

  describe('PrintView (src/components/ui/print-view.tsx)', () => {
    it('renders print layout with timestamp and header', () => {
      const html = renderToStaticMarkup(
        React.createElement(
          PrintView,
          {
            title: 'Bảng Kê Chi Phí Cưới',
            subtitle: 'Ngày in: 15/03/2028',
          },
          React.createElement('div', null, 'Dữ liệu in')
        )
      );
      expect(html).toContain('Bảng Kê Chi Phí Cưới');
      expect(html).toContain('Ngày in: 15/03/2028');
      expect(html).toContain('Asia/Ho_Chi_Minh');
      expect(html).toContain('Dữ liệu in');
    });
  });
});
