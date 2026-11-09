import { eq, and, inArray, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@/db/schema';
import {
  guests,
  invitations,
  invitationMembers,
  attendance,
  contactFollowups,
  auditLogs,
} from '@/db/schema';
import { MergeGuestsInput, GuestOwnerDto, guestOwnerDtoSchema } from '@/schemas/guests';
import { normalizeVietnamesePhone } from './search';
import { TxDb } from './types';

export interface MergeGuestsResult {
  success: boolean;
  retainedGuest: GuestOwnerDto;
  mergedGuestId: string;
}

/**
 * Executes an atomic profile merge transaction (AT09).
 *
 * Operations within transaction:
 * 1. Validates distinct guests and presence.
 * 2. Updates retained guest with resolved contact info, combined subtags, merged notes.
 * 3. Reassigns invitation card representative pointer.
 * 4. Resolves invitation card membership (enforcing single card per event).
 * 5. Resolves attendance conflicts per event (updates retained guest's row and removes duplicate).
 * 6. Reassigns communication logs (contact_followups).
 * 7. Soft-deletes merged guest with 'Merged into <retainedId>' note.
 * 8. Records comprehensive audit log.
 */
export async function mergeGuests(
  txDb: TxDb,
  input: MergeGuestsInput,
  operatorUserId: string
): Promise<MergeGuestsResult> {
  const { retained_guest_id, merged_guest_id } = input;

  if (retained_guest_id.toLowerCase() === merged_guest_id.toLowerCase()) {
    throw new Error('Bản ghi giữ lại và bản ghi gộp phải là hai người khác nhau');
  }

  // 1. Fetch both profiles
  const [retained] = await txDb
    .select()
    .from(guests)
    .where(eq(guests.id, retained_guest_id));
  const [merged] = await txDb
    .select()
    .from(guests)
    .where(eq(guests.id, merged_guest_id));

  if (!retained || !merged) {
    throw new Error('Một trong hai hồ sơ khách mời không tồn tại');
  }

  if (retained.isArchived) {
    throw new Error('Không thể gộp vào một hồ sơ đã bị xóa');
  }

  if (merged.isArchived) {
    throw new Error('Không thể gộp một hồ sơ đã bị xóa hoặc đã gộp trước đó');
  }

  // 2. Resolve scalar contact information and tags
  const resolvedPhone = input.resolved_phone !== undefined
    ? (input.resolved_phone ? normalizeVietnamesePhone(input.resolved_phone) || input.resolved_phone.trim() : null)
    : retained.phone;

  const resolvedEmail = input.resolved_email !== undefined
    ? (input.resolved_email ? input.resolved_email.trim().toLowerCase() : null)
    : retained.email;

  const resolvedAddress = input.resolved_address !== undefined
    ? (input.resolved_address ? input.resolved_address.trim() : null)
    : retained.address;

  const unionSubTags = Array.from(
    new Set([...(retained.subTags || []), ...(merged.subTags || [])])
  );

  const mergedNotesList: string[] = [];
  if (retained.privateNotes) mergedNotesList.push(retained.privateNotes.trim());
  if (merged.privateNotes) {
    mergedNotesList.push(`[Ghi chú từ hồ sơ gộp (${merged.displayName})]: ${merged.privateNotes.trim()}`);
  }
  const combinedNotes = mergedNotesList.length > 0 ? mergedNotesList.join('\n\n') : null;

  const [updatedRetained] = await txDb
    .update(guests)
    .set({
      phone: resolvedPhone,
      email: resolvedEmail,
      address: resolvedAddress,
      subTags: unionSubTags,
      privateNotes: combinedNotes,
      version: retained.version + 1,
      updatedAt: new Date(),
    })
    .where(eq(guests.id, retained_guest_id))
    .returning();

  // 3 & 4. Resolve invitation cards and memberships
  // Find all cards where merged guest is a member
  const mergedMemberships = await txDb
    .select({
      invitationId: invitationMembers.invitationId,
      eventId: invitations.eventId,
      representativeGuestId: invitations.representativeGuestId,
    })
    .from(invitationMembers)
    .innerJoin(invitations, eq(invitationMembers.invitationId, invitations.id))
    .where(eq(invitationMembers.guestId, merged_guest_id));

  // Find all events where retained guest ALREADY has an invitation
  const retainedMemberships = await txDb
    .select({
      invitationId: invitationMembers.invitationId,
      eventId: invitations.eventId,
    })
    .from(invitationMembers)
    .innerJoin(invitations, eq(invitationMembers.invitationId, invitations.id))
    .where(eq(invitationMembers.guestId, retained_guest_id));

  const retainedEventsSet = new Set(retainedMemberships.map((m) => m.eventId));

  for (const m of mergedMemberships) {
    if (retainedEventsSet.has(m.eventId)) {
      // Conflict: Retained guest already belongs to another card in this event.
      // Remove merged guest's membership to preserve single-card-per-event invariant.
      await txDb
        .delete(invitationMembers)
        .where(
          and(
            eq(invitationMembers.invitationId, m.invitationId),
            eq(invitationMembers.guestId, merged_guest_id)
          )
        );

      // Check remaining members in this card
      const remainingMembers = await txDb
        .select({ guestId: invitationMembers.guestId })
        .from(invitationMembers)
        .where(eq(invitationMembers.invitationId, m.invitationId));

      if (remainingMembers.length === 0) {
        // Card has become empty — clean up orphaned invitation card
        await txDb
          .delete(invitations)
          .where(eq(invitations.id, m.invitationId));
      } else if (m.representativeGuestId === merged_guest_id) {
        // Card still has members, but its representative was the merged guest.
        // Reassign representative to the first remaining member (cannot be retained guest).
        await txDb
          .update(invitations)
          .set({
            representativeGuestId: remainingMembers[0].guestId,
            updatedAt: new Date(),
          })
          .where(eq(invitations.id, m.invitationId));
      }
    } else {
      // Retained guest has no card in this event: transfer membership to retained guest
      await txDb
        .update(invitationMembers)
        .set({ guestId: retained_guest_id })
        .where(
          and(
            eq(invitationMembers.invitationId, m.invitationId),
            eq(invitationMembers.guestId, merged_guest_id)
          )
        );

      if (m.representativeGuestId === merged_guest_id) {
        await txDb
          .update(invitations)
          .set({
            representativeGuestId: retained_guest_id,
            updatedAt: new Date(),
          })
          .where(eq(invitations.id, m.invitationId));
      }

      retainedEventsSet.add(m.eventId);
    }
  }

  // Edge case safety: Any remaining cards where representative was merged_guest_id
  // but merged was not in invitationMembers
  await txDb
    .update(invitations)
    .set({
      representativeGuestId: retained_guest_id,
      updatedAt: new Date(),
    })
    .where(eq(invitations.representativeGuestId, merged_guest_id));

  // 5. Resolve attendance conflicts
  const retainedAttRows = await txDb
    .select()
    .from(attendance)
    .where(eq(attendance.guestId, retained_guest_id));

  const mergedAttRows = await txDb
    .select()
    .from(attendance)
    .where(eq(attendance.guestId, merged_guest_id));

  const retainedAttByEvent = new Map(retainedAttRows.map((r) => [r.eventId, r]));
  const resolutionsByEvent = new Map(
    (input.attendance_conflict_resolutions || []).map((r) => [r.event_id, r])
  );

  for (const mergedAtt of mergedAttRows) {
    const existingRetainedAtt = retainedAttByEvent.get(mergedAtt.eventId);

    if (existingRetainedAtt) {
      // Conflict: both guests have an attendance record for this event
      const resolution = resolutionsByEvent.get(mergedAtt.eventId);
      if (resolution) {
        await txDb
          .update(attendance)
          .set({
            rsvpStatus: resolution.chosen_rsvp_status,
            needsSeat: resolution.needs_seat,
            needsMeal: resolution.needs_meal,
            mealDietaryTier: resolution.meal_dietary_tier,
            version: existingRetainedAtt.version + 1,
            updatedAt: new Date(),
          })
          .where(eq(attendance.id, existingRetainedAtt.id));
      }
      // Delete merged attendance row to preserve UNIQUE(guest_id, event_id)
      await txDb.delete(attendance).where(eq(attendance.id, mergedAtt.id));
    } else {
      // Retained guest wasn't invited to this event: reassign attendance row
      await txDb
        .update(attendance)
        .set({
          guestId: retained_guest_id,
          version: mergedAtt.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(attendance.id, mergedAtt.id));
    }
  }

  // 6. Reassign contact followups
  await txDb
    .update(contactFollowups)
    .set({ guestId: retained_guest_id })
    .where(eq(contactFollowups.guestId, merged_guest_id));

  // 7. Soft delete merged guest profile
  await txDb
    .update(guests)
    .set({
      isArchived: true,
      archivedAt: new Date(),
      placeholderFor: `Merged into ${retained_guest_id}`,
      updatedAt: new Date(),
    })
    .where(eq(guests.id, merged_guest_id));

  // 8. Record audit log
  await txDb.insert(auditLogs).values({
    userId: operatorUserId,
    action: 'MERGE_GUESTS',
    entityType: 'guest',
    entityId: retained_guest_id,
    beforeState: { retained, merged },
    afterState: {
      retainedGuestId: retained_guest_id,
      mergedGuestId: merged_guest_id,
      updatedRetained,
    },
  });

  const dto = guestOwnerDtoSchema.parse({
    id: updatedRetained.id,
    display_name: updatedRetained.displayName,
    side: updatedRetained.side,
    group_id: updatedRetained.groupId,
    sub_tags: updatedRetained.subTags ?? [],
    age_tier: updatedRetained.ageTier,
    phone: updatedRetained.phone,
    email: updatedRetained.email,
    address: updatedRetained.address,
    private_notes: updatedRetained.privateNotes,
    is_archived: updatedRetained.isArchived,
    archived_at: updatedRetained.archivedAt ? String(updatedRetained.archivedAt) : null,
    is_placeholder: updatedRetained.isPlaceholder,
    placeholder_for: updatedRetained.placeholderFor,
    version: updatedRetained.version,
    created_at: updatedRetained.createdAt instanceof Date ? updatedRetained.createdAt.toISOString() : String(updatedRetained.createdAt),
    updated_at: updatedRetained.updatedAt instanceof Date ? updatedRetained.updatedAt.toISOString() : String(updatedRetained.updatedAt),
  });

  return {
    success: true,
    retainedGuest: dto,
    mergedGuestId: merged_guest_id,
  };
}
