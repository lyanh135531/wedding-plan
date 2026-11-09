import { eq, and, inArray, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@/db/schema';
import { attendance, guests, auditLogs } from '@/db/schema';
import {
  attendanceOwnerDtoSchema,
  attendanceFamilyDtoSchema,
  AttendanceOwnerDto,
  AttendanceFamilyDto,
  UpdateAttendanceInput,
  EventHeadcountSummaryDto,
} from '@/schemas/guests';
import { computeEventHeadcountBreakdown } from './headcount';
import { TxDb } from './types';

function mapToOwnerDto(row: typeof attendance.$inferSelect): AttendanceOwnerDto {
  return attendanceOwnerDtoSchema.parse({
    id: row.id,
    guest_id: row.guestId,
    event_id: row.eventId,
    rsvp_status: row.rsvpStatus,
    contact_count: row.contactCount,
    contact_notes: row.contactNotes,
    next_followup_date: row.nextFollowupDate ? String(row.nextFollowupDate) : null,
    needs_seat: row.needsSeat,
    needs_meal: row.needsMeal,
    meal_dietary_tier: row.mealDietaryTier,
    dietary_notes: row.dietaryNotes,
    accommodation_needed: row.accommodationNeeded ?? false,
    transport_needed: row.transportNeeded ?? false,
    is_origin_onsite: row.isOriginOnsite ?? false,
    version: row.version,
    created_at: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updated_at: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  });
}

function mapToFamilyDto(row: typeof attendance.$inferSelect): AttendanceFamilyDto {
  return attendanceFamilyDtoSchema.parse({
    id: row.id,
    guest_id: row.guestId,
    event_id: row.eventId,
    rsvp_status: row.rsvpStatus,
    needs_seat: row.needsSeat,
    needs_meal: row.needsMeal,
    meal_dietary_tier: row.mealDietaryTier,
    dietary_notes: row.dietaryNotes,
    accommodation_needed: row.accommodationNeeded ?? false,
    transport_needed: row.transportNeeded ?? false,
    version: row.version,
    created_at: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updated_at: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  });
}

export interface ListAttendanceParams {
  eventId?: string;
  guestId?: string;
  rsvpStatus?: 'not_contacted' | 'pending_reply' | 'tentative' | 'accepted' | 'declined';
  role?: 'owner' | 'family_view';
  allowedEventIds?: string[];
}

/**
 * Lists attendance records with role-based filtering and masking.
 */
export async function listAttendance(
  txDb: TxDb,
  params: ListAttendanceParams = {}
): Promise<(AttendanceOwnerDto | AttendanceFamilyDto)[]> {
  const { eventId, guestId, rsvpStatus, role = 'owner', allowedEventIds = [] } = params;

  if (role === 'family_view') {
    if (allowedEventIds.length === 0) return [];
    if (eventId && !allowedEventIds.includes(eventId)) return [];
  }

  const conditions = [];
  if (eventId) {
    conditions.push(eq(attendance.eventId, eventId));
  } else if (role === 'family_view') {
    conditions.push(inArray(attendance.eventId, allowedEventIds));
  }

  if (guestId) {
    conditions.push(eq(attendance.guestId, guestId));
  }

  if (rsvpStatus) {
    conditions.push(eq(attendance.rsvpStatus, rsvpStatus));
  }

  const rows = await txDb
    .select()
    .from(attendance)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  if (role === 'family_view') {
    return rows.map(mapToFamilyDto);
  }
  return rows.map(mapToOwnerDto);
}

/**
 * Gets attendance record for a specific guest and event.
 */
export async function getAttendance(
  txDb: TxDb,
  guestId: string,
  eventId: string,
  role: 'owner' | 'family_view' = 'owner',
  allowedEventIds: string[] = []
): Promise<AttendanceOwnerDto | AttendanceFamilyDto | null> {
  if (role === 'family_view' && !allowedEventIds.includes(eventId)) {
    return null;
  }

  const [row] = await txDb
    .select()
    .from(attendance)
    .where(and(eq(attendance.guestId, guestId), eq(attendance.eventId, eventId)));

  if (!row) return null;

  if (role === 'family_view') {
    return mapToFamilyDto(row);
  }
  return mapToOwnerDto(row);
}

/**
 * Updates attendance RSVP, seat, and meal requirements.
 *
 * CRITICAL DOMAIN INVARIANT (AT10):
 * Safe Table Unseating:
 * When RSVP status transitions to 'declined':
 * 1. Automatically force `needs_seat = false` and `needs_meal = false`.
 * 2. Record an audit log entry with action 'UNASSIGN_SEAT_ON_DECLINE' in the same transaction.
 * 3. Preserve relational integrity and free up seat/meal allocation immediately.
 */
export async function updateAttendance(
  txDb: TxDb,
  guestId: string,
  eventId: string,
  input: UpdateAttendanceInput,
  updaterUserId: string
): Promise<AttendanceOwnerDto> {
  const [existing] = await txDb
    .select()
    .from(attendance)
    .where(and(eq(attendance.guestId, guestId), eq(attendance.eventId, eventId)));

  if (!existing) {
    throw new Error('Bản ghi tham dự không tồn tại cho khách mời và buổi tiệc này');
  }

  const isTransitionToDeclined = input.rsvp_status === 'declined';
  const effectiveNeedsSeat = isTransitionToDeclined ? false : input.needs_seat;
  const effectiveNeedsMeal = isTransitionToDeclined ? false : input.needs_meal;

  const [updated] = await txDb
    .update(attendance)
    .set({
      rsvpStatus: input.rsvp_status,
      contactNotes: input.contact_notes?.trim() || null,
      nextFollowupDate: input.next_followup_date ? input.next_followup_date : null,
      needsSeat: effectiveNeedsSeat,
      needsMeal: effectiveNeedsMeal,
      mealDietaryTier: input.meal_dietary_tier,
      dietaryNotes: input.dietary_notes?.trim() || null,
      accommodationNeeded: input.accommodation_needed,
      transportNeeded: input.transport_needed,
      version: input.version + 1,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(attendance.guestId, guestId),
        eq(attendance.eventId, eventId),
        eq(attendance.version, input.version)
      )
    )
    .returning();

  if (!updated) {
    throw new Error('Dữ liệu đã bị thay đổi bởi người khác, vui lòng làm mới trang');
  }

  // Safe table unseating audit trail (AT10)
  if (isTransitionToDeclined && (existing.needsSeat || existing.rsvpStatus === 'accepted')) {
    await txDb.insert(auditLogs).values({
      userId: updaterUserId,
      action: 'UNASSIGN_SEAT_ON_DECLINE',
      entityType: 'attendance',
      entityId: existing.id,
      beforeState: existing,
      afterState: updated,
    });
  }

  return mapToOwnerDto(updated);
}

/**
 * Computes event headcount and meal breakdown summary (AT06, AT07).
 */
export async function getEventHeadcountSummary(
  txDb: TxDb,
  eventId: string
): Promise<EventHeadcountSummaryDto> {
  const attRows = await txDb
    .select({
      id: attendance.id,
      guestId: attendance.guestId,
      eventId: attendance.eventId,
      rsvpStatus: attendance.rsvpStatus,
      needsSeat: attendance.needsSeat,
      needsMeal: attendance.needsMeal,
      mealDietaryTier: attendance.mealDietaryTier,
      dietaryNotes: attendance.dietaryNotes,
    })
    .from(attendance)
    .where(eq(attendance.eventId, eventId));

  if (attRows.length === 0) {
    return {
      event_id: eventId,
      total_invited: 0,
      confirmed_guests: 0,
      uncertain_guests: 0,
      declined_guests: 0,
      confirmed_seats: 0,
      meals_total: 0,
      meals_regular: 0,
      meals_vegetarian: 0,
      meals_child: 0,
      babies_count: 0,
    };
  }

  const guestIds = attRows.map((a) => a.guestId);
  const guestRows = await txDb
    .select({
      id: guests.id,
      ageTier: guests.ageTier,
      isArchived: guests.isArchived,
    })
    .from(guests)
    .where(inArray(guests.id, guestIds));

  const guestsMap: Record<string, { id: string; ageTier: 'adult' | 'child' | 'baby'; isArchived: boolean }> = {};
  for (const g of guestRows) {
    guestsMap[g.id] = g;
  }

  return computeEventHeadcountBreakdown(eventId, attRows, guestsMap);
}
