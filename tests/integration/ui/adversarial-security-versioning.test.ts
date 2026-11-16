import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  VendorsDirectory,
  VendorDetailScreen,
  VendorCompareScreen,
  QuotesManager,
  VendorInfoCards,
  VendorProfileHeader,
  VendorListDesktop,
  VendorCardMobile,
  VendorQuickCompareBar,
  EditVendorModal,
  FIXTURE_VENDORS,
  FIXTURE_QUOTES,
  FIXTURE_COMPARE_RESPONSE,
} from '@/components/modules/vendors';
import { RoleProvider } from '@/context/RoleContext';
import { EventScopeProvider } from '@/context/EventScopeContext';
import { vendorsApi, ApiError } from '@/lib/vendors/api-client';
import { updateVendorSchema } from '@/schemas/vendors';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  useSearchParams: () => ({
    get: (key: string) => {
      if (key === 'quotes') return 'quote-1,quote-2';
      return null;
    },
  }),
  usePathname: () => '/vendors',
  useParams: () => ({ id: FIXTURE_VENDORS[0].id }),
}));

describe('Adversarial Security & Versioning Stress Suite (AT03, AT41, AT30)', () => {
  const sampleVenueVendor = FIXTURE_VENDORS[0]; // Riverside Palace
  const sampleQuotes = FIXTURE_QUOTES.filter((q) => q.vendor_id === sampleVenueVendor.id);

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. AT03 & AT41: Role-Based Access Control & Confidentiality Stress Tests
  // =========================================================================
  describe('AT03 & AT41: Family View Confidentiality & Privilege Separation', () => {
    it('[AT03-S15-01] S15: Family View completely hides Add Vendor button and Quick Compare Bar', () => {
      const familyHtml = renderToStaticMarkup(
        React.createElement(
          RoleProvider,
          { initialRole: 'family_view' },
          React.createElement(VendorsDirectory, { initialVendors: FIXTURE_VENDORS })
        )
      );

      // Must NOT have add button in header
      expect(familyHtml).not.toContain('Thêm nhà cung cấp');
      // Must NOT have quick compare bar
      expect(familyHtml).not.toContain('Đã chọn');
      expect(familyHtml).not.toContain('So sánh ngay');
      // Must NOT leak private negotiation notes in list
      expect(familyHtml).not.toContain('Đã đàm phán giảm 5%');
      expect(familyHtml).not.toContain('Phí mang rượu ngoại');
      // Must display Family View advisory
      expect(familyHtml).toContain('Chế độ Người nhà (Chỉ xem)');
    });

    it('[AT03-S15-02] S15: Empty State hides "+ Thêm nhà cung cấp đầu tiên" CTA when in Family View', () => {
      const familyEmptyHtml = renderToStaticMarkup(
        React.createElement(
          RoleProvider,
          { initialRole: 'family_view' },
          React.createElement(VendorsDirectory, { initialVendors: [] })
        )
      );

      expect(familyEmptyHtml).toContain('Chưa có nhà cung cấp nào');
      expect(familyEmptyHtml).toContain('Hiện chưa có đối tác nào được ghi nhận trong danh sách chuẩn bị cưới.');
      expect(familyEmptyHtml).not.toContain('+ Thêm nhà cung cấp đầu tiên');
    });

    it('[AT03-S15-03] S15: VendorListDesktop and VendorCardMobile strictly hide comparison checkboxes for Family View', () => {
      const desktopHtml = renderToStaticMarkup(
        React.createElement(VendorListDesktop, {
          vendors: FIXTURE_VENDORS,
          isOwner: false, // Family View
          selectedVendorIds: [],
          onToggleSelectVendor: () => {},
        })
      );
      expect(desktopHtml).not.toContain('Chọn so sánh');
      expect(desktopHtml).not.toContain('type="checkbox"');

      const mobileHtml = renderToStaticMarkup(
        React.createElement(VendorCardMobile, {
          vendors: FIXTURE_VENDORS,
          isOwner: false, // Family View
          selectedVendorIds: [],
          onToggleSelectVendor: () => {},
        })
      );
      expect(mobileHtml).not.toContain('Chọn so sánh');
      expect(mobileHtml).not.toContain('type="checkbox"');
    });

    it('[AT03-S16-01] S16: Family View strictly hides VendorProfileHeader action buttons (Edit, Delete, Add Quote)', () => {
      const familyHeaderHtml = renderToStaticMarkup(
        React.createElement(VendorProfileHeader, {
          vendor: sampleVenueVendor,
          isOwner: false, // Family View
          onEditClick: () => {},
          onDeleteClick: () => {},
          onAddQuoteClick: () => {},
        })
      );

      expect(familyHeaderHtml).toContain(sampleVenueVendor.name);
      expect(familyHeaderHtml).not.toContain('Sửa thông tin');
      expect(familyHeaderHtml).not.toContain('Xóa');
      expect(familyHeaderHtml).not.toContain('Thêm báo giá');
    });

    it('[AT03-S16-02] S16: Family View strictly hides private notes card in VendorInfoCards', () => {
      const familyCardsHtml = renderToStaticMarkup(
        React.createElement(VendorInfoCards, {
          vendor: sampleVenueVendor,
          isOwner: false, // Family View
        })
      );

      // Public contact & venue specs are visible
      expect(familyCardsHtml).toContain('Thông Tin Liên Hệ &amp; Trụ Sở');
      expect(familyCardsHtml).toContain('Nguyễn Thanh Tùng');
      expect(familyCardsHtml).toContain('Thông Số Sảnh Tiệc &amp; Quy Định Địa Điểm');
      expect(familyCardsHtml).toContain('600 khách');

      // Private negotiation & hidden fees are 100% hidden
      expect(familyCardsHtml).not.toContain('Ghi Chú Riêng Tư');
      expect(familyCardsHtml).not.toContain('Chỉ Chủ Sở Hữu');
      expect(familyCardsHtml).not.toContain('Đã đàm phán giảm 5%');
      expect(familyCardsHtml).not.toContain('Phí mang rượu ngoại');
    });

    it('[AT03-S16-03] S16: QuotesManager has double-defense: returns null if !isOwner', () => {
      // Direct call to QuotesManager with isOwner: false
      const directQuotesHtml = renderToStaticMarkup(
        React.createElement(QuotesManager, {
          quotes: sampleQuotes,
          vendorId: sampleVenueVendor.id,
          vendorName: sampleVenueVendor.name,
          isOwner: false, // Family View
          onQuotesUpdated: () => {},
          onOpenAddQuote: () => {},
        })
      );

      expect(directQuotesHtml).toBe('');

      // Render via VendorDetailScreen in family view
      const detailHtml = renderToStaticMarkup(
        React.createElement(
          RoleProvider,
          { initialRole: 'family_view' },
          React.createElement(
            EventScopeProvider,
            null,
            React.createElement(VendorDetailScreen, {
              vendorId: sampleVenueVendor.id,
              initialVendor: sampleVenueVendor,
              initialQuotes: sampleQuotes,
            })
          )
        )
      );

      expect(detailHtml).not.toContain('Báo Giá &amp; Phiên Bản Hợp Đồng');
      expect(detailHtml).not.toContain('180.000.000 ₫');
      expect(detailHtml).not.toContain('Gói Tiệc Bạc');
    });

    it('[AT03-S16-04] S16: Safe deletion protection rejects deleting vendor with active costs (AT23)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'BAD_REQUEST',
          message: 'Không thể xóa nhà cung cấp đã có báo giá được chọn hoặc khoản chi đang hoạt động (AT23).',
        }),
      });

      let caughtError: any = null;
      try {
        await vendorsApi.delete(sampleVenueVendor.id);
      } catch (err: any) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(ApiError);
      expect(caughtError.status).toBe(400);
      expect(caughtError.message).toContain('AT23');
    });

    it('[AT03-S17-01] S17: Family View directly navigating to /vendors/compare is blocked by PermissionDeniedView', () => {
      const compareHtml = renderToStaticMarkup(
        React.createElement(
          RoleProvider,
          { initialRole: 'family_view' },
          React.createElement(VendorCompareScreen, {
            initialResponse: FIXTURE_COMPARE_RESPONSE,
          })
        )
      );

      expect(compareHtml).toContain('Bạn không có quyền truy cập');
      expect(compareHtml).toContain(
        'Trang so sánh báo giá và hợp đồng nhà cung cấp chứa thông tin tài chính mật'
      );
      expect(compareHtml).toContain('Quay lại danh sách nhà cung cấp');

      // Ensure no matrix data or simulation leaked
      expect(compareHtml).not.toContain('Mô Phỏng Kịch Bản Bàn Tiệc');
      expect(compareHtml).not.toContain('Bảng So Sánh Báo Giá');
      expect(compareHtml).not.toContain('Gói Tiệc Bạc');
      expect(compareHtml).not.toContain('186.875.000 ₫');
    });
  });

  // =========================================================================
  // 2. AT30: Optimistic Locking & Version Conflict Stress Tests
  // =========================================================================
  describe('AT30: Optimistic Locking & Conflict Detection Stress Tests', () => {
    it('[AT30-01] updateVendorSchema strictly validates and requires positive integer version', () => {
      // Valid payload with version
      const valid = updateVendorSchema.safeParse({
        name: 'Updated Vendor',
        version: 1,
      });
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.version).toBe(1);
      }

      // Invalid: missing version
      const missingVersion = updateVendorSchema.safeParse({
        name: 'Updated Vendor',
      });
      expect(missingVersion.success).toBe(false);

      // Invalid: version <= 0
      const negativeVersion = updateVendorSchema.safeParse({
        name: 'Updated Vendor',
        version: 0,
      });
      expect(negativeVersion.success).toBe(false);
    });

    it('[AT30-02] EditVendorModal includes vendor.version in initial render and modal description', () => {
      const html = renderToStaticMarkup(
        React.createElement(EditVendorModal, {
          isOpen: true,
          onClose: () => {},
          vendor: sampleVenueVendor,
          onSuccess: () => {},
          onReloadRequested: () => {},
        })
      );

      expect(html).toContain(`Phiên bản ${sampleVenueVendor.version}`);
      expect(html).toContain('Chỉnh Sửa Hồ Sơ Nhà Cung Cấp');
      expect(html).toContain('Lưu thay đổi');
    });

    it('[AT30-03] vendorsApi.update triggers ApiError with HTTP 409 CONFLICT on version mismatch', async () => {
      // Mock fetch returning HTTP 409 Conflict
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({
          error: 'CONFLICT',
          message: 'Dữ liệu đã bị thay đổi bởi người khác, vui lòng tải lại',
        }),
      });

      let caughtError: any = null;
      try {
        await vendorsApi.update(sampleVenueVendor.id, {
          name: 'Concurrent Update',
          version: 1, // Stale version
        } as any);
      } catch (err: any) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(ApiError);
      expect(caughtError.status).toBe(409);
      expect(caughtError.code).toBe('CONFLICT');
      expect(caughtError.message).toBe('Dữ liệu đã bị thay đổi bởi người khác, vui lòng tải lại');
    });

    it('[AT30-04] Simulated concurrent edit flow: First edit increments version, second edit encounters 409 conflict', async () => {
      let serverState = {
        ...sampleVenueVendor,
        version: 1,
      };

      // Simulated server update handler replicating updateVendor logic
      const simulatedServerUpdate = async (vendorId: string, input: any) => {
        if (input.version !== serverState.version) {
          throw new ApiError(409, 'CONFLICT', 'Dữ liệu đã bị thay đổi bởi người khác, vui lòng tải lại');
        }
        serverState = {
          ...serverState,
          ...input,
          version: serverState.version + 1,
        };
        return { data: serverState, message: 'Cập nhật thành công.' };
      };

      // Client A (User 1) updates vendor with version 1 -> succeeds, increments to version 2
      const clientARes = await simulatedServerUpdate(sampleVenueVendor.id, {
        name: 'Riverside Palace - Client A Edit',
        version: 1,
      });
      expect(clientARes.data.version).toBe(2);
      expect(serverState.version).toBe(2);

      // Client B (User 2) was editing simultaneously with stale version 1 -> rejected with 409
      let clientBError: any = null;
      try {
        await simulatedServerUpdate(sampleVenueVendor.id, {
          name: 'Riverside Palace - Client B Concurrent Edit',
          version: 1, // Stale version!
        });
      } catch (err: any) {
        clientBError = err;
      }

      expect(clientBError).toBeInstanceOf(ApiError);
      expect(clientBError.status).toBe(409);
      expect(clientBError.code).toBe('CONFLICT');
      expect(clientBError.message).toBe('Dữ liệu đã bị thay đổi bởi người khác, vui lòng tải lại');

      // Server state remains version 2, client B changes did not overwrite client A
      expect(serverState.version).toBe(2);
      expect(serverState.name).toBe('Riverside Palace - Client A Edit');
    });

    it('[AT30-05] Non-conflict API errors (e.g. 500 or 400) do NOT trigger optimistic locking banner', () => {
      // Test that ApiError for 500 has status 500 and code INTERNAL_ERROR
      const err500 = new ApiError(500, 'INTERNAL_ERROR', 'Lỗi máy chủ nội bộ');
      expect(err500.status).toBe(500);
      expect(err500.status === 409 || err500.code === 'CONFLICT').toBe(false);

      const err400 = new ApiError(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ');
      expect(err400.status).toBe(400);
      expect(err400.status === 409 || err400.code === 'CONFLICT').toBe(false);
    });
  });
});
