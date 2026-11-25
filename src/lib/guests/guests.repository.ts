import { eq, and, sql, desc, inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@/db/schema';
import { guests, attendance, auditLogs, invitations, invitationMembers, events } from '@/db/schema';
import {
  guestOwnerDtoSchema,
  guestFamilyDtoSchema,
  GuestOwnerDto,
  GuestFamilyDto,
  CreateGuestInput,
  UpdateGuestInput,
} from '@/schemas/guests';
import { normalizeSearchTerm, normalizeVietnamesePhone, extractSearchablePhone } from './search';
import { TxDb } from './types';

export interface ListGuestsParams {
  search?: string;
  side?: 'groom' | 'bride' | 'mutual' | 'unassigned';
  groupId?: string;
  rsvpStatus?: 'not_contacted' | 'pending_reply' | 'tentative' | 'accepted' | 'declined';
  eventId?: string;
  isArchived?: boolean;
  limit?: number;
  offset?: number;
  role?: 'owner' | 'family_view';
  allowedEventIds?: string[];
}

function mapToOwnerDto(row: typeof guests.$inferSelect): GuestOwnerDto {
  return guestOwnerDtoSchema.parse({
    id: row.id,
    display_name: row.displayName,
    side: row.side,
    group_id: row.groupId,
    sub_tags: row.subTags ?? [],
    age_tier: row.ageTier,
    phone: row.phone,
    email: row.email,
    address: row.address,
    private_notes: row.privateNotes,
    is_archived: row.isArchived,
    archived_at: row.archivedAt ? (row.archivedAt instanceof Date ? row.archivedAt.toISOString() : String(row.archivedAt)) : null,
    is_placeholder: row.isPlaceholder,
    placeholder_for: row.placeholderFor,
    version: row.version,
    created_at: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updated_at: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  });
}

function mapToFamilyDto(row: typeof guests.$inferSelect): GuestFamilyDto {
  return guestFamilyDtoSchema.parse({
    id: row.id,
    display_name: row.displayName,
    side: row.side,
    group_id: row.groupId,
    sub_tags: row.subTags ?? [],
    age_tier: row.ageTier,
    is_placeholder: row.isPlaceholder,
    placeholder_for: row.placeholderFor,
    version: row.version,
    created_at: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updated_at: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  });
}

/**
 * Lists guests with filtering, unaccent search, and role-based masking.
 */
export async function listGuests(
  txDb: TxDb,
  params: ListGuestsParams = {}
): Promise<(GuestOwnerDto | GuestFamilyDto)[]> {
  const {
    search,
    side,
    groupId,
    rsvpStatus,
    eventId,
    isArchived = false,
    limit = 200,
    offset = 0,
    role = 'owner',
    allowedEventIds = [],
  } = params;

  // Family view access check: if family has no allowed events, return empty
  if (role === 'family_view' && allowedEventIds.length === 0) {
    return [];
  }

  // Build filter conditions
  const conditions = [eq(guests.isArchived, isArchived)];

  if (side) {
    conditions.push(eq(guests.side, side));
  }

  if (groupId) {
    conditions.push(eq(guests.groupId, groupId));
  }

  // Handle eventId and allowedEventIds scoping
  let guestIdsForEvent: string[] | null = null;
  if (eventId) {
    // If family_view, check that eventId is in allowedEventIds
    if (role === 'family_view' && !allowedEventIds.includes(eventId)) {
      return [];
    }
    const attConditions = [eq(attendance.eventId, eventId)];
    if (rsvpStatus) {
      attConditions.push(eq(attendance.rsvpStatus, rsvpStatus));
    }
    const attRows = await txDb
      .select({ guestId: attendance.guestId })
      .from(attendance)
      .where(and(...attConditions));
    guestIdsForEvent = attRows.map((r) => r.guestId);
  } else if (role === 'family_view') {
    const attRows = await txDb
      .select({ guestId: attendance.guestId })
      .from(attendance)
      .where(inArray(attendance.eventId, allowedEventIds));
    guestIdsForEvent = attRows.map((r) => r.guestId);
  } else if (rsvpStatus) {
    const attRows = await txDb
      .select({ guestId: attendance.guestId })
      .from(attendance)
      .where(eq(attendance.rsvpStatus, rsvpStatus));
    guestIdsForEvent = attRows.map((r) => r.guestId);
  }

  if (guestIdsForEvent !== null) {
    if (guestIdsForEvent.length === 0) {
      return [];
    }
    conditions.push(inArray(guests.id, guestIdsForEvent));
  }

  // Vietnamese unaccent search + phone search
  if (search && search.trim()) {
    const norm = normalizeSearchTerm(search);
    const normPhone = extractSearchablePhone(search);
    if (normPhone) {
      conditions.push(
        sql`(immutable_unaccent(lower(${guests.displayName})) ILIKE ${'%' + norm + '%'} OR ${guests.phone} ILIKE ${'%' + normPhone + '%'})`
      );
    } else {
      conditions.push(
        sql`immutable_unaccent(lower(${guests.displayName})) ILIKE ${'%' + norm + '%'}`
      );
    }
  }

  const query = txDb
    .select()
    .from(guests)
    .where(and(...conditions))
    .orderBy(desc(guests.createdAt))
    .limit(limit)
    .offset(offset);

  const rows = await query;

  if (role === 'family_view') {
    return rows.map(mapToFamilyDto);
  }
  return rows.map(mapToOwnerDto);
}

/**
 * Gets a single guest by ID, masked if family_view.
 */
export async function getGuestById(
  txDb: TxDb,
  id: string,
  role: 'owner' | 'family_view' = 'owner',
  allowedEventIds: string[] = []
): Promise<GuestOwnerDto | GuestFamilyDto | null> {
  const [row] = await txDb.select().from(guests).where(eq(guests.id, id));
  if (!row) return null;

  if (role === 'family_view') {
    if (allowedEventIds.length === 0) return null;
    const att = await txDb
      .select({ id: attendance.id })
      .from(attendance)
      .where(and(eq(attendance.guestId, id), inArray(attendance.eventId, allowedEventIds)))
      .limit(1);

    if (att.length === 0) return null;
    return mapToFamilyDto(row);
  }

  return mapToOwnerDto(row);
}

/**
 * Creates a single guest profile, and optionally seeds an individual invitation
 * and default attendance record when `event_id` is supplied.
 */
export async function createGuest(
  txDb: TxDb,
  input: CreateGuestInput,
  creatorUserId: string
): Promise<GuestOwnerDto> {
  const [created] = await txDb
    .insert(guests)
    .values({
      displayName: input.display_name.trim(),
      side: input.side,
      groupId: input.group_id ?? null,
      subTags: input.sub_tags ?? [],
      ageTier: input.age_tier,
      phone: input.phone ? (normalizeVietnamesePhone(input.phone) || input.phone.trim()) : null,
      email: input.email ? input.email.trim().toLowerCase() : null,
      address: input.address?.trim() || null,
      privateNotes: input.private_notes?.trim() || null,
      isPlaceholder: input.is_placeholder,
      placeholderFor: input.placeholder_for?.trim() || null,
      version: 1,
    })
    .returning();

  if (input.event_id) {
    const [targetEvent] = await txDb
      .select({ id: events.id })
      .from(events)
      .where(eq(events.id, input.event_id))
      .limit(1);

    if (!targetEvent) {
      throw new Error('Buổi lễ không tồn tại');
    }

    const rsvpStatus = input.initial_rsvp_status ?? 'accepted';
    const isBaby = created.ageTier === 'baby';
    const isDeclined = rsvpStatus === 'declined';
    const needsSeat = !isBaby && !isDeclined;
    const needsMeal = !isBaby && !isDeclined;
    const defaultDietary = created.ageTier === 'child' ? 'child_portion' : 'regular';

    const [createdInv] = await txDb
      .insert(invitations)
      .values({
        eventId: input.event_id,
        cardName: created.displayName,
        representativeGuestId: created.id,
        deliveryMethod: 'paper',
        status: 'save_the_date',
        version: 1,
      })
      .returning();

    await txDb.insert(invitationMembers).values({
      invitationId: createdInv.id,
      guestId: created.id,
    });

    await txDb.insert(attendance).values({
      guestId: created.id,
      eventId: input.event_id,
      rsvpStatus,
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

  return mapToOwnerDto(created);
}

/**
 * Updates a guest profile with optimistic locking.
 */
export async function updateGuest(
  txDb: TxDb,
  id: string,
  input: UpdateGuestInput,
  updaterUserId: string
): Promise<GuestOwnerDto> {
  const [updated] = await txDb
    .update(guests)
    .set({
      displayName: input.display_name.trim(),
      side: input.side,
      groupId: input.group_id ?? null,
      subTags: input.sub_tags ?? [],
      ageTier: input.age_tier,
      phone: input.phone ? (normalizeVietnamesePhone(input.phone) || input.phone.trim()) : null,
      email: input.email ? input.email.trim().toLowerCase() : null,
      address: input.address?.trim() || null,
      privateNotes: input.private_notes?.trim() || null,
      isPlaceholder: input.is_placeholder,
      placeholderFor: input.placeholder_for?.trim() || null,
      version: input.version + 1,
      updatedAt: new Date(),
    })
    .where(and(eq(guests.id, id), eq(guests.version, input.version)))
    .returning();

  if (!updated) {
    const [existing] = await txDb.select().from(guests).where(eq(guests.id, id));
    if (!existing) {
      throw new Error('Khách mời không tồn tại');
    }
    throw new Error('Dữ liệu đã bị thay đổi bởi người khác, vui lòng làm mới trang');
  }

  return mapToOwnerDto(updated);
}

/**
 * Permanently deletes a guest profile inside a transaction, deleting empty
 * solo invitation cards or reassigning multi-member card representatives first
 * so the invitations.representative_guest_id FK constraint holds.
 */
export async function deleteGuest(
  txDb: TxDb,
  id: string,
  deleterUserId: string
): Promise<boolean> {
  const [existing] = await txDb.select().from(guests).where(eq(guests.id, id));
  if (!existing) return false;

  // 1. Gather all invitations referencing this guest via membership or representative FK
  const memberInvRows = await txDb
    .select({ invitationId: invitationMembers.invitationId })
    .from(invitationMembers)
    .where(eq(invitationMembers.guestId, id));

  const repInvRows = await txDb
    .select({
      id: invitations.id,
      version: invitations.version,
      representativeGuestId: invitations.representativeGuestId,
    })
    .from(invitations)
    .where(eq(invitations.representativeGuestId, id));

  const memberInvIds = memberInvRows.map((row) => row.invitationId);
  const allInvIds = Array.from(
    new Set([...memberInvIds, ...repInvRows.map((row) => row.id)])
  );

  // 2. Remove the deleted guest from invitation_members before re-checking card members
  if (memberInvIds.length > 0) {
    await txDb.delete(invitationMembers).where(eq(invitationMembers.guestId, id));
  }

  // 3. Delete empty cards or promote another member to representative before deleting guest
  if (allInvIds.length > 0) {
    const affectedCards = await txDb
      .select({
        id: invitations.id,
        version: invitations.version,
        representativeGuestId: invitations.representativeGuestId,
      })
      .from(invitations)
      .where(inArray(invitations.id, allInvIds));

    for (const card of affectedCards) {
      const remainingMembers = await txDb
        .select({ guestId: invitationMembers.guestId })
        .from(invitationMembers)
        .where(eq(invitationMembers.invitationId, card.id));

      if (remainingMembers.length === 0) {
        await txDb.delete(invitations).where(eq(invitations.id, card.id));
      } else if (card.representativeGuestId === id) {
        await txDb
          .update(invitations)
          .set({
            representativeGuestId: remainingMembers[0].guestId,
            version: card.version + 1,
            updatedAt: new Date(),
          })
          .where(eq(invitations.id, card.id));
      }
    }
  }

  // 4. Hard delete guest (DB cascades attendance, seats, followups, meals, rooms, trips; sets gift_contributors.guest_id NULL)
  await txDb.delete(guests).where(eq(guests.id, id));

  await txDb.insert(auditLogs).values({
    userId: deleterUserId,
    action: 'DELETE',
    entityType: 'guest',
    entityId: id,
    beforeState: existing,
    afterState: null,
  });

  return true;
}
