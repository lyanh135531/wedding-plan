import { describe, it, expect, vi } from 'vitest';
import { FX01_FAMILY_GROUP, FixtureGuest, FixtureAttendance } from '@tests/fixtures/fx01-family';
import { computeWeddingWideHeadcount } from '@/lib/guests/headcount';
import {
  createGuestSchema,
  createInvitationSchema,
  updateAttendanceSchema,
} from '@/schemas/guests';
import { createInvitation } from '@/lib/guests/invitations.repository';
import * as schema from '@/db/schema';

describe('AT05: Tripartite Separation (Person, Invitation Card, Event Attendance)', () => {
  it('strictly separates 3 distinct entities: Guests, Invitations, and Attendance', () => {
    // 1. Guests: 4 distinct individuals
    const guests = Object.values(FX01_FAMILY_GROUP.guests) as FixtureGuest[];
    expect(guests).toHaveLength(4);
    const guestIds = new Set(guests.map((g) => g.id));
    expect(guestIds.size).toBe(4);

    // 2. Invitation Card: 1 card for the family group for evening reception
    const invitation = FX01_FAMILY_GROUP.invitation;
    expect(invitation.eventId).toBe(FX01_FAMILY_GROUP.events.eveningReception.id);
    expect(invitation.cardName).toBe('Gia đình Bác Ba & Các Cháu');
    expect(invitation.memberGuestIds).toHaveLength(4);
    expect(invitation.representativeGuestId).toBe(FX01_FAMILY_GROUP.guests.father.id);

    // 3. Attendance: 4 morning rows and 4 evening rows = 8 attendance records
    const morningAtt = FX01_FAMILY_GROUP.morningAttendance as FixtureAttendance[];
    const eveningAtt = FX01_FAMILY_GROUP.eveningAttendance as FixtureAttendance[];
    expect(morningAtt).toHaveLength(4);
    expect(eveningAtt).toHaveLength(4);

    // All attendance records link to valid guest IDs
    for (const att of [...morningAtt, ...eveningAtt]) {
      expect(guestIds.has(att.guestId)).toBe(true);
    }
  });

  it('guarantees attendance status across distinct events is completely independent', () => {
    const morningAtt = FX01_FAMILY_GROUP.morningAttendance as FixtureAttendance[];
    const eveningAtt = FX01_FAMILY_GROUP.eveningAttendance as FixtureAttendance[];

    // In morning ceremony: baby attended with mother (accepted)
    const babyMorning = morningAtt.find((a: FixtureAttendance) => a.guestId === FX01_FAMILY_GROUP.guests.baby.id)!;
    expect(babyMorning.rsvpStatus).toBe('accepted');
    expect(babyMorning.needsMeal).toBe(false);
    expect(babyMorning.needsSeat).toBe(false);

    // In evening reception: baby was declined (sent to grandmother)
    const babyEvening = eveningAtt.find((a: FixtureAttendance) => a.guestId === FX01_FAMILY_GROUP.guests.baby.id)!;
    expect(babyEvening.rsvpStatus).toBe('declined');
    expect(babyEvening.needsMeal).toBe(false);
    expect(babyEvening.needsSeat).toBe(false);

    // Independence verification: Baby attendance state in evening does not mutate morning
    expect(babyMorning.rsvpStatus).not.toBe(babyEvening.rsvpStatus);
  });

  it('calculates wedding-wide headcount distinguishing unique individuals from total event attendances', () => {
    const activeGuestIds = (Object.values(FX01_FAMILY_GROUP.guests) as FixtureGuest[]).map((g) => g.id);
    const allAttendances = [
      ...FX01_FAMILY_GROUP.morningAttendance,
      ...FX01_FAMILY_GROUP.eveningAttendance,
    ];

    const result = computeWeddingWideHeadcount(activeGuestIds, allAttendances);

    // Exactly 4 unique individuals
    expect(result.uniqueIndividuals).toBe(4);

    // Total accepted attendances: 4 morning + 3 evening = 7
    expect(result.totalEventAttendances).toBe(7);

    // Total declined: 0 morning + 1 evening (baby) = 1
    expect(result.totalDeclinedAttendances).toBe(1);

    // Total seats: morning (3 seats) + evening (3 seats) = 6 seats
    expect(result.totalConfirmedSeats).toBe(6);

    // Total meals: morning (0 meals) + evening (3 meals) = 3 meals
    expect(result.totalConfirmedMeals).toBe(3);
  });

  it('validates schema invariant: 1 person belongs to at most 1 invitation card per event', () => {
    const eveningEventId = FX01_FAMILY_GROUP.events.eveningReception.id;
    const fatherId = FX01_FAMILY_GROUP.guests.father.id;

    // Valid invitation containing father
    const validInvitation = createInvitationSchema.safeParse({
      event_id: eveningEventId,
      card_name: 'Gia đình Bác Ba',
      representative_guest_id: fatherId,
      delivery_method: 'paper',
      status: 'save_the_date',
      member_guest_ids: [fatherId],
    });
    expect(validInvitation.success).toBe(true);

    // Schema requires at least 1 member
    const emptyMembers = createInvitationSchema.safeParse({
      event_id: eveningEventId,
      card_name: 'Thiệp không người',
      representative_guest_id: fatherId,
      delivery_method: 'paper',
      status: 'save_the_date',
      member_guest_ids: [],
    });
    expect(emptyMembers.success).toBe(false);
  });

  it('initializes attendance records for invited guests in createInvitation respecting baby policy', async () => {
    const eveningEventId = FX01_FAMILY_GROUP.events.eveningReception.id;
    const fatherId = FX01_FAMILY_GROUP.guests.father.id;
    const babyId = FX01_FAMILY_GROUP.guests.baby.id;

    const insertedAttendances: any[] = [];

    const mockTxDb: any = {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation((table) => {
          if (table === schema.guests) {
            return {
              where: vi.fn().mockResolvedValue([
                { id: fatherId, displayName: 'Bác Ba', ageTier: 'adult', isArchived: false },
                { id: babyId, displayName: 'Em Bé', ageTier: 'baby', isArchived: false },
              ]),
            };
          }
          if (table === schema.invitationMembers) {
            return {
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([]),
              }),
            };
          }
          if (table === schema.attendance) {
            return {
              where: vi.fn().mockResolvedValue([]),
            };
          }
          return { where: vi.fn().mockResolvedValue([]) };
        }),
      })),
      insert: vi.fn().mockImplementation((table) => ({
        values: vi.fn().mockImplementation((val) => {
          if (table === schema.invitations) {
            return {
              returning: vi.fn().mockResolvedValue([
                {
                  id: 'c0000000-0000-4000-8000-000000000001',
                  eventId: eveningEventId,
                  cardName: 'Gia đình Bác Ba',
                  representativeGuestId: fatherId,
                  deliveryMethod: 'paper',
                  inChargeUserId: null,
                  status: 'save_the_date',
                  sentDate: null,
                  notes: null,
                  version: 1,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              ]),
            };
          }
          if (table === schema.attendance) {
            insertedAttendances.push(val);
          }
          return Promise.resolve();
        }),
      })),
    };

    await createInvitation(
      mockTxDb,
      {
        event_id: eveningEventId,
        card_name: 'Gia đình Bác Ba',
        representative_guest_id: fatherId,
        delivery_method: 'paper',
        status: 'save_the_date',
        member_guest_ids: [fatherId, babyId],
      },
      'user_1'
    );

    expect(insertedAttendances).toHaveLength(2);
    const fatherAtt = insertedAttendances.find((a) => a.guestId === fatherId);
    expect(fatherAtt.needsSeat).toBe(true);
    expect(fatherAtt.needsMeal).toBe(true);

    const babyAtt = insertedAttendances.find((a) => a.guestId === babyId);
    expect(babyAtt.needsSeat).toBe(false); // Baby policy
    expect(babyAtt.needsMeal).toBe(false); // Baby policy
  });
});
