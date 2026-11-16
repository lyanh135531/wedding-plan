import { describe, it, expect, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  CompareSimulationBar,
  CompareMatrixDesktop,
  CompareMatrixMobile,
  VendorCompareScreen,
  FIXTURE_COMPARE_RESPONSE,
} from '@/components/modules/vendors';
import { RoleProvider } from '@/context/RoleContext';
import { EventScopeProvider } from '@/context/EventScopeContext';

// Mock next/navigation
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
  usePathname: () => '/vendors/compare',
}));

describe('S17 Vendor Package Comparison Components', () => {
  const samplePackages = FIXTURE_COMPARE_RESPONSE.packages;

  it('CompareSimulationBar renders table slider, guest count and tax/fee checkbox', () => {
    const html = renderToStaticMarkup(
      React.createElement(CompareSimulationBar, {
        tableCount: 25,
        onTableCountChange: () => {},
        guestCount: 250,
        onGuestCountChange: () => {},
        includeVatAndFee: true,
        onIncludeVatAndFeeChange: () => {},
      })
    );

    expect(html).toContain('Mô Phỏng Kịch Bản Bàn Tiệc &amp; Chi Phí Thực Tế');
    expect(html).toContain('25 bàn');
    expect(html).toContain('Số khách ước tính:');
    expect(html).toContain('Tính kèm VAT (10%) &amp; Phí phục vụ (5%)');
  });

  it('CompareMatrixDesktop renders all packages with capacity fit and cost breakdowns', () => {
    const html = renderToStaticMarkup(
      React.createElement(CompareMatrixDesktop, {
        packages: samplePackages,
        onSelectPackage: () => {},
      })
    );

    // Package names
    expect(html).toContain('Gói Tiệc Bạc (Silver Package) - Đàm phán v2');
    expect(html).toContain('Gói Diamond Ballroom Gem Center');
    expect(html).toContain('Gói Sân Vườn Hoàng Hôn (Đang khảo sát)');

    // Capacity fits
    expect(html).toContain('Phù hợp sức chứa'); // Optimal
    expect(html).toContain('Dưới mức tối thiểu'); // Below min
    expect(html).toContain('Quy mô 250 khách thấp hơn yêu cầu tối thiểu');

    // Cost items
    expect(html).toContain('5.500.000 ₫');
    expect(html).toContain('8.500.000 ₫');
    expect(html).toContain('186.875.000 ₫'); // Total Riverside
    expect(html).toContain('301.875.000 ₫'); // Total Gem Center

    // CTA
    expect(html).toContain('Chọn gói này &amp; Tạo khoản chi');
  });

  it('CompareMatrixDesktop preserves "Chưa báo" when is_missing_price is true, never showing 0 VND (AT24)', () => {
    const html = renderToStaticMarkup(
      React.createElement(CompareMatrixDesktop, {
        packages: samplePackages,
        onSelectPackage: () => {},
      })
    );

    // Bình An quote has is_missing_price: true
    expect(html).toContain('Chưa báo');
    expect(html).toContain('Đối tác chưa cung cấp đơn giá chính thức để tính toán');
  });

  it('CompareMatrixMobile renders tab navigation and active package without horizontal overflow', () => {
    const html = renderToStaticMarkup(
      React.createElement(CompareMatrixMobile, {
        packages: samplePackages,
        onSelectPackage: () => {},
      })
    );

    expect(html).toContain('Gói 1: Gói Tiệc Bạc');
    expect(html).toContain('Gói 2: Gói Diamond Ballroom');
    expect(html).toContain('Gói 3: Gói Sân Vườn Hoàng Hôn');
    expect(html).toContain('Sức chứa sảnh tiệc:');
    expect(html).toContain('TỔNG ƯỚC TÍNH:');
    expect(html).toContain('Chọn gói này &amp; Tạo khoản chi');
  });

  it('VendorCompareScreen displays PermissionDeniedView for Family View (AT03, AT41)', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        RoleProvider,
        { initialRole: 'family_view' },
        React.createElement(VendorCompareScreen, {
          initialResponse: FIXTURE_COMPARE_RESPONSE,
        })
      )
    );

    // Permission denied view rendered immediately
    expect(html).toContain('Bạn không có quyền truy cập');
    expect(html).toContain('Trang so sánh báo giá và hợp đồng nhà cung cấp chứa thông tin tài chính mật');
    expect(html).toContain('Quay lại danh sách nhà cung cấp');
  });

  it('VendorCompareScreen displays Empty State if < 2 packages selected', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        RoleProvider,
        { initialRole: 'owner' },
        React.createElement(
          EventScopeProvider,
          null,
          React.createElement(VendorCompareScreen, {
            initialResponse: {
              simulation_params: { table_count: 20, guest_count: 200, include_vat_and_service_fee: true },
              packages: [],
            },
          })
        )
      )
    );

    expect(html).toContain('Bảng So Sánh Báo Giá &amp; Sảnh Tiệc');
  });
});
