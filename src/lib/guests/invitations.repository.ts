import { eq, and, inArray, sql, desc, ne } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@/db/schema';
import { invitations, invitationMembers, attendance, guests } from '@/db/schema';
import {
  invitationOwnerDtoSchema,
  invitationFamilyDtoSchema,
  InvitationOwnerDto,
  InvitationFamilyDto,
  CreateInvitationInput,
  UpdateInvitationInput,
} from '@/schemas/guests';
import { TxDb } from './types';

function mapToOwnerDto(
  inv: typeof invitations.$inferSelect,
  memberGuestIds: string[]
): InvitationOwnerDto {
  return invitationOwnerDtoSchema.parse({
    id: inv.id,
    event_id: inv.eventId,
    card_name: inv.cardName,
    representative_guest_id: inv.representativeGuestId,
    delivery_method: inv.deliveryMethod,
    in_charge_user_id: inv.inChargeUserId,
    status: inv.status,
    sent_date: inv.sentDate ? String(inv.sentDate) : null,
    notes: inv.notes,
    member_guest_ids: memberGuestIds,
    version: inv.version,
    created_at: inv.createdAt instanceof Date ? inv.createdAt.toISOString() : String(inv.createdAt),
    updated_at: inv.updatedAt instanceof Date ? inv.updatedAt.toISOString() : String(inv.updatedAt),
  });
}

function mapToFamilyDto(
  inv: typeof invitations.$inferSelect,
  memberGuestIds: string[]
): InvitationFamilyDto {
  return invitationFamilyDtoSchema.parse({
    id: inv.id,
    event_id: inv.eventId,
    card_name: inv.cardName,
    representative_guest_id: inv.representativeGuestId,
    delivery_method: inv.deliveryMethod,
    status: inv.status,
    sent_date: inv.sentDate ? String(inv.sentDate) : null,
    member_guest_ids: memberGuestIds,
    version: inv.version,
    created_at: inv.createdAt instanceof Date ? inv.createdAt.toISOString() : String(inv.createdAt),
    updated_at: inv.updatedAt instanceof Date ? inv.updatedAt.toISOString() : String(inv.updatedAt),
  });
}

/**
 * Lists invitations for an event with members populated and role-based masking.
 */
export async function listInvitations(
  txDb: TxDb,
  eventId: string,
  role: 'owner' | 'family_view' = 'owner',
  allowedEventIds: string[] = []
): Promise<(InvitationOwnerDto | InvitationFamilyDto)[]> {
  if (role === 'family_view' && !allowedEventIds.includes(eventId)) {
    return [];
  }

  const invRows = await txDb
    .select()
    .from(invitations)
    .where(eq(invitations.eventId, eventId))
    .orderBy(desc(invitations.createdAt));

  if (invRows.length === 0) {
    return [];
  }

  const invIds = invRows.map((i) => i.id);
  const memberRows = await txDb
    .select({
      invitationId: invitationMembers.invitationId,
      guestId: invitationMembers.guestId,
    })
    .from(invitationMembers)
    .where(inArray(invitationMembers.invitationId, invIds));

  const membersByInv = new Map<string, string[]>();
  for (const m of memberRows) {
    const list = membersByInv.get(m.invitationId) || [];
    list.push(m.guestId);
    membersByInv.set(m.invitationId, list);
  }

  return invRows.map((inv) => {
    const memberGuestIds = membersByInv.get(inv.id) || [];
    if (role === 'family_view') {
      return mapToFamilyDto(inv, memberGuestIds);
    }
    return mapToOwnerDto(inv, memberGuestIds);
  });
}

/**
 * Gets a single invitation card by ID.
 */
export async function getInvitationById(
  txDb: TxDb,
  id: string,
  role: 'owner' | 'family_view' = 'owner',
  allowedEventIds: string[] = []
): Promise<InvitationOwnerDto | InvitationFamilyDto | null> {
  const [inv] = await txDb.select().from(invitations).where(eq(invitations.id, id));
  if (!inv) return null;

  if (role === 'family_view' && !allowedEventIds.includes(inv.eventId)) {
    return null;
  }

  const memberRows = await txDb
    .select({ guestId: invitationMembers.guestId })
    .from(invitationMembers)
    .where(eq(invitationMembers.invitationId, id));

  const memberGuestIds = memberRows.map((m) => m.guestId);

  if (role === 'family_view') {
    return mapToFamilyDto(inv, memberGuestIds);
  }
  return mapToOwnerDto(inv, memberGuestIds);
}

/**
 * Creates an invitation card with members.
 *
 * CRUCIAL DOMAIN INVARIANT (AT05, Invariant A):
 * A guest CANNOT belong to more than 1 invitation card in the SAME event_id.
 * This function validates member uniqueness against all existing cards in the event
 * inside the same transaction.
 */
export async function createInvitation(
  txDb: TxDb,
  input: CreateInvitationInput,
  creatorUserId: string
): Promise<InvitationOwnerDto> {
  // 1. Normalize member list to include representative guest and deduplicate BEFORE checking conflicts
  const memberSet = new Set(input.member_guest_ids);
  if (input.representative_guest_id) {
    memberSet.add(input.representative_guest_id);
  }
  const finalizedMemberIds = Array.from(memberSet);

  if (finalizedMemberIds.length === 0) {
    throw new Error('Thiệp mời phải có ít nhất 1 khách nhận');
  }

  // 2. Validate guest existence and ensure no archived profiles are invited
  const guestRows = await txDb
    .select({
      id: guests.id,
      displayName: guests.displayName,
      ageTier: guests.ageTier,
      isArchived: guests.isArchived,
    })
    .from(guests)
    .where(inArray(guests.id, finalizedMemberIds));

  if (guestRows.length !== finalizedMemberIds.length) {
    throw new Error('Một hoặc nhiều khách mời không tồn tại trong hệ thống');
  }

  const archivedGuest = guestRows.find((g) => g.isArchived);
  if (archivedGuest) {
    throw new Error(
      `Không thể tạo thiệp mời cho khách "${archivedGuest.displayName}" đã bị xóa hoặc đã gộp hồ sơ`
    );
  }

  const guestMap = new Map(guestRows.map((g) => [g.id, g]));

  // 3. CRITICAL INVARIANT: Check conflict for ALL finalized members (including representative)
  const existingMemberships = await txDb
    .select({
      guestId: invitationMembers.guestId,
      cardName: invitations.cardName,
    })
    .from(invitationMembers)
    .innerJoin(invitations, eq(invitationMembers.invitationId, invitations.id))
    .where(
      and(
        eq(invitations.eventId, input.event_id),
        inArray(invitationMembers.guestId, finalizedMemberIds)
      )
    );

  if (existingMemberships.length > 0) {
    const conflict = existingMemberships[0];
    throw new Error(
      `Khách mời đã thuộc thiệp "${conflict.cardName}" trong cùng buổi tiệc này`
    );
  }

  // 4. Insert invitation card
  const [created] = await txDb
    .insert(invitations)
    .values({
      eventId: input.event_id,
      cardName: input.card_name.trim(),
      representativeGuestId: input.representative_guest_id,
      deliveryMethod: input.delivery_method,
      inChargeUserId: input.in_charge_user_id || null,
      status: input.status,
      sentDate: input.sent_date ? input.sent_date : null,
      notes: input.notes?.trim() || null,
      version: 1,
    })
    .returning();

  // 5. Insert invitation members
  for (const guestId of finalizedMemberIds) {
    await txDb.insert(invitationMembers).values({
      invitationId: created.id,
      guestId,
    });
  }

  // 6. Seed initial attendance records for members lacking attendance for this event
  const existingAttendanceRows = await txDb
    .select({ guestId: attendance.guestId })
    .from(attendance)
    .where(
      and(
        eq(attendance.eventId, input.event_id),
        inArray(attendance.guestId, finalizedMemberIds)
      )
    );

  const existingAttSet = new Set(existingAttendanceRows.map((a) => a.guestId));

  for (const guestId of finalizedMemberIds) {
    if (!existingAttSet.has(guestId)) {
      const g = guestMap.get(guestId)!;
      const isBaby = g.ageTier === 'baby';

      // Baby policy: default needsSeat = false, needsMeal = false unless explicitly requested
      const needsSeat = !isBaby;
      const needsMeal = !isBaby;
      const defaultDietary = g.ageTier === 'child' ? 'child_portion' : 'regular';

      await txDb.insert(attendance).values({
        guestId,
        eventId: input.event_id,
        rsvpStatus: 'not_contacted',
        contactCount: 0,
        contactNotes: null,
        nextFollowupDate: null,
        needsSeat,
        needsMeal,
        mealDietaryTier: defaultDietary,
        dietaryNotes: null,
        accommodationNeeded: false,
        transportNeeded: false,
        isOriginOnsite: false,
        version: 1,
      });
    }
  }

  return mapToOwnerDto(created, finalizedMemberIds);
}

/**
 * Updates an invitation card with member uniqueness verification and optimistic locking.
 */
export async function updateInvitation(
  txDb: TxDb,
  id: string,
  input: UpdateInvitationInput,
  updaterUserId: string
): Promise<InvitationOwnerDto> {
  // 1. Normalize member list to include representative guest and deduplicate
  const memberSet = new Set(input.member_guest_ids);
  if (input.representative_guest_id) {
    memberSet.add(input.representative_guest_id);
  }
  const finalizedMemberIds = Array.from(memberSet);

  if (finalizedMemberIds.length === 0) {
    throw new Error('Thiệp mời phải có ít nhất 1 khách nhận');
  }

  // 2. Validate guest existence and ensure no archived profiles are invited
  const guestRows = await txDb
    .select({
      id: guests.id,
      displayName: guests.displayName,
      ageTier: guests.ageTier,
      isArchived: guests.isArchived,
    })
    .from(guests)
    .where(inArray(guests.id, finalizedMemberIds));

  if (guestRows.length !== finalizedMemberIds.length) {
    throw new Error('Một hoặc nhiều khách mời không tồn tại trong hệ thống');
  }

  const archivedGuest = guestRows.find((g) => g.isArchived);
  if (archivedGuest) {
    throw new Error(
      `Không thể cập nhật thiệp mời cho khách "${archivedGuest.displayName}" đã bị xóa hoặc đã gộp hồ sơ`
    );
  }

  const guestMap = new Map(guestRows.map((g) => [g.id, g]));

  // 3. CRITICAL INVARIANT: Check conflict for ALL finalized members against other cards in the same event
  const existingMemberships = await txDb
    .select({
      guestId: invitationMembers.guestId,
      cardName: invitations.cardName,
    })
    .from(invitationMembers)
    .innerJoin(invitations, eq(invitationMembers.invitationId, invitations.id))
    .where(
      and(
        eq(invitations.eventId, input.event_id),
        inArray(invitationMembers.guestId, finalizedMemberIds),
        ne(invitations.id, id)
      )
    );

  if (existingMemberships.length > 0) {
    const conflict = existingMemberships[0];
    throw new Error(
      `Khách mời đã thuộc thiệp "${conflict.cardName}" trong cùng buổi tiệc này`
    );
  }

  // 4. Update invitation card with optimistic concurrency check
  const [updated] = await txDb
    .update(invitations)
    .set({
      cardName: input.card_name.trim(),
      representativeGuestId: input.representative_guest_id,
      deliveryMethod: input.delivery_method,
      inChargeUserId: input.in_charge_user_id || null,
      status: input.status,
      sentDate: input.sent_date ? input.sent_date : null,
      notes: input.notes?.trim() || null,
      version: input.version + 1,
      updatedAt: new Date(),
    })
    .where(and(eq(invitations.id, id), eq(invitations.version, input.version)))
    .returning();

  if (!updated) {
    const [existing] = await txDb.select().from(invitations).where(eq(invitations.id, id));
    if (!existing) {
      throw new Error('Thiệp mời không tồn tại');
    }
    throw new Error('Dữ liệu đã bị thay đổi bởi người khác, vui lòng làm mới trang');
  }

  // 5. Sync card members
  await txDb.delete(invitationMembers).where(eq(invitationMembers.invitationId, id));
  for (const guestId of finalizedMemberIds) {
    await txDb.insert(invitationMembers).values({
      invitationId: id,
      guestId,
    });
  }

  // 6. Seed attendance records for any newly added members who lack attendance for this event
  const existingAttendanceRows = await txDb
    .select({ guestId: attendance.guestId })
    .from(attendance)
    .where(
      and(
        eq(attendance.eventId, input.event_id),
        inArray(attendance.guestId, finalizedMemberIds)
      )
    );

  const existingAttSet = new Set(existingAttendanceRows.map((a) => a.guestId));

  for (const guestId of finalizedMemberIds) {
    if (!existingAttSet.has(guestId)) {
      const g = guestMap.get(guestId)!;
      const isBaby = g.ageTier === 'baby';

      const needsSeat = !isBaby;
      const needsMeal = !isBaby;
      const defaultDietary = g.ageTier === 'child' ? 'child_portion' : 'regular';

      await txDb.insert(attendance).values({
        guestId,
        eventId: input.event_id,
        rsvpStatus: 'not_contacted',
        contactCount: 0,
        contactNotes: null,
        nextFollowupDate: null,
        needsSeat,
        needsMeal,
        mealDietaryTier: defaultDietary,
        dietaryNotes: null,
        accommodationNeeded: false,
        transportNeeded: false,
        isOriginOnsite: false,
        version: 1,
      });
    }
  }

  return mapToOwnerDto(updated, finalizedMemberIds);
}

/**
 * Bulk marks invitations as sent (UXT05, FL04).
 *
 * CRITICAL DOMAIN INVARIANT (AT07, UXT05):
 * Marking invitations as sent MUST NOT modify attendance.rsvp_status!
 */
export async function bulkMarkInvitationsSent(
  txDb: TxDb,
  invitationIds: string[],
  sentDate: string,
  updaterUserId: string
): Promise<number> {
  if (invitationIds.length === 0) return 0;

  const res = await txDb
    .update(invitations)
    .set({
      status: 'sent',
      sentDate,
      updatedAt: new Date(),
    })
    .where(inArray(invitations.id, invitationIds))
    .returning({ id: invitations.id });

  return res.length;
}
