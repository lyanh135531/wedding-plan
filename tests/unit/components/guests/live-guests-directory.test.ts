import { describe, it, expect, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RoleProvider } from '@/context/RoleContext';
import {
  CompactGuestList,
  computeGuestStats,
  filterLiveGuests,
} from '@/components/modules/guests/LiveGuestsDirectory';
import type {
  AttendanceOwnerDto,
  GuestFamilyDto,
  GuestOwnerDto,
  InvitationOwnerDto,
} from '@/schemas/guests';

const h = React.createElement;
const EVENT_ID = '00000000-0000-4000-8000-000000000011';
const NOW = '2026-11-25T00:00:00.000Z';

const ownerGuests: GuestOwnerDto[] = [
  {
    id: '00000000-0000-4000-8000-000000000101',
    display_name: 'Anh Mẫn',
    side: 'groom',
    group_id: null,
    sub_tags: [],
    age_tier: 'adult',
    phone: '0901234567',
    email: null,
    address: null,
    private_notes: 'Bạn thân chú rể',
    is_archived: false,
    archived_at: null,
    is_placeholder: false,
    placeholder_for: null,
    version: 1,
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: '00000000-0000-4000-8000-000000000102',
    display_name: 'Chị Ý',
    side: 'bride',
    group_id: null,
    sub_tags: [],
    age_tier: 'adult',
    phone: '0987654321',
    email: null,
    address: null,
    private_notes: null,
    is_archived: false,
    archived_at: null,
    is_placeholder: false,
    placeholder_for: null,
    version: 1,
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: '00000000-0000-4000-8000-000000000103',
    display_name: 'Bé Bông',
    side: 'mutual',
    group_id: null,
    sub_tags: [],
    age_tier: 'baby',
    phone: null,
    email: null,
    address: null,
    private_notes: null,
    is_archived: false,
    archived_at: null,
    is_placeholder: false,
    placeholder_for: null,
    version: 1,
    created_at: NOW,
    updated_at: NOW,
  },
];

const attendanceRows: AttendanceOwnerDto[] = [
  {
    id: '00000000-0000-4000-8000-000000000201',
    guest_id: ownerGuests[0].id,
    event_id: EVENT_ID,
    rsvp_status: 'accepted',
    contact_count: 1,
    contact_notes: null,
    next_followup_date: null,
    needs_seat: true,
    needs_meal: true,
    meal_dietary_tier: 'regular',
    dietary_notes: null,
    accommodation_needed: false,
    transport_needed: false,
    is_origin_onsite: false,
    version: 1,
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: '00000000-0000-4000-8000-000000000203',
    guest_id: ownerGuests[2].id,
    event_id: EVENT_ID,
    rsvp_status: 'pending_reply',
    contact_count: 1,
    contact_notes: null,
    next_followup_date: null,
    needs_seat: false,
    needs_meal: false,
    meal_dietary_tier: 'regular',
    dietary_notes: null,
    accommodation_needed: false,
    transport_needed: false,
    is_origin_onsite: false,
    version: 1,
    created_at: NOW,
    updated_at: NOW,
  },
];

const invitationCards: InvitationOwnerDto[] = [
  {
    id: '00000000-0000-4000-8000-000000000301',
    event_id: EVENT_ID,
    card_name: 'Nguyễn Phùng Minh Mẫn',
    representative_guest_id: ownerGuests[0].id,
    delivery_method: 'paper',
    in_charge_user_id: null,
    status: 'sent',
    sent_date: '2026-11-20',
    notes: null,
    member_guest_ids: [ownerGuests[0].id],
    version: 1,
    created_at: NOW,
    updated_at: NOW,
  },
];

describe('LiveGuestsDirectory compact layout helpers and view', () => {
  it('computes accurate event summary stats including uninvited guests', () => {
    const stats = computeGuestStats(ownerGuests, attendanceRows);
    expect(stats).toEqual({
      total: 3,
      accepted: 1,
      pending: 1,
      declined: 0,
      uninvited: 1,
    });
  });

  it('filters guests by diacritic-insensitive name, phone, card name, side, and RSVP state', () => {
    expect(
      filterLiveGuests(ownerGuests, attendanceRows, invitationCards, {
        search: 'man',
        side: 'all',
        rsvp: 'all',
      }).map((g) => g.id)
    ).toEqual([ownerGuests[0].id]);

    expect(
      filterLiveGuests(ownerGuests, attendanceRows, invitationCards, {
        search: '098765',
        side: 'all',
        rsvp: 'all',
      }).map((g) => g.id)
    ).toEqual([ownerGuests[1].id]);

    expect(
      filterLiveGuests(ownerGuests, attendanceRows, invitationCards, {
        search: 'Nguyen Phung',
        side: 'all',
        rsvp: 'all',
      }).map((g) => g.id)
    ).toEqual([ownerGuests[0].id]);

    expect(
      filterLiveGuests(ownerGuests, attendanceRows, invitationCards, {
        search: '',
        side: 'bride',
        rsvp: 'uninvited',
      }).map((g) => g.id)
    ).toEqual([ownerGuests[1].id]);
  });

  it('renders compact guest rows with preserved testids, status badges, and owner controls', () => {
    const html = renderToStaticMarkup(
      h(
        RoleProvider,
        { initialRole: 'owner' },
        h(CompactGuestList, {
          guests: ownerGuests,
          attendance: attendanceRows,
          invitations: invitationCards,
          seatedNames: { [ownerGuests[0].id]: 'Bàn VIP 01' },
          isOwner: true,
          eventId: EVENT_ID,
          busy: false,
          onOpenDetail: vi.fn(),
          onInvite: vi.fn(),
          onOpenRsvp: vi.fn(),
          reload: vi.fn(async () => {}),
        })
      )
    );

    expect(html).toContain(`data-testid="guest-${ownerGuests[0].id}"`);
    expect(html).toContain(`data-testid="guest-${ownerGuests[1].id}"`);
    expect(html).toContain('Sẽ tham dự');
    expect(html).toContain('Chưa phản hồi');
    expect(html).toContain('Chưa mời');
    expect(html).toContain('Bàn VIP 01');
    expect(html).toContain('Thiệp: Nguyễn Phùng Minh Mẫn');
    expect(html).toContain('Cập nhật RSVP');
    expect(html).toContain('Mời dự buổi');
    expect(html).toContain('aria-label="Sửa hồ sơ"');
    expect(html).toContain('aria-label="Xóa khách mời"');
  });

  it('hides owner mutation controls and omits private contact info in family_view mode', () => {
    const familyGuests: GuestFamilyDto[] = ownerGuests.map(
      ({ phone: _p, email: _e, address: _a, private_notes: _n, is_archived: _ia, archived_at: _aa, ...rest }) =>
        rest
    );

    const html = renderToStaticMarkup(
      h(
        RoleProvider,
        { initialRole: 'family_view' },
        h(CompactGuestList, {
          guests: familyGuests,
          attendance: attendanceRows,
          invitations: invitationCards,
          seatedNames: {},
          isOwner: false,
          eventId: EVENT_ID,
          busy: false,
          onOpenDetail: vi.fn(),
          onInvite: vi.fn(),
          onOpenRsvp: vi.fn(),
          reload: vi.fn(async () => {}),
        })
      )
    );

    expect(html).toContain('Anh Mẫn');
    expect(html).toContain('Chi tiết');
    expect(html).not.toContain('0901234567');
    expect(html).not.toContain('Cập nhật RSVP');
    expect(html).not.toContain('Mời dự buổi');
    expect(html).not.toContain('Sửa hồ sơ');
    expect(html).not.toContain('Xóa khách mời');
  });
});
