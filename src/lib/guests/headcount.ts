import { EventHeadcountSummaryDto } from '@/schemas/guests';

export interface AttendanceRecordInput {
  id: string;
  guestId: string;
  eventId: string;
  rsvpStatus: 'not_contacted' | 'pending_reply' | 'tentative' | 'accepted' | 'declined';
  needsSeat: boolean;
  needsMeal: boolean;
  mealDietaryTier: 'regular' | 'vegetarian' | 'child_portion' | 'special';
  dietaryNotes?: string | null;
}

export interface GuestProfileInput {
  id: string;
  ageTier: 'adult' | 'child' | 'baby';
  isArchived: boolean;
}

/**
 * Calculates event-level headcount, confirmed seating, and meal breakdown
 * strictly following PLAN §8.5, AT06, and AT07 rules.
 *
 * Rules:
 * 1. Only active guests (isArchived === false) are counted in totalInvited.
 * 2. All numbers are strictly non-negative integers. Fractions (e.g. 0.5 seat/meal) are forbidden.
 * 3. Confirmed seats: accepted attendance where needsSeat === true.
 * 4. Baby policy: default needsSeat = false, needsMeal = false.
 *    Babies do NOT occupy an adult seat or meal unless explicitly requested.
 * 5. Meal tiers:
 *    - vegetarian: accepted & needsMeal & dietaryTier === 'vegetarian'
 *    - child: accepted & needsMeal & (dietaryTier === 'child_portion' || ageTier === 'child')
 *    - baby: accepted & needsMeal & ageTier === 'baby'
 *    - regular: accepted & needsMeal & remainder
 */
export function computeEventHeadcountBreakdown(
  eventId: string,
  attendances: AttendanceRecordInput[],
  guestsMap: Record<string, GuestProfileInput>
): EventHeadcountSummaryDto {
  let totalInvited = 0;
  let confirmedGuests = 0;
  let uncertainGuests = 0;
  let declinedGuests = 0;
  let confirmedSeats = 0;
  let mealsTotal = 0;
  let mealsRegular = 0;
  let mealsVegetarian = 0;
  let mealsChild = 0;
  let babiesCount = 0;

  for (const att of attendances) {
    const guest = guestsMap[att.guestId];
    if (guest && guest.isArchived) continue;

    totalInvited++;

    if (att.rsvpStatus === 'accepted') {
      confirmedGuests++;
      if (att.needsSeat) {
        confirmedSeats++;
      }
      if (att.needsMeal) {
        mealsTotal++;
        if (att.mealDietaryTier === 'vegetarian') {
          mealsVegetarian++;
        } else if (att.mealDietaryTier === 'child_portion' || (guest && guest.ageTier === 'child')) {
          mealsChild++;
        } else if (guest && guest.ageTier === 'baby') {
          babiesCount++;
        } else {
          mealsRegular++;
        }
      }
    } else if (att.rsvpStatus === 'declined') {
      declinedGuests++;
    } else {
      uncertainGuests++;
    }
  }

  return {
    event_id: eventId,
    total_invited: totalInvited,
    confirmed_guests: confirmedGuests,
    uncertain_guests: uncertainGuests,
    declined_guests: declinedGuests,
    confirmed_seats: confirmedSeats,
    meals_total: mealsTotal,
    meals_regular: mealsRegular,
    meals_vegetarian: mealsVegetarian,
    meals_child: mealsChild,
    babies_count: babiesCount,
  };
}

export interface WeddingWideHeadcountSummary {
  uniqueIndividuals: number;
  totalEventAttendances: number;
  totalConfirmedSeats: number;
  totalConfirmedMeals: number;
  totalDeclinedAttendances: number;
  totalUncertainAttendances: number;
}

/**
 * Calculates wedding-wide headcount distinguishing unique individuals from
 * total event attendances (AT05).
 *
 * Example: 1 guest attending 2 events (Morning Ceremony + Evening Party)
 * counts as:
 * - 1 unique individual
 * - 2 event attendances
 */
export function computeWeddingWideHeadcount(
  activeGuestIds: string[],
  attendances: AttendanceRecordInput[]
): WeddingWideHeadcountSummary {
  const uniqueSet = new Set<string>();
  for (const id of activeGuestIds) {
    uniqueSet.add(id);
  }

  let totalEventAttendances = 0;
  let totalConfirmedSeats = 0;
  let totalConfirmedMeals = 0;
  let totalDeclinedAttendances = 0;
  let totalUncertainAttendances = 0;

  for (const att of attendances) {
    if (!uniqueSet.has(att.guestId)) continue;

    if (att.rsvpStatus === 'accepted') {
      totalEventAttendances++;
      if (att.needsSeat) totalConfirmedSeats++;
      if (att.needsMeal) totalConfirmedMeals++;
    } else if (att.rsvpStatus === 'declined') {
      totalDeclinedAttendances++;
    } else {
      totalUncertainAttendances++;
    }
  }

  return {
    uniqueIndividuals: uniqueSet.size,
    totalEventAttendances,
    totalConfirmedSeats,
    totalConfirmedMeals,
    totalDeclinedAttendances,
    totalUncertainAttendances,
  };
}
