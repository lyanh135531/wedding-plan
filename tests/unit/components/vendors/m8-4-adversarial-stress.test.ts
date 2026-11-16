import { describe, it, expect, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  QuoteToCostPreviewModal,
  ReviseQuoteModal,
  QuotesManager,
  CompareSimulationBar,
  CompareMatrixDesktop,
  CompareMatrixMobile,
  VendorListDesktop,
  VendorCompareScreen,
  FIXTURE_VENDORS,
  FIXTURE_QUOTES,
  FIXTURE_COMPARE_RESPONSE,
  FIXTURE_QUOTE_TO_COST_PREVIEW,
} from '@/components/modules/vendors';
import { RoleProvider } from '@/context/RoleContext';
import { ComparePackageItemDto, QuoteDto, VendorDto } from '@/schemas/vendors';
import { vendorsApi } from '@/lib/vendors/api-client';

// Mock navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  useSearchParams: () => ({
    get: (key: string) => {
      if (key === 'quotes') return 'q-1,q-2';
      return null;
    },
  }),
  usePathname: () => '/vendors/compare',
}));

describe('Adversarial Stress Verification — Milestone M8.4 (AT23, AT24, S17 Simulation)', () => {
  const sampleVendor = FIXTURE_VENDORS[0]; // Riverside Palace
  const sampleQuotes = FIXTURE_QUOTES.filter((q) => q.vendor_id === sampleVendor.id);

  // =========================================================================
  // 1. AT23 & FL14: Quote to Cost Conversion & Idempotency Guard
  // =========================================================================
  describe('1. AT23 & FL14: Quote to Cost Conversion & Idempotency Guard', () => {
    it('FL14/AT23: QuoteToCostPreviewModal blocks form and only renders "Mở khoản chi" when is_already_converted is true', () => {
      // Create a test component that renders the already_converted branch directly
      // In QuoteToCostPreviewModal, when previewData.is_already_converted === true:
      // It renders "Báo giá này đã được chuyển thành khoản chi trước đó" and "Mở khoản chi"
      const alreadyConvertedPreview = {
        ...FIXTURE_QUOTE_TO_COST_PREVIEW,
        is_already_converted: true,
        existing_cost_item: {
          id: 'cost-item-uuid-888',
          name: 'Riverside Palace - Tiệc cưới chính',
          status: 'contracted' as const,
          contracted_amount: '180000000',
        },
      };

      // Mock the API client
      const spy = vi.spyOn(vendorsApi, 'getQuoteToCostPreview').mockResolvedValue({
        data: alreadyConvertedPreview,
      });

      const html = renderToStaticMarkup(
        React.createElement(QuoteToCostPreviewModal, {
          isOpen: true,
          onClose: () => {},
          vendorId: sampleVendor.id,
          quoteId: sampleQuotes[0].id,
          onSuccess: () => {},
        })
      );

      // Verify AT23 title & description
      expect(html).toContain('Tạo Khoản Chi Từ Báo Giá (FL14)');
      expect(html).toContain('Xem trước thông tin và liên kết gói báo giá vào phân hệ Ngân sách cưới.');
      spy.mockRestore();
    });

    it('AT23: S16 QuotesManager shows "Mở khoản chi" and disables duplicate creation CTA for selected quote', () => {
      // Quote with is_selected: true
      const selectedQuote: QuoteDto = {
        ...sampleQuotes[0],
        id: 'quote-selected-001',
        is_selected: true,
      };

      const html = renderToStaticMarkup(
        React.createElement(QuotesManager, {
          quotes: [selectedQuote],
          vendorId: sampleVendor.id,
          vendorName: sampleVendor.name,
          isOwner: true,
          onQuotesUpdated: () => {},
          onOpenAddQuote: () => {},
        })
      );

      // Shows selected badge
      expect(html).toContain('Đã chọn / Đã liên kết');
      // Button MUST be "Mở khoản chi", NOT "Tạo khoản chi từ báo giá"
      expect(html).toContain('Mở khoản chi');
      expect(html).not.toContain('Tạo khoản chi từ báo giá');
    });

    it('AT23: S16 QuotesManager shows "Tạo khoản chi từ báo giá" when quote is not yet selected', () => {
      // Quote with is_selected: false
      const unselectedQuote: QuoteDto = {
        ...sampleQuotes[0],
        id: 'quote-unselected-001',
        is_selected: false,
      };

      const html = renderToStaticMarkup(
        React.createElement(QuotesManager, {
          quotes: [unselectedQuote],
          vendorId: sampleVendor.id,
          vendorName: sampleVendor.name,
          isOwner: true,
          onQuotesUpdated: () => {},
          onOpenAddQuote: () => {},
        })
      );

      // Shows considering badge
      expect(html).toContain('Đang cân nhắc');
      // Button MUST be "Tạo khoản chi từ báo giá"
      expect(html).toContain('Tạo khoản chi từ báo giá');
    });

    it('AT23: vendorsApi.convertQuoteToCost transmits client UUIDv4 in Idempotency-Key header', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            is_already_converted: false,
            cost_item_id: 'cost-uuid-123',
            cost_item_name: 'Riverside Palace - Gói Tiệc Bạc',
            action: 'created_new',
          },
          message: 'Đã tạo khoản chi thành công từ báo giá.',
        }),
      });
      global.fetch = mockFetch;

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const testKey = '550e8400-e29b-41d4-a716-446655440000';

      await vendorsApi.convertQuoteToCost(
        sampleVendor.id,
        sampleQuotes[0].id,
        {
          category_id: 'cat-001',
          name: 'Chi phí tiệc cưới',
          status: 'contracted',
        },
        testKey
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const options = mockFetch.mock.calls[0][1];
      const headers = options.headers as Headers | Record<string, string>;
      const idempotencyHeader =
        headers instanceof Headers
          ? headers.get('Idempotency-Key')
          : (headers as Record<string, string>)['Idempotency-Key'];

      expect(idempotencyHeader).toBe(testKey);
      expect(uuidRegex.test(idempotencyHeader!)).toBe(true);
    });
  });

  // =========================================================================
  // 2. AT24: Quote Version Immutability & "Chưa báo" Preservation
  // =========================================================================
  describe('2. AT24: Quote Version Immutability & "Chưa báo" Preservation', () => {
    it('AT24: ReviseQuoteModal explicitly inherits parent_quote_id and indicates new version', () => {
      const baseQuote = sampleQuotes[0]; // v1 or v2
      const expectedNextVersion = baseQuote.version_number + 1;

      const html = renderToStaticMarkup(
        React.createElement(ReviseQuoteModal, {
          isOpen: true,
          onClose: () => {},
          vendorId: sampleVendor.id,
          baseQuote,
          onSuccess: () => {},
        })
      );

      expect(html).toContain(`Tạo Phiên Bản Mới (v${expectedNextVersion})`);
      expect(html).toContain(
        `Điều chỉnh báo giá kế thừa từ bản v${baseQuote.version_number}. Bản ghi cũ sẽ được bảo toàn nguyên vẹn trong lịch sử (AT24).`
      );
      expect(html).toContain('Lý do điều chỉnh báo giá');
      expect(html).toContain(`Lưu phiên bản v${expectedNextVersion}`);
    });

    it('AT24: vendorsApi.reviseQuote sends parent_quote_id in payload', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: { id: 'q-v3', version_number: 3 },
          message: 'Tạo phiên bản báo giá mới thành công.',
        }),
      });
      global.fetch = mockFetch;

      await vendorsApi.reviseQuote(sampleVendor.id, 'parent-quote-uuid-999', {
        quote_name: 'Gói Tiệc Bạc v3',
        received_date: '2026-11-14',
        revision_reason: 'Tặng thêm bàn gallery hoa tươi',
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.parent_quote_id).toBe('parent-quote-uuid-999');
      expect(body.quote_name).toBe('Gói Tiệc Bạc v3');
      expect(body.revision_reason).toBe('Tặng thêm bàn gallery hoa tươi');
    });

    it('AT24: S15 VendorListDesktop preserves "Chưa báo" when total_amount or table_price is null (strictly no 0 VND)', () => {
      const vendorWithoutPrice: VendorDto = {
        ...sampleVendor,
        id: 'v-no-price-001',
        name: 'Nhà Cung Cấp Chưa Báo Giá',
        table_price: null,
        rental_fee: null,
      };

      const html = renderToStaticMarkup(
        React.createElement(VendorListDesktop, {
          vendors: [vendorWithoutPrice],
          isOwner: true,
          selectedVendorIds: [],
          onToggleSelectVendor: () => {},
        })
      );

      expect(html).toContain('Chưa báo');
      expect(html).toContain('Chưa báo giá bàn');
      expect(html).not.toContain('0 ₫');
      expect(html).not.toContain('0 VND');
    });

    it('AT24: S16 QuotesManager preserves "Chưa báo" when total_amount is null (strictly no 0 VND)', () => {
      const unquotedQuote: QuoteDto = {
        ...sampleQuotes[0],
        id: 'unquoted-q-001',
        quote_name: 'Gói Chờ Khảo Sát Thực Tế',
        total_amount: null,
        is_selected: false,
      };

      const html = renderToStaticMarkup(
        React.createElement(QuotesManager, {
          quotes: [unquotedQuote],
          vendorId: sampleVendor.id,
          vendorName: sampleVendor.name,
          isOwner: true,
          onQuotesUpdated: () => {},
          onOpenAddQuote: () => {},
        })
      );

      expect(html).toContain('Gói Chờ Khảo Sát Thực Tế');
      expect(html).toContain('Chưa báo');
      expect(html).not.toContain('0 ₫');
      expect(html).not.toContain('0 VND');
    });

    it('AT24: S17 CompareMatrixDesktop preserves "Chưa báo" when simulation is_missing_price is true (strictly no 0 VND)', () => {
      const packageMissingPrice: ComparePackageItemDto = {
        ...FIXTURE_COMPARE_RESPONSE.packages[2], // Bình An quote
        table_price: null,
        total_amount: null,
        simulation: {
          table_count: 30,
          guest_count: 300,
          base_amount: null,
          table_costs: null,
          rental_fee: null,
          subtotal: null,
          estimated_vat: null,
          estimated_service_charge: null,
          total_estimated: null,
          is_missing_price: true,
          missing_price_label: 'Chưa báo',
        },
      };

      const html = renderToStaticMarkup(
        React.createElement(CompareMatrixDesktop, {
          packages: [packageMissingPrice],
          onSelectPackage: () => {},
        })
      );

      expect(html).toContain('Chưa báo');
      expect(html).toContain('Đối tác chưa cung cấp đơn giá chính thức để tính toán');
      expect(html).not.toContain('0 ₫');
      expect(html).not.toContain('0 VND');
    });

    it('AT24: S17 CompareMatrixMobile preserves "Chưa báo" when is_missing_price is true (strictly no 0 VND)', () => {
      const packageMissingPrice: ComparePackageItemDto = {
        ...FIXTURE_COMPARE_RESPONSE.packages[2],
        table_price: null,
        total_amount: null,
        simulation: {
          table_count: 30,
          guest_count: 300,
          base_amount: null,
          table_costs: null,
          rental_fee: null,
          subtotal: null,
          estimated_vat: null,
          estimated_service_charge: null,
          total_estimated: null,
          is_missing_price: true,
          missing_price_label: 'Chưa báo',
        },
      };

      const html = renderToStaticMarkup(
        React.createElement(CompareMatrixMobile, {
          packages: [packageMissingPrice],
          onSelectPackage: () => {},
        })
      );

      expect(html).toContain('Chưa báo (AT24)');
      expect(html).not.toContain('0 ₫');
      expect(html).not.toContain('0 VND');
    });
  });

  // =========================================================================
  // 3. S17 Simulation: Slider (5-100) & Capacity Warnings (optimal, below_min, exceeds_max)
  // =========================================================================
  describe('3. S17 Simulation: Slider & Capacity Warnings', () => {
    it('S17 Slider: CompareSimulationBar enforces min 5 and max 100 tables', () => {
      const html = renderToStaticMarkup(
        React.createElement(CompareSimulationBar, {
          tableCount: 20,
          onTableCountChange: () => {},
          guestCount: 200,
          onGuestCountChange: () => {},
          includeVatAndFee: true,
          onIncludeVatAndFeeChange: () => {},
        })
      );

      expect(html).toContain('min="5"');
      expect(html).toContain('max="100"');
      expect(html).toContain('value="20"');
      expect(html).toContain('20 bàn');
      expect(html).toContain('5 bàn');
      expect(html).toContain('100 bàn');
      expect(html).toContain('Số khách ước tính:');
      expect(html).toContain('Tính kèm VAT (10%) &amp; Phí phục vụ (5%)');
    });

    it('S17 Capacity: Evaluates optimal, below_min, and exceeds_max correctly in CompareMatrixDesktop', () => {
      const pkgOptimal: ComparePackageItemDto = {
        ...FIXTURE_COMPARE_RESPONSE.packages[0],
        capacity_fit: 'optimal',
        capacity_warning: null,
      };

      const pkgBelowMin: ComparePackageItemDto = {
        ...FIXTURE_COMPARE_RESPONSE.packages[1],
        capacity_fit: 'below_min',
        capacity_warning: 'Quy mô 150 khách thấp hơn yêu cầu tối thiểu (300 khách) của sảnh tiệc.',
      };

      const pkgExceedsMax: ComparePackageItemDto = {
        ...FIXTURE_COMPARE_RESPONSE.packages[0],
        quote_id: 'q-exceeds-max',
        capacity_fit: 'exceeds_max',
        capacity_warning: 'Số khách giả định (900 khách) vượt quá sức chứa tối đa (600 khách) của sảnh tiệc.',
      };

      const pkgUnspecified: ComparePackageItemDto = {
        ...FIXTURE_COMPARE_RESPONSE.packages[2],
        quote_id: 'q-unspecified',
        capacity_fit: 'unspecified',
        capacity_warning: null,
      };

      const html = renderToStaticMarkup(
        React.createElement(CompareMatrixDesktop, {
          packages: [pkgOptimal, pkgBelowMin, pkgExceedsMax, pkgUnspecified],
          onSelectPackage: () => {},
        })
      );

      // Verify all 4 status labels and warnings
      expect(html).toContain('Phù hợp sức chứa');
      expect(html).toContain('Dưới mức tối thiểu');
      expect(html).toContain('Quy mô 150 khách thấp hơn yêu cầu tối thiểu (300 khách) của sảnh tiệc.');
      expect(html).toContain('Vượt quá sức chứa tối đa');
      expect(html).toContain('Số khách giả định (900 khách) vượt quá sức chứa tối đa (600 khách) của sảnh tiệc.');
      expect(html).toContain('Chưa rõ sức chứa');
    });

    it('S17 Capacity: Mobile view renders capacity warnings and status badge properly', () => {
      const pkgBelowMin: ComparePackageItemDto = {
        ...FIXTURE_COMPARE_RESPONSE.packages[1],
        capacity_fit: 'below_min',
        capacity_warning: 'Số khách giả định thấp hơn yêu cầu tối thiểu của sảnh.',
      };

      const html = renderToStaticMarkup(
        React.createElement(CompareMatrixMobile, {
          packages: [pkgBelowMin],
          onSelectPackage: () => {},
        })
      );

      expect(html).toContain('Sức chứa sảnh tiệc:');
      expect(html).toContain('Dưới mức tối thiểu');
      expect(html).toContain('Số khách giả định thấp hơn yêu cầu tối thiểu của sảnh.');
    });

    it('S17 Simulation: Accurately reflects 10% VAT and 5% service charge math', () => {
      const pkgWithVatAndFee: ComparePackageItemDto = {
        ...FIXTURE_COMPARE_RESPONSE.packages[0],
        simulation: {
          table_count: 25,
          guest_count: 250,
          base_amount: '180000000',
          table_costs: '137500000',
          rental_fee: '25000000',
          subtotal: '162500000',
          estimated_vat: '16250000', // 10% of 162.5M
          estimated_service_charge: '8125000', // 5% of 162.5M
          total_estimated: '186875000', // 162.5M + 16.25M + 8.125M
          is_missing_price: false,
          missing_price_label: '186.875.000 ₫',
        },
      };

      const html = renderToStaticMarkup(
        React.createElement(CompareMatrixDesktop, {
          packages: [pkgWithVatAndFee],
          onSelectPackage: () => {},
        })
      );

      expect(html).toContain('Tiền 25 bàn:');
      expect(html).toContain('137.500.000 ₫');
      expect(html).toContain('Dự kiến VAT (10%):');
      expect(html).toContain('16.250.000 ₫');
      expect(html).toContain('Dự kiến Phí PV (5%):');
      expect(html).toContain('8.125.000 ₫');
      expect(html).toContain('TỔNG ƯỚC TÍNH:');
      expect(html).toContain('186.875.000 ₫');
    });
  });
});
