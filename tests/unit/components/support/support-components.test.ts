import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RoleProvider } from '@/context/RoleContext';
import {
  SupportPartyScreen,
  SupportMemberCard,
  AddEditSupportMemberModal,
  SupportMember,
} from '@/components/modules/support';

const h = React.createElement;

describe('S24: Wedding Party Directory Components Unit Tests', () => {
  const mockMembers: SupportMember[] = [
    {
      id: 'supp_01',
      name: 'Nguyễn Thu Trang',
      phone: '0901234567',
      roles: ['co_dau'],
      arrivalTime: '06:00 sáng',
      backupName: 'Chị Mai',
      backupPhone: '0912345678',
      attireNotes: 'Áo dài trắng thêu hoa sen',
      duties: 'Làm lễ gia tiên và tiếp khách',
      isShared: true,
      version: 1,
    },
    {
      id: 'supp_02',
      name: 'Trần Minh Hoàng',
      phone: '0908765432',
      roles: ['chu_re'],
      arrivalTime: '06:30 sáng',
      isShared: true,
      version: 1,
    },
    {
      id: 'supp_03',
      name: 'Lê Tuyết Mai',
      phone: '0912345678',
      roles: ['phu_dau', 'dieu_phoi'],
      arrivalTime: '06:30 sáng',
      attireNotes: 'Váy phù dâu màu xanh pastel',
      duties: 'Hỗ trợ cô dâu trang phục',
      isShared: true,
      version: 1,
    },
    {
      id: 'supp_04',
      name: 'Bác Nghĩa (Thủ quỹ riêng tư)',
      phone: '0911223344',
      roles: ['nguoi_than', 'khac'],
      arrivalTime: '08:00 sáng',
      duties: 'Giữ hòm quà riêng tư',
      isShared: false, // Private / unshared member
      version: 1,
    },
  ];

  describe('Role-Aware Rendering & Privacy Invariants (UI/UX SPEC §7.9 & PLAN §14.2)', () => {
    it('renders all members and management controls for owner role', () => {
      const html = renderToStaticMarkup(
        h(
          RoleProvider,
          { initialRole: 'owner' },
          h(SupportPartyScreen, {
            initialState: 'populated',
            initialMembers: mockMembers,
          })
        )
      );

      // Owner sees management buttons
      expect(html).toContain('Thêm thành viên hỗ trợ');

      // Owner sees both shared and unshared contacts
      expect(html).toContain('Nguyễn Thu Trang');
      expect(html).toContain('Trần Minh Hoàng');
      expect(html).toContain('Lê Tuyết Mai');
      expect(html).toContain('Bác Nghĩa (Thủ quỹ riêng tư)');
    });

    it('strictly hides unshared members and mutation controls for family_view role', () => {
      const html = renderToStaticMarkup(
        h(
          RoleProvider,
          { initialRole: 'family_view' },
          h(SupportPartyScreen, {
            initialState: 'populated',
            initialMembers: mockMembers,
          })
        )
      );

      // Family view sees shared contacts
      expect(html).toContain('Nguyễn Thu Trang');
      expect(html).toContain('Trần Minh Hoàng');
      expect(html).toContain('Lê Tuyết Mai');

      // Family view MUST NOT see unshared internal contact (privacy invariant)
      expect(html).not.toContain('Bác Nghĩa (Thủ quỹ riêng tư)');

      // Family view MUST NOT see mutation buttons
      expect(html).not.toContain('Thêm thành viên hỗ trợ');
      expect(html).toContain('Chỉ xem');
    });
  });

  describe('1-Tap Calling, SMS & Invariant Guardrails', () => {
    it('renders 1-tap call and sms links with correct tel: and sms: schemes', () => {
      const html = renderToStaticMarkup(
        h(
          RoleProvider,
          { initialRole: 'owner' },
          h(SupportMemberCard, {
            member: mockMembers[0],
            onEdit: () => {},
            onDelete: () => {},
          })
        )
      );

      expect(html).toContain('href="tel:0901234567"');
      expect(html).toContain('href="sms:0901234567"');
      expect(html).toContain('href="tel:0912345678"'); // Backup phone link
    });

    it('renders explicit invariant notice that no user accounts are created', () => {
      const html = renderToStaticMarkup(
        h(
          RoleProvider,
          { initialRole: 'owner' },
          h(SupportMemberCard, {
            member: mockMembers[0],
          })
        )
      );

      expect(html).toContain('Không cấp tài khoản');
    });

    it('renders multiple semantic roles correctly on a single card', () => {
      const html = renderToStaticMarkup(
        h(
          RoleProvider,
          { initialRole: 'owner' },
          h(SupportMemberCard, {
            member: mockMembers[2], // has both 'phu_dau' and 'dieu_phoi'
          })
        )
      );

      expect(html).toContain('Phù dâu');
      expect(html).toContain('Điều phối sảnh');
      expect(html).toContain('Váy phù dâu màu xanh pastel');
      expect(html).toContain('Hỗ trợ cô dâu trang phục');
    });
  });

  describe('AddEditSupportMemberModal', () => {
    it('renders modal with all 9 semantic roles and warning banner when open', () => {
      const html = renderToStaticMarkup(
        h(AddEditSupportMemberModal, {
          isOpen: true,
          onClose: () => {},
          onSubmit: () => {},
          initialData: mockMembers[0],
        })
      );

      expect(html).toContain('Chỉnh sửa thông tin thành viên');
      expect(html).toContain('Quy định bất biến');
      expect(html).toContain('tuyệt đối không gửi lời mời hay cấp tài khoản đăng nhập');
      expect(html).toContain('Cô dâu');
      expect(html).toContain('Chú rể');
      expect(html).toContain('MC dẫn chương trình');
      expect(html).toContain('Điều phối sảnh');
    });

    it('returns null when modal is closed', () => {
      const html = renderToStaticMarkup(
        h(AddEditSupportMemberModal, {
          isOpen: false,
          onClose: () => {},
          onSubmit: () => {},
        })
      );

      expect(html).toBe('');
    });
  });

  describe('Prototype States', () => {
    it('renders empty state when no members present', () => {
      const html = renderToStaticMarkup(
        h(
          RoleProvider,
          { initialRole: 'owner' },
          h(SupportPartyScreen, {
            initialState: 'empty',
            initialMembers: [],
          })
        )
      );

      expect(html).toContain('Chưa có thành viên nào trong đội ngũ hỗ trợ.');
    });
  });
});
