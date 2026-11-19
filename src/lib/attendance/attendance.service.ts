import { nullableVietnamesePhoneSchema } from '@/schemas/common';
import { TxDb } from './types';
import {
  CheckInGuestInput,
  UndoCheckInInput,
  WalkInGuestInput,
  AttendanceCheckInDto,
} from '@/schemas/attendance';
import {
  getEventCheckInStatus,
  setEventCheckInStatus,
  getAttendanceRecord,
  updateAttendanceCheckIn,
  createWalkInGuestRecord,
  searchAttendanceGuests,
  getCheckInSummary,
} from './attendance.repository';
import {
  AttendanceNotFoundError,
  CheckInDisabledError,
  DeclinedGuestConfirmationRequiredError,
} from './errors';

export async function toggleCheckIn(
  db: TxDb,
  eventId: string,
  isEnabled: boolean
): Promise<void> {
  await setEventCheckInStatus(db, eventId, isEnabled);
}

export async function isCheckInEnabled(
  db: TxDb,
  eventId: string
): Promise<boolean> {
  return getEventCheckInStatus(db, eventId);
}

/**
 * Checks in a guest for an event.
 * Invariants:
 * - Feature check-in toggle respected.
 * - RSVP accepted != arrived. Checking in sets isCheckedIn = true, but does not alter RSVP history.
 * - If guest previously declined, requires explicit confirmDeclinedOverride confirmation.
 */
export async function checkInGuest(
  db: TxDb,
  input: CheckInGuestInput,
  userId?: string | null
): Promise<AttendanceCheckInDto> {
  const enabled = await getEventCheckInStatus(db, input.eventId);
  if (!enabled) {
    throw new CheckInDisabledError();
  }

  const attendance = await getAttendanceRecord(db, input.eventId, input.guestId);
  if (!attendance) {
    throw new AttendanceNotFoundError();
  }

  if (attendance.rsvpStatus === 'declined' && !input.confirmDeclinedOverride) {
    throw new DeclinedGuestConfirmationRequiredError();
  }

  return updateAttendanceCheckIn(db, input.eventId, input.guestId, {
    isCheckedIn: true,
    checkInTime: new Date(),
    checkedInByUserId: userId ?? null,
    checkInNotes: input.checkInNotes ?? null,
  });
}

/**
 * Undoes a check-in with an audit trail note.
 */
export async function undoCheckIn(
  db: TxDb,
  input: UndoCheckInInput,
  userId?: string | null
): Promise<AttendanceCheckInDto> {
  const attendance = await getAttendanceRecord(db, input.eventId, input.guestId);
  if (!attendance) {
    throw new AttendanceNotFoundError();
  }

  const undoNote = input.undoReason
    ? `[Hoàn tác điểm danh bởi ${userId || 'người dùng'}]: ${input.undoReason}`
    : `[Hoàn tác điểm danh]`;

  const updatedNotes = attendance.checkInNotes
    ? `${attendance.checkInNotes}\n${undoNote}`
    : undoNote;

  return updateAttendanceCheckIn(db, input.eventId, input.guestId, {
    isCheckedIn: false,
    checkInTime: null,
    checkedInByUserId: userId ?? null,
    checkInNotes: updatedNotes,
  });
}

/**
 * Creates an unexpected on-site walk-in guest ("Khách phát sinh tại buổi")
 * and immediately marks them as checked in.
 */
export async function createWalkInGuest(
  db: TxDb,
  input: WalkInGuestInput,
  userId?: string | null
): Promise<AttendanceCheckInDto> {
  if (!(await isCheckInEnabled(db, input.eventId))) throw new CheckInDisabledError();
  return createWalkInGuestRecord(db, input.eventId, {
    groupId: input.groupId,
    fullName: input.fullName,
    phone: nullableVietnamesePhoneSchema.parse(input.phone),
    relationship: input.relationship,
    tableId: input.tableId,
    needsSeat: input.needsSeat,
    needsMeal: input.needsMeal,
    dietaryTier: input.dietaryTier,
    checkInNotes: input.checkInNotes,
    userId,
  });
}

export async function searchGuests(
  db: TxDb,
  eventId: string,
  query: string
): Promise<AttendanceCheckInDto[]> {
  return searchAttendanceGuests(db, eventId, query);
}

export async function getSummary(
  db: TxDb,
  eventId: string
) {
  return getCheckInSummary(db, eventId);
}
