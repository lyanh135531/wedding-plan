import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RoleProvider } from '@/context/RoleContext';
import {
  MenusScreen,
  MealBreakdownDashboard,
  MenuCourseList,
  SnapshotLockingModal,
  Menu,
  MealSummary,
} from '@/components/modules/menus';

const h = React.createElement;

describe('S19: Menus & Catering Screen & Components Unit Tests', () => {
  const mockMenu: Menu = {
    id: 'm_test_01',
    name: 'Thực Đơn Cưới VIP Sảnh Ngọc',
    mealType: 'banquet',
    description: 'Thực đơn 8 món chuẩn bị tiệc tối',
    isActive: true,
    version: 1,
    pricePerTable: 6500000,
    items: [
      {
        id: 'i_01',
        menuId: 'm_test_01',
        courseOrder: 1,
        courseType: 'appetizer',
        name: 'Súp Hải Sản Điệp Cơ',
        dietaryFlags: ['seafood'],
        allergens: 'Hải sản, tôm',
        price: 800000,
      },
      {
        id: 'i_02',
        menuId: 'm_test_01',
        courseOrder: 2,
        courseType: 'main',
        name: 'Gà Quay Mật Ong & Bánh Bao',
        dietaryFlags: ['gluten_free'],
        price: 900000,
      },
      {
        id: 'i_03',
        menuId: 'm_test_01',
        courseOrder: 3,
        courseType: 'dessert',
        name: 'Chè Sen Nhãn Lồng Long An',
        dietaryFlags: ['vegetarian', 'kids'],
        price: 350000,
      },
      {
        id: 'i_04',
        menuId: 'm_test_01',
        courseOrder: 4,
        courseType: 'beverage',
        name: 'Bia Tiger Crystal & Nước Suối',
        dietaryFlags: ['halal'],
        price: 450000,
      },
    ],
  };

  const mockSummary: MealSummary = {
    adultMeals: 150,
    childMeals: 20,
    vegetarianMeals: 15,
    specialMeals: 5,
    bufferMeals: 10,
    totalMeals: 200,
    confirmedGuests: 190,
  };

  describe('Role-Aware Rendering (AT03, AT26)', () => {
    it('renders full management controls, lock button, and pricing for owner role', () => {
      const html = renderToStaticMarkup(
        h(
          RoleProvider,
          { initialRole: 'owner' },
          h(MenusScreen, {
            initialState: 'populated',
            initialMenus: [mockMenu],
            initialSummary: mockSummary,
          })
        )
      );

      // Header & management actions
      expect(html).toContain('Thực Đơn &amp; Suất Ăn Tiệc Cưới');
      expect(html).toContain('Chốt &amp; Khóa Thực Đơn');
      expect(html).toContain('Thêm thực đơn mới');
      expect(html).toContain('Thêm món');

      // Pricing details: Owner can see
      expect(html).toContain('6.500.000');
      expect(html).toContain('800.000');
    });

    it('strictly hides lock button, add/edit buttons, and pricing details for family_view role (AT03, AT26)', () => {
      const html = renderToStaticMarkup(
        h(
          RoleProvider,
          { initialRole: 'family_view' },
          h(MenusScreen, {
            initialState: 'populated',
            initialMenus: [mockMenu],
            initialSummary: mockSummary,
          })
        )
      );

      expect(html).toContain('Thực Đơn &amp; Suất Ăn Tiệc Cưới');
      expect(html).toContain('Chế độ Người nhà (family_view)');

      // MUST NOT contain lock or add buttons
      expect(html).not.toContain('Chốt &amp; Khóa Thực Đơn');
      expect(html).not.toContain('Thêm thực đơn mới');
      expect(html).not.toContain('Thêm món');

      // MUST NOT reveal pricing information
      expect(html).not.toContain('6.500.000');
      expect(html).not.toContain('800.000');
      expect(html).not.toContain('900.000');
      expect(html).not.toContain('Đơn giá dự kiến');

      // MUST NOT have edit/delete dish icons
      expect(html).not.toContain('title="Sửa món"');
      expect(html).not.toContain('title="Xóa món"');
    });
  });

  describe('Live Meal Breakdown Dashboard', () => {
    it('displays meal counts and compares against confirmed RSVP attendees', () => {
      const html = renderToStaticMarkup(
        h(MealBreakdownDashboard, { summary: mockSummary })
      );

      expect(html).toContain('Thống Kê Suất Ăn &amp; Đối Chiếu RSVP');
      expect(html).toContain('150'); // adult
      expect(html).toContain('20'); // child
      expect(html).toContain('15'); // vegetarian
      expect(html).toContain('5'); // special
      expect(html).toContain('10'); // buffer
      expect(html).toContain('190'); // confirmed guests
      expect(html).toContain('Dự phòng an toàn +10 suất');
    });
  });

  describe('Course Items & Dietary Tags', () => {
    it('renders course categories and dietary tags properly', () => {
      const html = renderToStaticMarkup(
        h(
          RoleProvider,
          { initialRole: 'owner' },
          h(MenuCourseList, { menu: mockMenu })
        )
      );

      // Course categories
      expect(html).toContain('Món Khai Vị');
      expect(html).toContain('Món Chính');
      expect(html).toContain('Món Tráng Miệng');
      expect(html).toContain('Đồ Uống &amp; Rượu Tiệc');

      // Dietary flags
      expect(html).toContain('Hải sản');
      expect(html).toContain('Không Gluten');
      expect(html).toContain('Ăn chay');
      expect(html).toContain('Món trẻ em');
      expect(html).toContain('Halal');

      // Allergen warning
      expect(html).toContain('Dị ứng: Hải sản, tôm');
    });
  });

  describe('Snapshot Locking Modal (AT52)', () => {
    it('displays freezing warning and confirmed meal counts', () => {
      const html = renderToStaticMarkup(
        h(SnapshotLockingModal, {
          isOpen: true,
          onClose: () => {},
          summary: mockSummary,
          onLockSnapshot: () => {},
        })
      );

      expect(html).toContain('Chốt &amp; Khóa Thực Đơn Tiệc Cưới (Snapshot AT52)');
      expect(html).toContain('Lưu ý đóng băng dữ liệu suất ăn (AT52)');
      expect(html).toContain('Khóa thực đơn ngay');
      expect(html).toContain('150'); // adult
      expect(html).toContain('200'); // total
    });
  });
});
