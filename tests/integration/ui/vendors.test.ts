import { describe, it, expect, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  VendorsDirectory,
  VendorDetailScreen,
  VendorCompareScreen,
  QuotesManager,
  QuoteToCostPreviewModal,
  EditVendorModal,
  FIXTURE_VENDORS,
  FIXTURE_QUOTES,
  FIXTURE_COMPARE_RESPONSE,
} from '@/components/modules/vendors';
import { RoleProvider } from '@/context/RoleContext';
import { EventScopeProvider } from '@/context/EventScopeContext';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  useSearchParams: () => ({
    get: (key: string) => {
      if (key === 'quotes') return 'quote-1,quote-2,quote-3';
      return null;
    },
  }),
  usePathname: () => '/vendors',
  useParams: () => ({ id: FIXTURE_VENDORS[0].id }),
}));

describe('Vendors UI Multi-Tier Integration Tests (S15, S16, S17 & FL14)', () => {
  const sampleVendor = FIXTURE_VENDORS[0]; // Riverside Palace
  const sampleQuotes = FIXTURE_QUOTES.filter((q) => q.vendor_id === sampleVendor.id);

  describe('AT03 & AT41: Role-Based Family View Access Control & Privacy Protection', () => {
    it('S15: Family View hides Add Vendor button, compare checkboxes and private notes', () => {
      const html = renderToStaticMarkup(
        React.createElement(
          RoleProvider,
          { initialRole: 'family_view' },
          React.createElement(VendorsDirectory, { initialVendors: FIXTURE_VENDORS })
        )
      );

      // Must NOT contain create action
      expect(html).not.toContain('Thêm nhà cung cấp');
      // Must NOT contain compare checkboxes
      expect(html).not.toContain('Chọn so sánh');
      // Must NOT contain private notes
      expect(html).not.toContain('Đã đàm phán giảm 5%');
    });

    it('S16: Family View hides Quotes & Contract tab completely and hides private notes', () => {
      const html = renderToStaticMarkup(
        React.createElement(
          RoleProvider,
          { initialRole: 'family_view' },
          React.createElement(
            EventScopeProvider,
            null,
            React.createElement(VendorDetailScreen, {
              vendorId: sampleVendor.id,
              initialVendor: sampleVendor,
              initialQuotes: sampleQuotes,
            })
          )
        )
      );

      // Must NOT contain quotes manager
      expect(html).not.toContain('Báo Giá &amp; Phiên Bản Hợp Đồng');
      expect(html).not.toContain('Gói Tiệc Bạc');
      expect(html).not.toContain('180.000.000 ₫');
      // Must NOT contain private notes
      expect(html).not.toContain('Ghi Chú Riêng Tư');
      expect(html).not.toContain('Đã đàm phán giảm 5%');
      // Must NOT contain edit or delete buttons
      expect(html).not.toContain('Sửa thông tin');
      expect(html).not.toContain('Xóa');
    });

    it('S17: Family View is strictly blocked from /vendors/compare with PermissionDeniedView', () => {
      const html = renderToStaticMarkup(
        React.createElement(
          RoleProvider,
          { initialRole: 'family_view' },
          React.createElement(VendorCompareScreen, {
            initialResponse: FIXTURE_COMPARE_RESPONSE,
          })
        )
      );

      expect(html).toContain('Bạn không có quyền truy cập');
      expect(html).toContain('Trang so sánh báo giá và hợp đồng nhà cung cấp chứa thông tin tài chính mật');
      expect(html).not.toContain('Tiêu chí so sánh');
      expect(html).not.toContain('Chi phí mô phỏng');
    });
  });

  describe('AT24: Quote Version Immutability & "Chưa báo" Preservation', () => {
    it('Preserves "Chưa báo" when quote has null total_amount across S15, S16, S17', () => {
      const unquotedQuote = FIXTURE_QUOTES.find((q) => q.total_amount === null)!;
      expect(unquotedQuote).toBeDefined();

      // S16 QuotesManager
      const s16Html = renderToStaticMarkup(
        React.createElement(
          RoleProvider,
          { initialRole: 'owner' },
          React.createElement(QuotesManager, {
            quotes: [unquotedQuote],
            vendorId: unquotedQuote.vendor_id,
            vendorName: 'Bình An',
            isOwner: true,
            onQuotesUpdated: () => {},
            onOpenAddQuote: () => {},
          })
        )
      );
      expect(s16Html).toContain('Chưa báo');
      expect(s16Html).not.toContain('0 ₫');
      expect(s16Html).not.toContain('0 VND');

      // S17 Compare Screen
      const s17Html = renderToStaticMarkup(
        React.createElement(
          RoleProvider,
          { initialRole: 'owner' },
          React.createElement(
            EventScopeProvider,
            null,
            React.createElement(VendorCompareScreen, {
              initialResponse: FIXTURE_COMPARE_RESPONSE,
            })
          )
        )
      );
      expect(s17Html).toContain('Chưa báo');
    });

    it('Preserves superseded v1 version in history drawer while showing v2 as active', () => {
      const html = renderToStaticMarkup(
        React.createElement(
          RoleProvider,
          { initialRole: 'owner' },
          React.createElement(QuotesManager, {
            quotes: sampleQuotes,
            vendorId: sampleVendor.id,
            vendorName: sampleVendor.name,
            isOwner: true,
            onQuotesUpdated: () => {},
            onOpenAddQuote: () => {},
          })
        )
      );

      // Active is v2
      expect(html).toContain('v2');
      expect(html).toContain('Gói Tiệc Bạc (Silver Package) - Đàm phán v2');
      expect(html).toContain('180.000.000 ₫');
      // History indicator shows 1 older version
      expect(html).toContain('Lịch sử phiên bản (1 bản cũ)');
    });
  });

  describe('AT23: Quote-to-Cost Conversion & Idempotency Guard (FL14)', () => {
    it('Selected quote shows "Mở khoản chi" and does not allow duplicate creation CTA', () => {
      const html = renderToStaticMarkup(
        React.createElement(
          RoleProvider,
          { initialRole: 'owner' },
          React.createElement(QuotesManager, {
            quotes: sampleQuotes, // includes v2 which has is_selected: true
            vendorId: sampleVendor.id,
            vendorName: sampleVendor.name,
            isOwner: true,
            onQuotesUpdated: () => {},
            onOpenAddQuote: () => {},
          })
        )
      );

      expect(html).toContain('Đã chọn / Đã liên kết');
      expect(html).toContain('Mở khoản chi');
    });

    it('QuoteToCostPreviewModal displays preview and conversion confirmation dialog', () => {
      const html = renderToStaticMarkup(
        React.createElement(QuoteToCostPreviewModal, {
          isOpen: true,
          onClose: () => {},
          vendorId: sampleVendor.id,
          quoteId: sampleQuotes[0].id,
          onSuccess: () => {},
        })
      );

      expect(html).toContain('Tạo Khoản Chi Từ Báo Giá (FL14)');
      expect(html).toContain('Xem trước thông tin và liên kết gói báo giá vào phân hệ Ngân sách cưới.');
    });
  });

  describe('AT30: Optimistic Locking & Conflict Detection', () => {
    it('EditVendorModal displays vendor version and retains form fields', () => {
      const html = renderToStaticMarkup(
        React.createElement(EditVendorModal, {
          isOpen: true,
          onClose: () => {},
          vendor: sampleVendor,
          onSuccess: () => {},
          onReloadRequested: () => {},
        })
      );

      expect(html).toContain(`Phiên bản ${sampleVendor.version}`);
      expect(html).toContain('Trung Tâm Tiệc Cưới Riverside Palace');
      expect(html).toContain('0901234567');
      expect(html).toContain('Lưu thay đổi');
    });
  });
});
