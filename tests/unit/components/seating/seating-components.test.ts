import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RoleProvider } from '@/context/RoleContext';
import {
  SeatingManager,
  TableCard,
  SeatingConflictAlerts,
  SeatingExportModal,
  AddEditTableModal,
  TableItem,
  GuestSeatingItem,
} from '@/components/modules/seating';

const h = React.createElement;

describe('S18: Seating Screen & Components Unit Tests', () => {
  const mockTables: TableItem[] = [
    {
      id: 'tbl_01',
      name: 'Bàn VIP 01 (Nhà Trai)',
      tableNumber: '01',
      shape: 'round',
      capacity: 10,
      notes: 'Ghi chú mật bàn VIP: Gần sân khấu chính',
      seatedGuestIds: ['g_01', 'g_02'],
      version: 1,
    },
    {
      id: 'tbl_02',
      name: 'Bàn Bạn Bè 02',
      tableNumber: '02',
      shape: 'rectangular',
      capacity: 2, // will be full with 2 guests
      notes: 'Ghi chú mật: Bàn ồn ào nhất tiệc',
      seatedGuestIds: ['g_03', 'g_04'],
      version: 1,
    },
  ];

  const mockGuests: GuestSeatingItem[] = [
    {
      id: 'g_01',
      name: 'Bác Trưởng Họ',
      groupName: 'Gia đình Bác Trưởng',
      tableId: 'tbl_01',
      rsvpStatus: 'attending',
      needsSeat: true,
      notes: 'Ghi chú mật khách: Đại diện phát biểu',
      phone: '0909888999',
    },
    {
      id: 'g_02',
      name: 'Bác Gái',
      groupName: 'Gia đình Bác Trưởng',
      tableId: 'tbl_01',
      rsvpStatus: 'attending',
      needsSeat: true,
      notes: 'Ghi chú mật khách: Đi cùng Bác Trưởng',
      phone: '0909888000',
    },
    {
      id: 'g_03',
      name: 'Anh Nam Bạn Chú Rể',
      groupName: 'Nhóm Đại Học',
      tableId: 'tbl_02',
      rsvpStatus: 'attending',
      needsSeat: true,
      notes: 'Ghi chú mật khách: Bạn thân',
      phone: '0912333444',
    },
    {
      id: 'g_04',
      name: 'Chị Lan Bạn Chú Rể',
      groupName: 'Nhóm Đại Học',
      tableId: 'tbl_02',
      rsvpStatus: 'attending',
      needsSeat: true,
    },
    {
      id: 'g_05',
      name: 'Bé Bông',
      groupName: 'Gia đình Bác Trưởng',
      tableId: null, // Split family alert: g_01, g_02 at tbl_01 while g_05 unseated
      rsvpStatus: 'attending',
      needsSeat: false, // Infant non-seat (AT07)
      notes: 'Ghi chú mật: Bé 1 tuổi không cần ghế',
    },
  ];

  describe('Role-Aware Rendering (AT03, AT26)', () => {
    it('renders full management controls and sensitive info for owner role', () => {
      const html = renderToStaticMarkup(
        h(
          RoleProvider,
          { initialRole: 'owner' },
          h(SeatingManager, {
            initialState: 'populated',
            initialTables: mockTables,
            initialGuests: mockGuests,
          })
        )
      );

      // Header & management buttons
      expect(html).toContain('Sơ Đồ Xếp Bàn Tiệc');
      expect(html).toContain('Thêm bàn mới');
      expect(html).toContain('Xuất danh sách A4');

      // TableCard actions
      expect(html).toContain('Sửa bàn');
      expect(html).toContain('Xóa bàn');
      expect(html).toContain('Gỡ Bác Trưởng Họ khỏi bàn');

      // Sensitive fields present for owner
      expect(html).toContain('0909888999');
      expect(html).toContain('Ghi chú mật khách: Đại diện phát biểu');
      expect(html).toContain('Ghi chú mật bàn VIP: Gần sân khấu chính');
    });

    it('strictly redacts mutation buttons, private notes and contact info for family_view role (AT03, AT26)', () => {
      const html = renderToStaticMarkup(
        h(
          RoleProvider,
          { initialRole: 'family_view' },
          h(SeatingManager, {
            initialState: 'populated',
            initialTables: mockTables,
            initialGuests: mockGuests,
          })
        )
      );

      expect(html).toContain('Sơ Đồ Xếp Bàn Tiệc');
      expect(html).toContain('Chế độ Người nhà (family_view)');

      // MUST NOT have Add/Edit/Delete table buttons
      expect(html).not.toContain('Thêm bàn mới');
      expect(html).not.toContain('Sửa bàn');
      expect(html).not.toContain('Xóa bàn');

      // MUST NOT have unassign buttons
      expect(html).not.toContain('Gỡ Bác Trưởng Họ khỏi bàn');
      expect(html).not.toContain('title="Gỡ khách khỏi bàn"');

      // MUST NOT reveal private notes or telephone numbers
      expect(html).not.toContain('0909888999');
      expect(html).not.toContain('0909888000');
      expect(html).not.toContain('0912333444');
      expect(html).not.toContain('Ghi chú mật khách');
      expect(html).not.toContain('Ghi chú mật bàn VIP');
    });
  });

  describe('Table Visualizer & Shapes (Round & Rectangular)', () => {
    it('correctly visualizes round and rectangular table indicators and capacities', () => {
      const html = renderToStaticMarkup(
        h(
          RoleProvider,
          { initialRole: 'owner' },
          h(TableCard, {
            table: mockTables[0], // Round
            guests: mockGuests,
          })
        )
      );

      expect(html).toContain('Bàn tròn');
      expect(html).toContain('Bàn VIP 01 (Nhà Trai)');
      expect(html).toContain('2 / 10 chỗ');
      expect(html).toContain('draggable="true"');
      expect(html).toContain('cursor-grab');
    });

    it('renders rectangular shape badge and Table Full warning when capacity is reached (AT21)', () => {
      const html = renderToStaticMarkup(
        h(
          RoleProvider,
          { initialRole: 'owner' },
          h(TableCard, {
            table: mockTables[1], // Rectangular, capacity 2, 2 guests seated
            guests: mockGuests,
          })
        )
      );

      expect(html).toContain('Bàn chữ nhật');
      expect(html).toContain('2 / 2 chỗ');
      expect(html).toContain('Bàn đã đầy');
    });

    it('properly distinguishes infant non-seat guests (AT07)', () => {
      const infantTable: TableItem = {
        id: 'tbl_infant',
        name: 'Bàn Gia Đình Trẻ',
        shape: 'round',
        capacity: 10,
        seatedGuestIds: ['g_01', 'g_05'], // g_05 has needsSeat: false
      };

      const html = renderToStaticMarkup(
        h(
          RoleProvider,
          { initialRole: 'owner' },
          h(TableCard, {
            table: infantTable,
            guests: mockGuests,
          })
        )
      );

      // g_01 takes seat, g_05 is infant -> occupied seats should be 1, but infant count is 1
      expect(html).toContain('1 / 10 chỗ');
      expect(html).toContain('+1 em bé');
      expect(html).toContain('Không chiếm ghế');
    });
  });

  describe('Conflict Alerts (AT06, AT09, AT21)', () => {
    it('detects and displays split family warnings (AT06/AT09)', () => {
      const html = renderToStaticMarkup(
        h(SeatingConflictAlerts, {
          tables: mockTables,
          guests: mockGuests, // g_01, g_02 seated at tbl_01 while g_05 unseated
        })
      );

      expect(html).toContain('Cảnh báo tách gia đình');
      expect(html).toContain('Gia đình Bác Trưởng');
      expect(html).toContain('Bé Bông chưa được xếp');
    });

    it('detects unseated confirmed guests', () => {
      const html = renderToStaticMarkup(
        h(SeatingConflictAlerts, {
          tables: mockTables,
          guests: mockGuests,
        })
      );

      expect(html).toContain('chưa được phân bổ vào bàn tiệc');
      expect(html).toContain('Bé Bông');
    });

    it('detects and warns on overcapacity tables (AT21)', () => {
      const overcapacityTable: TableItem = {
        id: 'tbl_over',
        name: 'Bàn Quá Ghế',
        shape: 'round',
        capacity: 2,
        seatedGuestIds: ['g_01', 'g_02', 'g_03'], // 3 seated in capacity 2
      };

      const html = renderToStaticMarkup(
        h(SeatingConflictAlerts, {
          tables: [overcapacityTable],
          guests: mockGuests,
        })
      );

      expect(html).toContain('Cảnh báo quá tải sức chứa bàn');
      expect(html).toContain('vượt 1 ghế');
    });
  });

  describe('Sanitized A4 Export Modal (AT26)', () => {
    it('renders sanitized A4 printable seating list omitting private notes for family_view', () => {
      const familyHtml = renderToStaticMarkup(
        h(
          RoleProvider,
          { initialRole: 'family_view' },
          h(SeatingExportModal, {
            isOpen: true,
            onClose: () => {},
            tables: mockTables,
            guests: mockGuests,
          })
        )
      );

      expect(familyHtml).toContain('DANH SÁCH PHÂN BỔ BÀN TIỆC CƯỚI');
      expect(familyHtml).toContain('Bản in Người nhà (AT26)');
      expect(familyHtml).toContain('Bàn VIP 01 (Nhà Trai)');
      expect(familyHtml).toContain('Bác Trưởng Họ');

      // MUST NOT contain private notes or phones
      expect(familyHtml).not.toContain('Ghi chú mật');
      expect(familyHtml).not.toContain('0909888999');
      expect(familyHtml).not.toContain('Gần sân khấu chính');
    });

    it('includes notes in printable preview for owner role', () => {
      const ownerHtml = renderToStaticMarkup(
        h(
          RoleProvider,
          { initialRole: 'owner' },
          h(SeatingExportModal, {
            isOpen: true,
            onClose: () => {},
            tables: mockTables,
            guests: mockGuests,
          })
        )
      );

      expect(ownerHtml).toContain('Bản in Chủ sở hữu');
      expect(ownerHtml).toContain('Gần sân khấu chính');
    });
  });
});
