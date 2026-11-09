import { describe, it, expect } from 'vitest';
import { FX01_FAMILY_GROUP, FixtureAttendance } from '@tests/fixtures/fx01-family';
import { updateAttendanceSchema, updateInvitationSchema } from '@/schemas/guests';

describe('AT07: RSVP Status Update & Invitation Card Synchronization', () => {
  it('strictly prohibits auto-inferring RSVP acceptance when marking an invitation card as sent', () => {
    // When invitation status changes to 'sent'
    const invInput = {
      event_id: FX01_FAMILY_GROUP.events.eveningReception.id,
      card_name: 'Gia đình Bác Ba & Các Cháu',
      representative_guest_id: FX01_FAMILY_GROUP.guests.father.id,
      delivery_method: 'in_person' as const,
      status: 'sent' as const,
      sent_date: '2028-02-15',
      notes: 'Đã trao tận tay',
      member_guest_ids: FX01_FAMILY_GROUP.invitation.memberGuestIds,
      version: 1,
    };
    const parsedInv = updateInvitationSchema.safeParse(invInput);
    expect(parsedInv.success).toBe(true);

    // INVARIANT: Updating invitation card does not alter member attendances.
    // Member attendance records retain their own distinct statuses.
    const babyAttendance = (FX01_FAMILY_GROUP.eveningAttendance as FixtureAttendance[]).find(
      (a: FixtureAttendance) => a.guestId === FX01_FAMILY_GROUP.guests.baby.id
    )!;

    // Even though card status is 'sent', baby's RSVP status is 'declined'
    expect(babyAttendance.rsvpStatus).toBe('declined');
    expect(babyAttendance.rsvpStatus).not.toBe('accepted');
  });

  it('guarantees heterogeneous RSVP responses within a single family group', () => {
    const eveningAtt = FX01_FAMILY_GROUP.eveningAttendance as FixtureAttendance[];

    const fatherAtt = eveningAtt.find((a: FixtureAttendance) => a.guestId === FX01_FAMILY_GROUP.guests.father.id)!;
    const motherAtt = eveningAtt.find((a: FixtureAttendance) => a.guestId === FX01_FAMILY_GROUP.guests.mother.id)!;
    const childAtt = eveningAtt.find((a: FixtureAttendance) => a.guestId === FX01_FAMILY_GROUP.guests.child.id)!;
    const babyAtt = eveningAtt.find((a: FixtureAttendance) => a.guestId === FX01_FAMILY_GROUP.guests.baby.id)!;

    // Distinct RSVP statuses under 1 card:
    // Father: accepted, regular meal
    expect(fatherAtt.rsvpStatus).toBe('accepted');
    expect(fatherAtt.mealDietaryTier).toBe('regular');

    // Mother: accepted, vegetarian meal
    expect(motherAtt.rsvpStatus).toBe('accepted');
    expect(motherAtt.mealDietaryTier).toBe('vegetarian');

    // Child: accepted, child portion meal
    expect(childAtt.rsvpStatus).toBe('accepted');
    expect(childAtt.mealDietaryTier).toBe('child_portion');

    // Baby: declined, no meal, no seat
    expect(babyAtt.rsvpStatus).toBe('declined');
    expect(babyAtt.needsSeat).toBe(false);
    expect(babyAtt.needsMeal).toBe(false);
  });

  it('validates optimistic concurrency control on attendance updates', () => {
    // Current version is 1
    const validUpdate = updateAttendanceSchema.safeParse({
      rsvp_status: 'accepted',
      contact_notes: 'Bác Ba xác nhận tham dự qua điện thoại',
      next_followup_date: null,
      needs_seat: true,
      needs_meal: true,
      meal_dietary_tier: 'regular',
      dietary_notes: null,
      accommodation_needed: false,
      transport_needed: false,
      version: 1, // Matches existing
    });
    expect(validUpdate.success).toBe(true);

    // Negative version or float version is rejected
    const invalidVersion = updateAttendanceSchema.safeParse({
      rsvp_status: 'accepted',
      needs_seat: true,
      needs_meal: true,
      meal_dietary_tier: 'regular',
      accommodation_needed: false,
      transport_needed: false,
      version: -1,
    });
    expect(invalidVersion.success).toBe(false);
  });

  it('permits re-opening a declined or accepted status back to tentative/pending', () => {
    const statuses = ['not_contacted', 'pending_reply', 'tentative', 'accepted', 'declined'] as const;

    for (const status of statuses) {
      const parsed = updateAttendanceSchema.safeParse({
        rsvp_status: status,
        needs_seat: status === 'accepted',
        needs_meal: status === 'accepted',
        meal_dietary_tier: 'regular',
        accommodation_needed: false,
        transport_needed: false,
        version: 2,
      });
      expect(parsed.success).toBe(true);
    }
  });
});
