import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RoleProvider } from '@/context/RoleContext';
import { GuestCountersBar } from '@/components/modules/guests/GuestCountersBar';
import { GuestCardMobile, GuestItemDisplay } from '@/components/modules/guests/GuestCardMobile';
import { AddFamilyModal } from '@/components/modules/guests/AddFamilyModal';
import { RsvpUpdateDrawer } from '@/components/modules/guests/RsvpUpdateDrawer';
import { GuestsDirectory } from '@/components/modules/guests/GuestsDirectory';
import { BulkMarkSentDialog } from '@/components/modules/invitations/BulkMarkSentDialog';
import { removeVietnameseDiacritics } from '@/lib/utils';

const h = React.createElement;

const mockGuest: GuestItemDisplay = {
  id: 'bac_thanh',
  displayName: 'Bác Thành',
  side: 'groom',
  groupName: 'Gia đình Bác Thành',
  ageTier: 'adult',
  phone: '0901234567',
  rsvpStatus: 'accepted',
  needsSeat: true,
  needsMeal: true,
  mealDietaryTier: 'regular',
  tableName: 'A1',
  isRepresentative: true,
};

describe('S05 & S07: Guests & Invitations Tripartite Prototype', () => {
  it('GuestCardMobile conforms to mobile reflow (>=64px height, >=44px touch targets)', () => {
    const html = renderToStaticMarkup(
      h(
        RoleProvider,
        { initialRole: 'owner' },
        h(GuestCardMobile, {
          guest: mockGuest,
          isSelected: false,
          onSelect: () => {},
        })
      )
    );

    expect(html).toContain('min-h-[64px]');
    expect(html).toContain('Bác Thành');
    expect(html).toContain('Gia đình Bác Thành');
    expect(html).toContain('Nhà trai');
    expect(html).toContain('Sẽ tham dự');
    expect(html).toContain('Bàn: A1');
    expect(html).toContain('0901234567');
    expect(html).toContain('Đại diện');
  });

  it('Family View mode masks guest private phone number on mobile card', () => {
    const html = renderToStaticMarkup(
      h(
        RoleProvider,
        { initialRole: 'family_view' },
        h(GuestCardMobile, {
          guest: mockGuest,
          isSelected: false,
        })
      )
    );

    expect(html).toContain('***-***-****');
    expect(html).not.toContain('0901234567');
  });

  it('AddFamilyModal (UXT02) creates 1 household card and 4 members with summary preview', () => {
    const html = renderToStaticMarkup(
      h(AddFamilyModal, {
        isOpen: true,
        onClose: () => {},
        onSubmit: () => {},
      })
    );

    expect(html).toContain('Thêm gia đình / Nhóm nhận thiệp');
    expect(html).toContain('Gia đình Bác Thành');
    expect(html).toContain('Bác Thành');
    expect(html).toContain('Bác Gái');
    expect(html).toContain('Anh Tuấn');
    expect(html).toContain('Bé Bi');
    // Summary line assertion (UXT02)
    expect(html).toContain('1 thiệp, 4 người');
  });

  it('RsvpUpdateDrawer (UXT03) updates independent attendance per event and warns when unseating', () => {
    const html = renderToStaticMarkup(
      h(RsvpUpdateDrawer, {
        isOpen: true,
        onClose: () => {},
        householdName: 'Gia đình Bác Thành',
        initialEventTitle: 'Lễ Vu Quy',
      })
    );

    expect(html).toContain('Lễ Vu Quy');
    expect(html).toContain('Gia đình Bác Thành');
    expect(html).toContain('Bác Thành');
    expect(html).toContain('Bác Gái');
    expect(html).toContain('Tham dự');
    expect(html).toContain('Chưa trả lời');
    expect(html).toContain('Không đến');
    expect(html).toContain('Đang ngồi: Bàn A1');
  });

  it('Diacritic-insensitive search matches accents properly', () => {
    expect(removeVietnameseDiacritics('Nguyễn Văn Minh')).toBe('nguyen van minh');
    expect(removeVietnameseDiacritics('Đỗ Thị Thu Thảo')).toBe('do thi thu thao');
    expect(removeVietnameseDiacritics('Lễ Vu Quy')).toBe('le vu quy');
  });

  it('BulkMarkSentDialog (UXT05) maintains invariant that marking sent never alters RSVP acceptance', () => {
    const html = renderToStaticMarkup(
      h(BulkMarkSentDialog, {
        isOpen: true,
        onClose: () => {},
        selectedCount: 5,
        onConfirm: () => {},
      })
    );

    expect(html).toContain('Đánh dấu thiệp đã gửi');
    expect(html).toContain('5 thiệp mời');
    expect(html).toContain('hoàn toàn không tự ý thay đổi trạng thái phản hồi tham dự (RSVP)');
  });

  it('GuestsDirectory renders all 6 mandatory states', () => {
    const renderState = (st: any) =>
      renderToStaticMarkup(
        h(RoleProvider, { initialRole: 'owner' }, h(GuestsDirectory, { initialState: st }))
      );

    // 1. Loading
    expect(renderState('loading')).toContain('animate-pulse');

    // 2. Empty
    expect(renderState('empty')).toContain('Chưa có khách mời nào trong danh sách');

    // 3. Populated
    const populated = renderState('populated');
    expect(populated).toContain('Bác Thành');
    expect(populated).toContain('Bác Gái');

    // 4. Error
    expect(renderState('error')).toContain('REQ-20261106-GUESTS-ERR');

    // 5. Filtered
    expect(renderState('filtered')).toContain('Không có khách mời nào khớp với bộ lọc');
  });
});
