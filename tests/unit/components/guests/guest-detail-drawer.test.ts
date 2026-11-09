import { describe, it, expect, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RoleProvider } from '@/context/RoleContext';
import { GuestDetailDrawer, GuestDetailData } from '@/components/modules/guests/GuestDetailDrawer';

const h = React.createElement;

const mockDetailGuest: GuestDetailData = {
  id: '00000000-0000-4000-8000-000000000001',
  displayName: 'Nguyễn Văn Ba (Bác Ba)',
  side: 'groom',
  groupName: 'Họ hàng Nhà trai',
  ageTier: 'adult',
  phone: '0901234567',
  email: 'bacba@example.com',
  address: '12 Võ Văn Tần, Q3, TP.HCM',
  privateNotes: 'Uống trà nóng, kiêng bia rượu lạnh',
  subTags: ['Họ nội', 'Bác ruột'],
  isPlaceholder: false,
  attendances: [
    {
      eventId: 'e0000000-0000-4000-8000-000000000002',
      eventName: 'Tiệc Cưới Chính Buổi Tối',
      eventDate: 'Chủ Nhật, 15/03/2028 - 18:00',
      rsvpStatus: 'accepted',
      needsSeat: true,
      needsMeal: true,
      mealDietaryTier: 'regular',
      tableName: 'Bàn VIP A1',
      invitationCardName: 'Gia đình Bác Ba & Các Cháu',
      invitationStatus: 'sent',
    },
  ],
};

describe('GuestDetailDrawer (Screen S06)', () => {
  it('renders guest profile with full tabs and private notes in Owner mode', () => {
    const html = renderToStaticMarkup(
      h(
        RoleProvider,
        { initialRole: 'owner' },
        h(GuestDetailDrawer, {
          isOpen: true,
          onClose: () => {},
          guest: mockDetailGuest,
          onEdit: () => {},
          onUpdateRsvp: () => {},
          onTriggerMerge: () => {},
        })
      )
    );

    // Profile header
    expect(html).toContain('Nguyễn Văn Ba (Bác Ba)');
    expect(html).toContain('Nhà trai');
    expect(html).toContain('Người lớn');
    expect(html).toContain('Thuộc nhóm: Họ hàng Nhà trai');

    // Tabs
    expect(html).toContain('Thông tin');
    expect(html).toContain('Theo từng buổi');
    expect(html).toContain('Liên hệ');

    // Private notes for Owner
    expect(html).toContain('Ghi chú riêng tư (Chỉ chủ sở hữu thấy)');
    expect(html).toContain('Uống trà nóng, kiêng bia rượu lạnh');

    // Actions for Owner
    expect(html).toContain('Cập nhật RSVP');
    expect(html).toContain('Gộp trùng');
    expect(html).toContain('Chỉnh sửa');
  });

  it('strictly masks private contact info, private notes and hides Contact tab in Family mode', () => {
    const html = renderToStaticMarkup(
      h(
        RoleProvider,
        { initialRole: 'family_view' },
        h(GuestDetailDrawer, {
          isOpen: true,
          onClose: () => {},
          guest: mockDetailGuest,
        })
      )
    );

    // Contact tab must NOT be rendered for family
    expect(html).not.toContain('>Liên hệ<');

    // Private phone, email, address must NOT be leaked
    expect(html).not.toContain('0901234567');
    expect(html).not.toContain('bacba@example.com');
    expect(html).not.toContain('12 Võ Văn Tần');

    // Private notes must be protected
    expect(html).not.toContain('Uống trà nóng, kiêng bia rượu lạnh');
    expect(html).toContain('Ghi chú riêng tư và liên hệ được bảo mật theo chính sách Người nhà');

    // Edit/Merge buttons must NOT exist, read-only banner shown
    expect(html).not.toContain('Chỉnh sửa');
    expect(html).not.toContain('Gộp trùng');
    expect(html).toContain('Chế độ Người nhà: Hồ sơ khách ở trạng thái chỉ đọc');
  });

  it('renders placeholder guest badge if guest is placeholder companion (+1)', () => {
    const placeholderGuest: GuestDetailData = {
      ...mockDetailGuest,
      displayName: 'Bạn gái của Tuấn',
      isPlaceholder: true,
      placeholderFor: 'Tuấn',
    };

    const html = renderToStaticMarkup(
      h(
        RoleProvider,
        { initialRole: 'owner' },
        h(GuestDetailDrawer, {
          isOpen: true,
          onClose: () => {},
          guest: placeholderGuest,
        })
      )
    );

    expect(html).toContain('Người đi cùng (+1)');
    expect(html).toContain('Đi cùng với');
    expect(html).toContain('Tuấn');
  });

  it('renders per-event attendance breakdown with seating and meal tiers', () => {
    const html = renderToStaticMarkup(
      h(
        RoleProvider,
        { initialRole: 'owner' },
        h(GuestDetailDrawer, {
          isOpen: true,
          onClose: () => {},
          guest: mockDetailGuest,
          initialTab: 'events',
        })
      )
    );

    expect(html).toContain('Tiệc Cưới Chính Buổi Tối');
    expect(html).toContain('Bàn VIP A1');
    expect(html).toContain('Suất tiêu chuẩn');
  });
});
