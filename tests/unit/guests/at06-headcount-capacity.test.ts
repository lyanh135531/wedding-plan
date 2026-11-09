import { describe, it, expect } from 'vitest';
import { FX01_FAMILY_GROUP, FixtureAttendance } from '@tests/fixtures/fx01-family';
import {
  computeEventHeadcountBreakdown,
  AttendanceRecordInput,
  GuestProfileInput,
} from '@/lib/guests/headcount';

describe('AT06: Accurate Headcount, Confirmed Seats & Meal Breakdown', () => {
  const guestsMap: Record<string, GuestProfileInput> = {
    [FX01_FAMILY_GROUP.guests.father.id]: {
      id: FX01_FAMILY_GROUP.guests.father.id,
      ageTier: FX01_FAMILY_GROUP.guests.father.ageTier,
      isArchived: false,
    },
    [FX01_FAMILY_GROUP.guests.mother.id]: {
      id: FX01_FAMILY_GROUP.guests.mother.id,
      ageTier: FX01_FAMILY_GROUP.guests.mother.ageTier,
      isArchived: false,
    },
    [FX01_FAMILY_GROUP.guests.child.id]: {
      id: FX01_FAMILY_GROUP.guests.child.id,
      ageTier: FX01_FAMILY_GROUP.guests.child.ageTier,
      isArchived: false,
    },
    [FX01_FAMILY_GROUP.guests.baby.id]: {
      id: FX01_FAMILY_GROUP.guests.baby.id,
      ageTier: FX01_FAMILY_GROUP.guests.baby.ageTier,
      isArchived: false,
    },
  };

  it('matches FX01 canonical expected evening reception aggregations exactly', () => {
    const eveningEventId = FX01_FAMILY_GROUP.events.eveningReception.id;
    const eveningAtt: AttendanceRecordInput[] = (FX01_FAMILY_GROUP.eveningAttendance as FixtureAttendance[]).map((a: FixtureAttendance) => ({
      id: a.id,
      guestId: a.guestId,
      eventId: a.eventId,
      rsvpStatus: a.rsvpStatus,
      needsSeat: a.needsSeat,
      needsMeal: a.needsMeal,
      mealDietaryTier: a.mealDietaryTier,
      dietaryNotes: a.dietaryNotes,
    }));

    const result = computeEventHeadcountBreakdown(eveningEventId, eveningAtt, guestsMap);

    const expected = FX01_FAMILY_GROUP.expectedEveningAggregations;

    expect(result.total_invited).toBe(expected.totalInvited); // 4
    expect(result.confirmed_guests).toBe(expected.confirmedGuests); // 3 (father, mother, child)
    expect(result.declined_guests).toBe(expected.declinedGuests); // 1 (baby)
    expect(result.uncertain_guests).toBe(expected.uncertainGuests); // 0

    // Seats: father (1) + mother (1) + child (1) = 3
    expect(result.confirmed_seats).toBe(expected.confirmedSeats); // 3

    // Meals: father (regular 1) + mother (vegetarian 1) + child (child 1) = 3 total
    expect(result.meals_total).toBe(expected.mealsTotal); // 3
    expect(result.meals_regular).toBe(expected.mealsRegularAdult); // 1
    expect(result.meals_vegetarian).toBe(expected.mealsVegetarian); // 1
    expect(result.meals_child).toBe(expected.mealsChild); // 1
    expect(result.babies_count).toBe(expected.mealsBaby); // 0
  });

  it('verifies baby policy: baby does not occupy seat or meal unless requested', () => {
    const eveningEventId = FX01_FAMILY_GROUP.events.eveningReception.id;
    // Suppose baby is changed to accepted but needsSeat = false, needsMeal = false
    const modifiedAtt: AttendanceRecordInput[] = [
      {
        id: 'att_father',
        guestId: FX01_FAMILY_GROUP.guests.father.id,
        eventId: eveningEventId,
        rsvpStatus: 'accepted',
        needsSeat: true,
        needsMeal: true,
        mealDietaryTier: 'regular',
      },
      {
        id: 'att_baby',
        guestId: FX01_FAMILY_GROUP.guests.baby.id,
        eventId: eveningEventId,
        rsvpStatus: 'accepted',
        needsSeat: false,
        needsMeal: false,
        mealDietaryTier: 'regular',
      },
    ];

    const result = computeEventHeadcountBreakdown(eveningEventId, modifiedAtt, guestsMap);

    // 2 guests accepted, but only 1 confirmed seat and 1 meal
    expect(result.confirmed_guests).toBe(2);
    expect(result.confirmed_seats).toBe(1);
    expect(result.meals_total).toBe(1);
    expect(result.meals_regular).toBe(1);
  });

  it('calculates morning ceremony ceremony-only attendance (no meals, seated guests)', () => {
    const morningEventId = FX01_FAMILY_GROUP.events.morningCeremony.id;
    const morningAtt: AttendanceRecordInput[] = (FX01_FAMILY_GROUP.morningAttendance as FixtureAttendance[]).map((a: FixtureAttendance) => ({
      id: a.id,
      guestId: a.guestId,
      eventId: a.eventId,
      rsvpStatus: a.rsvpStatus,
      needsSeat: a.needsSeat,
      needsMeal: a.needsMeal,
      mealDietaryTier: a.mealDietaryTier,
      dietaryNotes: a.dietaryNotes,
    }));

    const result = computeEventHeadcountBreakdown(morningEventId, morningAtt, guestsMap);

    // 4 invited, all 4 accepted
    expect(result.total_invited).toBe(4);
    expect(result.confirmed_guests).toBe(4);
    expect(result.declined_guests).toBe(0);

    // Seats: father (1) + mother (1) + child (1) = 3 (baby has needsSeat = false)
    expect(result.confirmed_seats).toBe(3);

    // Morning ceremony has no catering: 0 meals total
    expect(result.meals_total).toBe(0);
    expect(result.meals_regular).toBe(0);
    expect(result.meals_vegetarian).toBe(0);
  });

  it('strictly excludes archived (soft-deleted) guests from attendance aggregations', () => {
    const eveningEventId = FX01_FAMILY_GROUP.events.eveningReception.id;
    const archivedGuestsMap: Record<string, GuestProfileInput> = {
      ...guestsMap,
      [FX01_FAMILY_GROUP.guests.father.id]: {
        id: FX01_FAMILY_GROUP.guests.father.id,
        ageTier: 'adult',
        isArchived: true, // Father was soft deleted or merged
      },
    };

    const eveningAtt: AttendanceRecordInput[] = (FX01_FAMILY_GROUP.eveningAttendance as FixtureAttendance[]).map((a: FixtureAttendance) => ({
      id: a.id,
      guestId: a.guestId,
      eventId: a.eventId,
      rsvpStatus: a.rsvpStatus,
      needsSeat: a.needsSeat,
      needsMeal: a.needsMeal,
      mealDietaryTier: a.mealDietaryTier,
    }));

    const result = computeEventHeadcountBreakdown(eveningEventId, eveningAtt, archivedGuestsMap);

    // With father archived: total_invited drops from 4 to 3
    expect(result.total_invited).toBe(3);
    // Confirmed guests drops from 3 to 2 (mother + child)
    expect(result.confirmed_guests).toBe(2);
    // Seats drops from 3 to 2
    expect(result.confirmed_seats).toBe(2);
    // Regular meal drops from 1 to 0 (father was the regular meal)
    expect(result.meals_regular).toBe(0);
    expect(result.meals_total).toBe(2); // mother (veg) + child (child)
  });

  it('guarantees integer arithmetic: fractions (0.5 seat/meal) are impossible', () => {
    const eveningEventId = FX01_FAMILY_GROUP.events.eveningReception.id;
    const att: AttendanceRecordInput[] = [
      {
        id: '1',
        guestId: FX01_FAMILY_GROUP.guests.child.id,
        eventId: eveningEventId,
        rsvpStatus: 'accepted',
        needsSeat: true,
        needsMeal: true,
        mealDietaryTier: 'child_portion',
      },
    ];

    const result = computeEventHeadcountBreakdown(eveningEventId, att, guestsMap);
    expect(Number.isInteger(result.confirmed_seats)).toBe(true);
    expect(Number.isInteger(result.meals_total)).toBe(true);
    expect(result.confirmed_seats).toBe(1);
    expect(result.meals_total).toBe(1);
  });
});
