import { eq, and } from 'drizzle-orm';
import { attendance, guests } from '@/db/schema/guests';
import { events } from '@/db/schema/events';
import { tables, seatAssignments } from '@/db/schema/seating';
import { normalizeSearchTerm, normalizeVietnamesePhone } from '@/lib/guests/search';
import { AttendanceCheckInDto } from '@/schemas/attendance';
import { TxDb } from './types';
import { AttendanceNotFoundError, TableCapacityExceededError } from './errors';

export async function getEventCheckInStatus(db: TxDb, eventId: string): Promise<boolean> {
  const [event] = await db
    .select({ isCheckInEnabled: events.isCheckInEnabled })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  return event ? Boolean(event.isCheckInEnabled) : true;
}

export async function setEventCheckInStatus(db: TxDb, eventId: string, isEnabled: boolean): Promise<void> {
  await db
    .update(events)
    .set({ isCheckInEnabled: isEnabled, updatedAt: new Date() })
    .where(eq(events.id, eventId));
}

export async function getAttendanceRecord(db: TxDb, eventId: string, guestId: string): Promise<any | null> {
  const [record] = await db
    .select()
    .from(attendance)
    .where(and(eq(attendance.eventId, eventId), eq(attendance.guestId, guestId)))
    .limit(1);

  return record || null;
}

export async function getSeatingInfoForGuest(
  db: TxDb,
  eventId: string,
  guestId: string
): Promise<{ tableName: string | null; tableNumber: number | null; seatNumber: number | null }> {
  const [seat] = await db
    .select({
      tableName: tables.name,
      tableNumberStr: tables.tableNumber,
      seatNumber: seatAssignments.seatNumber,
    })
    .from(seatAssignments)
    .innerJoin(tables, eq(seatAssignments.tableId, tables.id))
    .where(and(eq(seatAssignments.eventId, eventId), eq(seatAssignments.guestId, guestId)))
    .limit(1);

  if (!seat) {
    return { tableName: null, tableNumber: null, seatNumber: null };
  }

  const tableNum = seat.tableNumberStr ? parseInt(seat.tableNumberStr, 10) : null;
  return {
    tableName: seat.tableName,
    tableNumber: Number.isNaN(tableNum) ? null : tableNum,
    seatNumber: seat.seatNumber ?? null,
  };
}

export async function updateAttendanceCheckIn(
  db: TxDb,
  eventId: string,
  guestId: string,
  data: {
    isCheckedIn: boolean;
    checkInTime: Date | null;
    checkedInByUserId?: string | null;
    checkInNotes?: string | null;
  }
): Promise<AttendanceCheckInDto> {
  const existing = await getAttendanceRecord(db, eventId, guestId);
  if (!existing) {
    throw new AttendanceNotFoundError();
  }

  const [updated] = await db
    .update(attendance)
    .set({
      isCheckedIn: data.isCheckedIn,
      checkInTime: data.checkInTime,
      checkedInByUserId: data.checkedInByUserId !== undefined ? data.checkedInByUserId : existing.checkedInByUserId,
      checkInNotes: data.checkInNotes !== undefined ? data.checkInNotes : existing.checkInNotes,
      version: existing.version + 1,
      updatedAt: new Date(),
    })
    .where(and(eq(attendance.eventId, eventId), eq(attendance.guestId, guestId)))
    .returning();

  const [guest] = await db
    .select()
    .from(guests)
    .where(eq(guests.id, guestId))
    .limit(1);

  const seating = await getSeatingInfoForGuest(db, eventId, guestId);

  return {
    guestId: updated.guestId,
    eventId: updated.eventId,
    fullName: guest ? guest.fullName : '',
    phone: guest ? guest.phone : null,
    rsvpStatus: updated.rsvpStatus,
    isCheckedIn: updated.isCheckedIn,
    checkInTime: updated.checkInTime ? new Date(updated.checkInTime).toISOString() : null,
    checkedInByUserId: updated.checkedInByUserId ?? null,
    checkInNotes: updated.checkInNotes ?? null,
    isOriginOnsite: updated.isOriginOnsite,
    tableName: seating.tableName,
    tableNumber: seating.tableNumber,
    seatNumber: seating.seatNumber,
  };
}

export async function createWalkInGuestRecord(
  db: TxDb,
  eventId: string,
  data: {
    groupId?: string | null;
    fullName: string;
    phone?: string | null;
    relationship?: string | null;
    tableId?: string | null;
    needsSeat?: boolean;
    needsMeal?: boolean;
    dietaryTier?: any;
    checkInNotes?: string | null;
    userId?: string | null;
  }
): Promise<AttendanceCheckInDto> {
  // Check table capacity if tableId is specified
  if (data.tableId) {
    const [targetTable] = await db
      .select()
      .from(tables)
      .where(eq(tables.id, data.tableId))
      .limit(1);

    if (targetTable) {
      const currentAssigned = await db
        .select()
        .from(seatAssignments)
        .where(eq(seatAssignments.tableId, data.tableId));

      if (currentAssigned.length >= targetTable.capacity) {
        throw new TableCapacityExceededError(targetTable.name, targetTable.capacity);
      }
    }
  }

  // Create guest record with isOriginOnsite: true
  const [createdGuest] = await db
    .insert(guests)
    .values({
      groupId: data.groupId ?? null,
      fullName: data.fullName,
      phone: data.phone ?? null,
      relationship: data.relationship ?? null,
      isOriginOnsite: true,
      version: 1,
    })
    .returning();

  // Create attendance record
  const checkInTime = new Date();
  const [createdAttendance] = await db
    .insert(attendance)
    .values({
      guestId: createdGuest.id,
      eventId,
      rsvpStatus: 'accepted',
      needsSeat: data.needsSeat ?? true,
      needsMeal: data.needsMeal ?? true,
      mealDietaryTier: data.dietaryTier ?? 'regular',
      isOriginOnsite: true,
      isCheckedIn: true,
      checkInTime,
      checkedInByUserId: data.userId ?? null,
      checkInNotes: data.checkInNotes ?? null,
      version: 1,
    })
    .returning();

  let tableName: string | null = null;
  let tableNumber: number | null = null;
  let seatNumber: number | null = null;

  if (data.tableId) {
    const [assignedSeat] = await db
      .insert(seatAssignments)
      .values({
        eventId,
        tableId: data.tableId,
        guestId: createdGuest.id,
        seatNumber: null,
        version: 1,
      })
      .returning();

    const seating = await getSeatingInfoForGuest(db, eventId, createdGuest.id);
    tableName = seating.tableName;
    tableNumber = seating.tableNumber;
    seatNumber = seating.seatNumber;
  }

  return {
    guestId: createdGuest.id,
    eventId,
    fullName: createdGuest.fullName,
    phone: createdGuest.phone,
    rsvpStatus: createdAttendance.rsvpStatus,
    isCheckedIn: createdAttendance.isCheckedIn,
    checkInTime: checkInTime.toISOString(),
    checkedInByUserId: createdAttendance.checkedInByUserId ?? null,
    checkInNotes: createdAttendance.checkInNotes ?? null,
    isOriginOnsite: true,
    tableName,
    tableNumber,
    seatNumber,
  };
}

export async function searchAttendanceGuests(
  db: TxDb,
  eventId: string,
  query: string
): Promise<AttendanceCheckInDto[]> {
  const normalizedQuery = normalizeSearchTerm(query);
  const normalizedPhone = normalizeVietnamesePhone(query);

  const records = await db
    .select({
      attendance: attendance,
      guest: guests,
    })
    .from(attendance)
    .innerJoin(guests, eq(attendance.guestId, guests.id))
    .where(eq(attendance.eventId, eventId));

  const results: AttendanceCheckInDto[] = [];

  for (const row of records) {
    const guest = row.guest;
    const att = row.attendance;

    const normName = normalizeSearchTerm(guest.fullName);
    const guestPhone = guest.phone ? normalizeVietnamesePhone(guest.phone) : null;

    let matched = false;
    if (!normalizedQuery) {
      matched = true;
    } else {
      const digitsQuery = query.replace(/\D/g, '');
      if (normName.includes(normalizedQuery)) {
        matched = true;
      } else if (normalizedPhone && guestPhone && guestPhone.includes(normalizedPhone)) {
        matched = true;
      } else if (digitsQuery.length >= 3 && guest.phone && guest.phone.replace(/\D/g, '').includes(digitsQuery)) {
        matched = true;
      }
    }

    if (matched) {
      const seating = await getSeatingInfoForGuest(db, eventId, guest.id);
      results.push({
        guestId: guest.id,
        eventId: att.eventId,
        fullName: guest.fullName,
        phone: guest.phone,
        rsvpStatus: att.rsvpStatus,
        isCheckedIn: att.isCheckedIn,
        checkInTime: att.checkInTime ? new Date(att.checkInTime).toISOString() : null,
        checkedInByUserId: att.checkedInByUserId ?? null,
        checkInNotes: att.checkInNotes ?? null,
        isOriginOnsite: att.isOriginOnsite,
        tableName: seating.tableName,
        tableNumber: seating.tableNumber,
        seatNumber: seating.seatNumber,
      });
    }
  }

  return results;
}

export async function getCheckInSummary(
  db: TxDb,
  eventId: string
): Promise<{
  totalGuests: number;
  checkedInCount: number;
  notCheckedInCount: number;
  rsvpAcceptedCount: number;
  walkInCount: number;
}> {
  const records = await db
    .select()
    .from(attendance)
    .where(eq(attendance.eventId, eventId));

  let totalGuests = 0;
  let checkedInCount = 0;
  let notCheckedInCount = 0;
  let rsvpAcceptedCount = 0;
  let walkInCount = 0;

  for (const r of records) {
    totalGuests++;
    if (r.isCheckedIn) {
      checkedInCount++;
    } else {
      notCheckedInCount++;
    }
    if (r.rsvpStatus === 'accepted') {
      rsvpAcceptedCount++;
    }
    if (r.isOriginOnsite) {
      walkInCount++;
    }
  }

  return {
    totalGuests,
    checkedInCount,
    notCheckedInCount,
    rsvpAcceptedCount,
    walkInCount,
  };
}
