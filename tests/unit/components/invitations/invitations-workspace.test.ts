import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { GuestOwnerDto, InvitationOwnerDto } from '@/schemas/guests';
import { RoleProvider } from '@/context/RoleContext';
import { EventScopeProvider } from '@/context/EventScopeContext';
import {
  buildOccupiedGuestCardMap,
  computeInvitationStats,
  filterInvitations,
  formatShortViDate,
  suggestCardName,
} from '@/components/modules/invitations/helpers';
import { InvitationEditorModal } from '@/components/modules/invitations/InvitationEditorModal';
import { QuickSentModal } from '@/components/modules/invitations/QuickSentModal';
import { LiveInvitationsWorkspace } from '@/components/modules/invitations/LiveInvitationsWorkspace';

const EVENT_ID = '11111111-1111-4111-8111-111111111111';
const TS = '2026-11-26T00:00:00.000Z';

const MOCK_GUESTS: GuestOwnerDto[] = [
  {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    display_name: 'Anh Tuấn',
    side: 'groom',
    age_tier: 'adult',
    phone: '0901234567',
    email: null,
    address: null,
    private_notes: null,
    is_placeholder: false,
    placeholder_for: null,
    sub_tags: [],
    version: 1,
    is_archived: false,
    created_at: TS,
    updated_at: TS,
  },
  {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    display_name: 'Chị Hoa',
    side: 'groom',
    age_tier: 'adult',
    phone: null,
    email: null,
    address: null,
    private_notes: null,
    is_placeholder: false,
    placeholder_for: null,
    sub_tags: [],
    version: 1,
    is_archived: false,
    created_at: TS,
    updated_at: TS,
  },
  {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
    display_name: 'Minh Thư',
    side: 'bride',
    age_tier: 'adult',
    phone: null,
    email: null,
    address: null,
    private_notes: null,
    is_placeholder: false,
    placeholder_for: null,
    sub_tags: [],
    version: 1,
    is_archived: false,
    created_at: TS,
    updated_at: TS,
  },
];

const MOCK_INVITATIONS: InvitationOwnerDto[] = [
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    event_id: EVENT_ID,
    card_name: 'Gia đình Anh Tuấn',
    representative_guest_id: MOCK_GUESTS[0].id,
    delivery_method: 'paper',
    in_charge_user_id: null,
    status: 'sent',
    sent_date: '2026-11-20',
    notes: 'Gửi tận tay cuối tuần',
    member_guest_ids: [MOCK_GUESTS[0].id, MOCK_GUESTS[1].id],
    version: 1,
    created_at: TS,
    updated_at: TS,
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    event_id: EVENT_ID,
    card_name: 'Bạn Minh Thư',
    representative_guest_id: MOCK_GUESTS[2].id,
    delivery_method: 'electronic',
    in_charge_user_id: null,
    status: 'preparing',
    sent_date: null,
    notes: null,
    member_guest_ids: [MOCK_GUESTS[2].id],
    version: 1,
    created_at: TS,
    updated_at: TS,
  },
];

const guestMap = new Map(MOCK_GUESTS.map((g) => [g.id, g]));

describe('Invitations Workspace Helpers & UI', () => {
  it('computes accurate aggregate card statistics and covered guest count', () => {
    const stats = computeInvitationStats(MOCK_INVITATIONS);
    expect(stats).toEqual({
      totalCards: 2,
      sentCards: 1,
      preparingCards: 1,
      saveTheDateCards: 0,
      totalGuestsCovered: 3,
      sentRatePercent: 50,
    });
  });

  it('filters invitations diacritic-insensitively by card name, guest name, notes, status, and method', () => {
    expect(
      filterInvitations(MOCK_INVITATIONS, guestMap, {
        search: 'chi hoa',
        statusFilter: 'all',
        methodFilter: 'all',
      }).map((i) => i.id)
    ).toEqual([MOCK_INVITATIONS[0].id]);

    expect(
      filterInvitations(MOCK_INVITATIONS, guestMap, {
        search: 'tan tay',
        statusFilter: 'sent',
        methodFilter: 'paper',
      }).map((i) => i.id)
    ).toEqual([MOCK_INVITATIONS[0].id]);

    expect(
      filterInvitations(MOCK_INVITATIONS, guestMap, {
        search: '',
        statusFilter: 'preparing',
        methodFilter: 'electronic',
      }).map((i) => i.id)
    ).toEqual([MOCK_INVITATIONS[1].id]);
  });

  it('builds occupied guest map excluding the current invitation being edited', () => {
    const createMap = buildOccupiedGuestCardMap(MOCK_INVITATIONS);
    expect(createMap.get(MOCK_GUESTS[0].id)).toBe('Gia đình Anh Tuấn');
    expect(createMap.get(MOCK_GUESTS[2].id)).toBe('Bạn Minh Thư');

    const editFirstMap = buildOccupiedGuestCardMap(MOCK_INVITATIONS, MOCK_INVITATIONS[0].id);
    expect(editFirstMap.has(MOCK_GUESTS[0].id)).toBe(false);
    expect(editFirstMap.get(MOCK_GUESTS[2].id)).toBe('Bạn Minh Thư');
  });

  it('formats Vietnamese dates and suggests smart card names', () => {
    expect(formatShortViDate('2026-11-20')).toBe('20/11/2026');
    expect(formatShortViDate(null)).toBe('');
    expect(suggestCardName([MOCK_GUESTS[0].id], MOCK_GUESTS[0].id, guestMap)).toBe('Anh Tuấn');
    expect(
      suggestCardName([MOCK_GUESTS[0].id, MOCK_GUESTS[1].id], MOCK_GUESTS[0].id, guestMap)
    ).toBe('Gia đình Anh Tuấn');
  });

  it('renders InvitationEditorModal cleanly for creating and editing invitations', () => {
    const html = renderToStaticMarkup(
      React.createElement(InvitationEditorModal, {
        isOpen: true,
        onClose: () => {},
        invitation: null,
        guests: MOCK_GUESTS,
        existingInvitations: MOCK_INVITATIONS,
        onSave: async () => {},
      })
    );

    expect(html).toContain('Tạo thiệp mời mới');
    expect(html).toContain('Tên ghi trên thiệp');
    expect(html).toContain('Khách nhận thiệp');
    expect(html).toContain('Thiệp giấy');
    expect(html).toContain('Thiệp điện tử');
    expect(html).toContain('Trao tận tay');
    expect(html).toContain('Đã ở: Gia đình Anh Tuấn');
  });

  it('renders QuickSentModal with RSVP preservation message', () => {
    const html = renderToStaticMarkup(
      React.createElement(QuickSentModal, {
        isOpen: true,
        onClose: () => {},
        targetNames: ['Gia đình Anh Tuấn', 'Bạn Minh Thư'],
        onConfirm: async () => {},
      })
    );

    expect(html).toContain('Xác nhận đã gửi thiệp');
    expect(html).toContain('2 thiệp');
    expect(html).toContain('không tự động thay đổi xác nhận tham dự (RSVP)');
  });

  it('renders LiveInvitationsWorkspace header and filters cleanly', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        RoleProvider,
        null,
        React.createElement(
          EventScopeProvider,
          { initialEvents: [{ id: EVENT_ID, name: 'Tiệc Cưới Chính', isRepresentative: true }] },
          React.createElement(LiveInvitationsWorkspace)
        )
      )
    );

    expect(html).toContain('Danh Sách Thiệp Mời');
    expect(html).toContain('Tiệc Cưới Chính');
    expect(html).toContain('Tạo thiệp mới');
    expect(html).toContain('Tìm theo tên thiệp, tên khách hoặc ghi chú...');
  });
});
