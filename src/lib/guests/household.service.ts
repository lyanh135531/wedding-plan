import { eq, and, inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@/db/schema';
import {
  guests,
  guestGroups,
  invitations,
  invitationMembers,
  attendance,
} from '@/db/schema';
import { normalizeVietnamesePhone } from './search';
import {
  GuestOwnerDto,
  InvitationOwnerDto,
  guestOwnerDtoSchema,
  invitationOwnerDtoSchema,
} from '@/schemas/guests';
import { TxDb } from './types';

export interface HouseholdMemberInput {
  displayName: string;
  ageTier?: 'adult' | 'child' | 'baby';
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  isRepresentative?: boolean;
  rsvpStatus?: 'not_contacted' | 'pending_reply' | 'tentative' | 'accepted' | 'declined';
  needsSeat?: boolean;
  needsMeal?: boolean;
  mealDietaryTier?: 'regular' | 'vegetarian' | 'child_portion' | 'special';
  dietaryNotes?: string | null;
}

export interface CreateHouseholdInput {
  groupName: string;
  side?: 'groom' | 'bride' | 'mutual' | 'unassigned';
  eventId: string;
  deliveryMethod?: 'paper' | 'electronic' | 'in_person';
  members: HouseholdMemberInput[];
}

export interface CreateHouseholdResult {
  groupId: string;
  groupName: string;
  invitation: InvitationOwnerDto;
  guests: GuestOwnerDto[];
}

/**
 * Creates a household in an atomic transaction:
 * 1. Finds or creates guest group.
 * 2. Creates all guest records (honoring Baby policy: default needs_seat = false, needs_meal = false).
 * 3. Creates 1 invitation card for the event.
 * 4. Links all members to the invitation card.
 * 5. Creates attendance rows for all members for that event.
 */
export async function createHousehold(
  txDb: TxDb,
  input: CreateHouseholdInput,
  creatorUserId: string
): Promise<CreateHouseholdResult> {
  const { groupName, side = 'unassigned', eventId, deliveryMethod = 'paper', members } = input;

  if (!members || members.length === 0) {
    throw new Error('Hộ gia đình phải có ít nhất 1 thành viên');
  }

  // 1. Find or create guest group
  let groupId: string;
  const [existingGroup] = await txDb
    .select()
    .from(guestGroups)
    .where(and(eq(guestGroups.name, groupName.trim()), eq(guestGroups.side, side)))
    .limit(1);

  if (existingGroup) {
    groupId = existingGroup.id;
  } else {
    const [newGroup] = await txDb
      .insert(guestGroups)
      .values({
        name: groupName.trim(),
        side,
        sortOrder: 0,
      })
      .returning();
    groupId = newGroup.id;
  }

  // 2. Create guests
  const createdGuestsList: (typeof guests.$inferSelect)[] = [];
  let representativeGuestId: string | null = null;

  for (let i = 0; i < members.length; i++) {
    const m = members[i];
    const ageTier = m.ageTier || 'adult';
    const normPhone = m.phone ? (normalizeVietnamesePhone(m.phone) || m.phone.trim()) : null;

    const [createdGuest] = await txDb
      .insert(guests)
      .values({
        displayName: m.displayName.trim(),
        side,
        groupId,
        ageTier,
        phone: normPhone,
        email: m.email?.trim().toLowerCase() || null,
        address: m.address?.trim() || null,
        version: 1,
      })
      .returning();

    createdGuestsList.push(createdGuest);

    if (m.isRepresentative || (representativeGuestId === null && ageTier === 'adult')) {
      representativeGuestId = createdGuest.id;
    }
  }

  // If no representative selected, fallback to first guest
  if (!representativeGuestId && createdGuestsList.length > 0) {
    representativeGuestId = createdGuestsList[0].id;
  }

  // 3. Create invitation
  const memberGuestIds = createdGuestsList.map((g) => g.id);

  const [createdInv] = await txDb
    .insert(invitations)
    .values({
      eventId,
      cardName: groupName.trim(),
      representativeGuestId: representativeGuestId!,
      deliveryMethod,
      status: 'save_the_date',
      version: 1,
    })
    .returning();

  // 4. Link invitation members
  for (const gid of memberGuestIds) {
    await txDb.insert(invitationMembers).values({
      invitationId: createdInv.id,
      guestId: gid,
    });
  }

  // 5. Create initial attendance records
  for (let i = 0; i < members.length; i++) {
    const m = members[i];
    const g = createdGuestsList[i];
    const isBaby = g.ageTier === 'baby';

    // Baby policy: default needsSeat = false, needsMeal = false unless explicitly true
    const needsSeat = m.needsSeat !== undefined ? m.needsSeat : !isBaby;
    const needsMeal = m.needsMeal !== undefined ? m.needsMeal : !isBaby;
    const defaultDietary = g.ageTier === 'child' ? 'child_portion' : 'regular';

    await txDb.insert(attendance).values({
      guestId: g.id,
      eventId,
      rsvpStatus: m.rsvpStatus || 'not_contacted',
      needsSeat,
      needsMeal,
      mealDietaryTier: m.mealDietaryTier || defaultDietary,
      dietaryNotes: m.dietaryNotes?.trim() || null,
      version: 1,
    });
  }

  const guestDtos = createdGuestsList.map((g) =>
    guestOwnerDtoSchema.parse({
      id: g.id,
      display_name: g.displayName,
      side: g.side,
      group_id: g.groupId,
      sub_tags: g.subTags ?? [],
      age_tier: g.ageTier,
      phone: g.phone,
      email: g.email,
      address: g.address,
      private_notes: g.privateNotes,
      is_archived: g.isArchived,
      archived_at: g.archivedAt ? String(g.archivedAt) : null,
      is_placeholder: g.isPlaceholder,
      placeholder_for: g.placeholderFor,
      version: g.version,
      created_at: g.createdAt instanceof Date ? g.createdAt.toISOString() : String(g.createdAt),
      updated_at: g.updatedAt instanceof Date ? g.updatedAt.toISOString() : String(g.updatedAt),
    })
  );

  const invDto = invitationOwnerDtoSchema.parse({
    id: createdInv.id,
    event_id: createdInv.eventId,
    card_name: createdInv.cardName,
    representative_guest_id: createdInv.representativeGuestId,
    delivery_method: createdInv.deliveryMethod,
    in_charge_user_id: createdInv.inChargeUserId,
    status: createdInv.status,
    sent_date: createdInv.sentDate ? String(createdInv.sentDate) : null,
    notes: createdInv.notes,
    member_guest_ids: memberGuestIds,
    version: createdInv.version,
    created_at: createdInv.createdAt instanceof Date ? createdInv.createdAt.toISOString() : String(createdInv.createdAt),
    updated_at: createdInv.updatedAt instanceof Date ? createdInv.updatedAt.toISOString() : String(createdInv.updatedAt),
  });

  return {
    groupId,
    groupName: groupName.trim(),
    invitation: invDto,
    guests: guestDtos,
  };
}
