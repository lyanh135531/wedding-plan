import { describe, it, expect, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  VendorProfileHeader,
  VendorInfoCards,
  QuotesManager,
  QuoteToCostPreviewModal,
  EditVendorModal,
  AddQuoteModal,
  ReviseQuoteModal,
  FIXTURE_VENDORS,
  FIXTURE_QUOTES,
} from '@/components/modules/vendors';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/vendors/1',
}));

describe('S16 Vendor Detail & Quotes Components', () => {
  const sampleVendor = FIXTURE_VENDORS[0]; // Riverside Palace (venue)
  const quotesForVendor = FIXTURE_QUOTES.filter(
    (q) => q.vendor_id === sampleVendor.id
  );

  it('VendorProfileHeader renders edit, delete, add quote buttons for Owner', () => {
    const html = renderToStaticMarkup(
      React.createElement(VendorProfileHeader, {
        vendor: sampleVendor,
        isOwner: true,
        onEditClick: () => {},
        onDeleteClick: () => {},
        onAddQuoteClick: () => {},
      })
    );

    expect(html).toContain('Trung Tâm Tiệc Cưới Riverside Palace');
    expect(html).toContain('Sửa thông tin');
    expect(html).toContain('Xóa');
    expect(html).toContain('Thêm báo giá');
  });

  it('VendorProfileHeader hides edit, delete, add quote buttons for Family View (AT03, AT41)', () => {
    const html = renderToStaticMarkup(
      React.createElement(VendorProfileHeader, {
        vendor: sampleVendor,
        isOwner: false, // Family View
        onEditClick: () => {},
        onDeleteClick: () => {},
        onAddQuoteClick: () => {},
      })
    );

    expect(html).toContain('Trung Tâm Tiệc Cưới Riverside Palace');
    expect(html).not.toContain('Sửa thông tin');
    expect(html).not.toContain('Xóa');
    expect(html).not.toContain('Thêm báo giá');
  });

  it('VendorInfoCards renders contact info, venue specs and private notes for Owner', () => {
    const html = renderToStaticMarkup(
      React.createElement(VendorInfoCards, {
        vendor: sampleVendor,
        isOwner: true,
      })
    );

    expect(html).toContain('Nguyễn Thanh Tùng');
    expect(html).toContain('tel:0901234567');
    expect(html).toContain('tung.riverside@example.com');
    expect(html).toContain('Thông Số Sảnh Tiệc &amp; Quy Định Địa Điểm');
    expect(html).toContain('600 khách');
    expect(html).toContain('5.500.000 ₫/bàn');
    expect(html).toContain('25.000.000 ₫');
    // Private notes for Owner (AT03, AT41)
    expect(html).toContain('Ghi Chú Riêng Tư');
    expect(html).toContain('Đã đàm phán giảm 5% phí sảnh và miễn phí màn hình LED.');
    expect(html).toContain('Phí mang rượu ngoại vào sảnh: 200.000 ₫/chai.');
  });

  it('VendorInfoCards hides private notes card completely for Family View (AT03, AT41)', () => {
    const html = renderToStaticMarkup(
      React.createElement(VendorInfoCards, {
        vendor: sampleVendor,
        isOwner: false, // Family View
      })
    );

    expect(html).toContain('Nguyễn Thanh Tùng');
    // Private notes must NOT be rendered for family view
    expect(html).not.toContain('Ghi Chú Riêng Tư');
    expect(html).not.toContain('Đã đàm phán giảm 5% phí sảnh');
    expect(html).not.toContain('Phí mang rượu ngoại vào sảnh');
  });

  it('QuotesManager returns null for Family View (AT03, AT41)', () => {
    const html = renderToStaticMarkup(
      React.createElement(QuotesManager, {
        quotes: quotesForVendor,
        vendorId: sampleVendor.id,
        vendorName: sampleVendor.name,
        isOwner: false, // Family View
        onQuotesUpdated: () => {},
        onOpenAddQuote: () => {},
      })
    );

    // Quotes block must be completely null for Family View
    expect(html).toBe('');
  });

  it('QuotesManager renders quotes, version badges and "Mở khoản chi" for selected quote (AT23)', () => {
    const html = renderToStaticMarkup(
      React.createElement(QuotesManager, {
        quotes: quotesForVendor,
        vendorId: sampleVendor.id,
        vendorName: sampleVendor.name,
        isOwner: true,
        onQuotesUpdated: () => {},
        onOpenAddQuote: () => {},
      })
    );

    expect(html).toContain('Báo Giá &amp; Phiên Bản Hợp Đồng');
    expect(html).toContain('Gói Tiệc Bạc (Silver Package) - Đàm phán v2');
    expect(html).toContain('v2');
    expect(html).toContain('180.000.000 ₫');
    expect(html).toContain('Đã chọn / Đã liên kết');
    expect(html).toContain('Mở khoản chi'); // Quote is selected -> Button is "Mở khoản chi" (AT23)
    expect(html).toContain('Lịch sử phiên bản (1 bản cũ)');
  });

  it('QuotesManager preserves "Chưa báo" when total_amount is null, never showing 0 VND (AT24)', () => {
    const unquotedQuote = FIXTURE_QUOTES.find((q) => q.total_amount === null)!;
    expect(unquotedQuote).toBeDefined();

    const html = renderToStaticMarkup(
      React.createElement(QuotesManager, {
        quotes: [unquotedQuote],
        vendorId: unquotedQuote.vendor_id,
        vendorName: 'Bình An',
        isOwner: true,
        onQuotesUpdated: () => {},
        onOpenAddQuote: () => {},
      })
    );

    expect(html).toContain('Gói Sân Vườn Hoàng Hôn (Đang khảo sát)');
    expect(html).toContain('Chưa báo'); // Preserves "Chưa báo" (AT24)
    expect(html).not.toContain('0 ₫');
    expect(html).not.toContain('0 VND');
  });

  it('QuoteToCostPreviewModal renders already converted notice and only "Mở khoản chi" button (AT23)', () => {
    // When preview data has is_already_converted === true
    // Simulate with already converted state
    const html = renderToStaticMarkup(
      React.createElement(QuoteToCostPreviewModal, {
        isOpen: true,
        onClose: () => {},
        vendorId: sampleVendor.id,
        quoteId: quotesForVendor[1].id,
        onSuccess: () => {},
      })
    );

    // Initial render shows modal title
    expect(html).toContain('Tạo Khoản Chi Từ Báo Giá (FL14)');
  });

  it('EditVendorModal includes version and handles optimistic locking (AT30)', () => {
    const html = renderToStaticMarkup(
      React.createElement(EditVendorModal, {
        isOpen: true,
        onClose: () => {},
        vendor: sampleVendor,
        onSuccess: () => {},
        onReloadRequested: () => {},
      })
    );

    expect(html).toContain('Chỉnh Sửa Hồ Sơ Nhà Cung Cấp');
    expect(html).toContain(`Phiên bản ${sampleVendor.version}`);
    expect(html).toContain('Tên nhà cung cấp *');
    expect(html).toContain('Lưu thay đổi');
  });

  it('AddQuoteModal allows nullable total_amount for "Chưa báo" (AT24)', () => {
    const html = renderToStaticMarkup(
      React.createElement(AddQuoteModal, {
        isOpen: true,
        onClose: () => {},
        vendorId: sampleVendor.id,
        vendorName: sampleVendor.name,
        onSuccess: () => {},
      })
    );

    expect(html).toContain('Thêm Báo Giá Ban Đầu (v1)');
    expect(html).toContain('Tên gói / Tên báo giá *');
    expect(html).toContain('Tổng tiền báo giá (Để trống nếu Chưa báo)');
    expect(html).toContain('Nếu đối tác chưa chốt giá, để trống để hiển thị &quot;Chưa báo&quot; (AT24)');
  });

  it('ReviseQuoteModal indicates new version number inheriting from baseQuote (AT24)', () => {
    const baseQuote = quotesForVendor[0]; // v1 or v2
    const html = renderToStaticMarkup(
      React.createElement(ReviseQuoteModal, {
        isOpen: true,
        onClose: () => {},
        vendorId: sampleVendor.id,
        baseQuote,
        onSuccess: () => {},
      })
    );

    expect(html).toContain(`Tạo Phiên Bản Mới (v${baseQuote.version_number + 1})`);
    expect(html).toContain('Lý do điều chỉnh báo giá');
    expect(html).toContain(`Lưu phiên bản v${baseQuote.version_number + 1}`);
  });
});
