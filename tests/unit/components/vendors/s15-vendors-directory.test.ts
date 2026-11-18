import { describe, it, expect, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  VendorCountersBar,
  VendorFilterBar,
  VendorListDesktop,
  VendorCardMobile,
  VendorQuickCompareBar,
  AddVendorModal,
  VendorsDirectory,
  FIXTURE_VENDORS,
} from '@/components/modules/vendors';
import { RoleProvider } from '@/context/RoleContext';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/vendors',
}));

describe('S15 Vendors Directory Components', () => {
  it('VendorCountersBar correctly displays metrics for vendors', () => {
    const html = renderToStaticMarkup(
      React.createElement(VendorCountersBar, {
        vendors: FIXTURE_VENDORS,
        totalCount: 5,
      })
    );

    expect(html).toContain('Tổng số đối tác');
    expect(html).toContain('Đang tìm hiểu / Liên hệ');
    expect(html).toContain('Đã nhận báo giá');
    expect(html).toContain('Đã chốt hợp đồng');
    expect(html).toContain('5'); // Total
  });

  it('VendorFilterBar renders search input, dropdowns and all service types', () => {
    const html = renderToStaticMarkup(
      React.createElement(VendorFilterBar, {
        searchQuery: 'Riverside',
        onSearchChange: () => {},
        serviceTypeFilter: 'venue',
        onServiceTypeChange: () => {},
        onStatusChange: () => {},
        statusFilter: 'selected',
        onClearFilters: () => {},
        totalFilteredCount: 1,
      })
    );

    expect(html).toContain('Tìm theo tên nhà cung cấp');
    expect(html).toContain('Tất cả dịch vụ');
    expect(html).toContain('Địa điểm &amp; Sảnh tiệc');
    expect(html).toContain('Tiệc &amp; Ẩm thực');
    expect(html).toContain('Chụp ảnh');
    expect(html).toContain('Tất cả trạng thái');
    expect(html).toContain('Đã chốt hợp đồng');
    expect(html).toContain('Xóa bộ lọc');
    expect(html).toContain('1 kết quả phù hợp');
  });

  it('VendorListDesktop renders desktop table with compare checkbox for Owner', () => {
    const html = renderToStaticMarkup(
      React.createElement(VendorListDesktop, {
        vendors: FIXTURE_VENDORS,
        isOwner: true,
        selectedVendorIds: [FIXTURE_VENDORS[0].id],
        onToggleSelectVendor: () => {},
      })
    );

    expect(html).toContain('Nhà cung cấp / Dịch vụ');
    expect(html).toContain('Trung Tâm Tiệc Cưới Riverside Palace');
    expect(html).toContain('Gem Center Grand Ballroom');
    expect(html).toContain('Chọn so sánh'); // Table header checkbox
    expect(html).toContain('Đã chốt hợp đồng');
    expect(html).toContain('5.500.000 ₫/bàn'); // Formatted VND table price
    expect(html).toContain('25.000.000 ₫'); // Rental fee
  });

  it('VendorListDesktop hides comparison checkboxes for Family View (AT03, AT41)', () => {
    const html = renderToStaticMarkup(
      React.createElement(VendorListDesktop, {
        vendors: FIXTURE_VENDORS,
        isOwner: false, // Family View
        selectedVendorIds: [],
        onToggleSelectVendor: () => {},
      })
    );

    expect(html).toContain('Trung Tâm Tiệc Cưới Riverside Palace');
    // Checkbox column should NOT be rendered for family view
    expect(html).not.toContain('Chọn so sánh');
  });

  it('VendorCardMobile renders mobile cards with direct tel: phone links and touch targets', () => {
    const html = renderToStaticMarkup(
      React.createElement(VendorCardMobile, {
        vendors: FIXTURE_VENDORS,
        isOwner: true,
        selectedVendorIds: [],
        onToggleSelectVendor: () => {},
      })
    );

    expect(html).toContain('tel:0901234567');
    expect(html).toContain('tel:0912345678');
    expect(html).toContain('Sức chứa tối đa:');
    expect(html).toContain('600 khách');
    expect(html).toContain('Chi tiết');
  });

  it('VendorCardMobile hides comparison checkboxes for Family View (AT03, AT41)', () => {
    const html = renderToStaticMarkup(
      React.createElement(VendorCardMobile, {
        vendors: FIXTURE_VENDORS,
        isOwner: false, // Family View
        selectedVendorIds: [],
        onToggleSelectVendor: () => {},
      })
    );

    expect(html).toContain('Trung Tâm Tiệc Cưới Riverside Palace');
    expect(html).not.toContain('Chọn so sánh Trung Tâm Tiệc Cưới Riverside Palace');
  });

  it('VendorQuickCompareBar renders floating dock when 2-4 partners are selected', () => {
    const html = renderToStaticMarkup(
      React.createElement(VendorQuickCompareBar, {
        selectedVendorIds: [FIXTURE_VENDORS[0].id, FIXTURE_VENDORS[1].id],
        vendors: FIXTURE_VENDORS,
        onClearSelection: () => {},
      })
    );

    expect(html).toContain('Đã chọn 2/4 đối tác');
    expect(html).toContain('Sẵn sàng đối chiếu chi tiết báo giá &amp; sảnh tiệc');
    expect(html).toContain('So sánh ngay');
    expect(html).toContain('Bỏ chọn');
  });

  it('VendorQuickCompareBar returns null when 0 partners selected', () => {
    const html = renderToStaticMarkup(
      React.createElement(VendorQuickCompareBar, {
        selectedVendorIds: [],
        vendors: FIXTURE_VENDORS,
        onClearSelection: () => {},
      })
    );

    expect(html).toBe('');
  });

  it('AddVendorModal renders venue fields when serviceType is venue', () => {
    const html = renderToStaticMarkup(
      React.createElement(AddVendorModal, {
        isOpen: true,
        onClose: () => {},
        onSuccess: () => {},
      })
    );

    expect(html).toContain('Thêm Nhà Cung Cấp Mới');
    expect(html).toContain('Tên nhà cung cấp *');
    expect(html).toContain('Loại dịch vụ *');
    expect(html).toContain('Ghi chú nội bộ (Chỉ Chủ sở hữu xem được)');
  });

  it('VendorsDirectory renders Add Vendor button for Owner and hides it for Family View (AT03, AT41)', () => {
    // Owner view
    const ownerHtml = renderToStaticMarkup(
      React.createElement(
        RoleProvider,
        { initialRole: 'owner' },
        React.createElement(VendorsDirectory, { initialVendors: FIXTURE_VENDORS })
      )
    );
    expect(ownerHtml).toContain('Thêm nhà cung cấp');
    expect(ownerHtml).toContain('Danh Mục Nhà Cung Cấp &amp; Địa Điểm');

    // Family view
    const familyHtml = renderToStaticMarkup(
      React.createElement(
        RoleProvider,
        { initialRole: 'family_view' },
        React.createElement(VendorsDirectory, { initialVendors: FIXTURE_VENDORS })
      )
    );
    expect(familyHtml).not.toContain('Thêm nhà cung cấp');
    expect(familyHtml).toContain('Chế độ Người nhà (Chỉ xem)');
  });
});
