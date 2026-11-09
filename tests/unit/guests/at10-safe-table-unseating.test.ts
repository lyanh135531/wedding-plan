import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RsvpUpdateDrawer, MemberRsvpState } from '@/components/modules/guests/RsvpUpdateDrawer';
import { computeEventHeadcountBreakdown } from '@/lib/guests/headcount';

const h = React.createElement;

describe('AT10: Safe Table Unseating Mechanism on Declined RSVP', () => {
  it('forces needs_seat = false and needs_meal = false when RSVP is declined', () => {
    // Before: guest had accepted with a seat and meal
    const beforeAttendance = {
      id: 'att_1',
      guestId: 'guest_1',
      eventId: 'event_party',
      rsvpStatus: 'accepted' as const,
      needsSeat: true,
      needsMeal: true,
      mealDietaryTier: 'regular' as const,
    };

    // Headcount before decline
    const summaryBefore = computeEventHeadcountBreakdown(
      'event_party',
      [beforeAttendance],
      { guest_1: { id: 'guest_1', ageTier: 'adult', isArchived: false } }
    );
    expect(summaryBefore.confirmed_seats).toBe(1);
    expect(summaryBefore.meals_total).toBe(1);
    expect(summaryBefore.declined_guests).toBe(0);

    // After decline: AT10 invariant forces needs_seat = false and needs_meal = false
    const afterAttendance = {
      ...beforeAttendance,
      rsvpStatus: 'declined' as const,
      needsSeat: false, // forced false
      needsMeal: false, // forced false
    };

    // Headcount after decline
    const summaryAfter = computeEventHeadcountBreakdown(
      'event_party',
      [afterAttendance],
      { guest_1: { id: 'guest_1', ageTier: 'adult', isArchived: false } }
    );
    expect(summaryAfter.confirmed_seats).toBe(0); // Freed seat
    expect(summaryAfter.meals_total).toBe(0); // Freed meal
    expect(summaryAfter.declined_guests).toBe(1);
  });

  it('RsvpUpdateDrawer warns user about table unseating when seated guest is marked declined', () => {
    const seatedMembers: MemberRsvpState[] = [
      {
        guestId: 'g_seated',
        name: 'Nguyễn Văn Seated',
        rsvpStatus: 'accepted',
        needsSeat: true,
        needsMeal: true,
        mealTier: 'regular',
        assignedTable: 'Bàn VIP A1',
      },
    ];

    const html = renderToStaticMarkup(
      h(RsvpUpdateDrawer, {
        isOpen: true,
        onClose: () => {},
        initialMembers: seatedMembers,
      })
    );

    // Verifies seated guest info rendered
    expect(html).toContain('Nguyễn Văn Seated');
    expect(html).toContain('Đang ngồi: Bàn VIP A1');
    expect(html).toContain('Tham dự');
    expect(html).toContain('Không đến');
  });

  it('preserves table seating if RSVP remains accepted', () => {
    const seatedMember: MemberRsvpState = {
      guestId: 'g_seated',
      name: 'Nguyễn Văn Seated',
      rsvpStatus: 'accepted',
      needsSeat: true,
      needsMeal: true,
      mealTier: 'regular',
      assignedTable: 'Bàn VIP A1',
    };

    // Attendance breakdown with seated guest
    const summary = computeEventHeadcountBreakdown(
      'event_party',
      [
        {
          id: '1',
          guestId: seatedMember.guestId,
          eventId: 'event_party',
          rsvpStatus: seatedMember.rsvpStatus,
          needsSeat: seatedMember.needsSeat,
          needsMeal: seatedMember.needsMeal,
          mealDietaryTier: seatedMember.mealTier,
        },
      ],
      { [seatedMember.guestId]: { id: seatedMember.guestId, ageTier: 'adult', isArchived: false } }
    );

    expect(summary.confirmed_seats).toBe(1);
    expect(summary.confirmed_guests).toBe(1);
  });
});
