import { eq, and, inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@/db/schema';
import { tables, seatAssignments, attendance, guests, auditLogs } from '@/db/schema';
import { TableDto, SeatAssignmentDto } from '@/schemas/seating';
import {
  CapacityExceededError,
  InvalidCapacityReductionError,
  OptimisticLockError,
  TableNotFoundError,
} from './errors';
import {
  getTableById,
  updateTable,
  listTablesByEvent,
  mapToTableDto,
} from './tables.repository';
import {
  assignSeat,
  unassignSeat,
  getTableAssignments,
  getGuestSeatAssignment,
  listSeatAssignmentsByEvent,
} from './seats.repository';

import { TxDb } from './types';

export interface SeatingChartExportItem {
  id: string;
  name: string;
  tableNumber: string | null;
  shape: string;
  capacity: number;
  notes: string | null;
  assignedCount: number;
  occupyingCount: number;
  guests: Array<{
    guestId: string;
    displayName: string;
    seatNumber: number | null;
    isOccupyingSeat: boolean;
    dietaryNotes: string | null;
    phone?: string | null;
    email?: string | null;
    privateNotes?: string | null;
  }>;
}

export interface SeatingChartExport {
  eventId: string;
  exportedAt: string;
  role: 'owner' | 'family_view';
  totalTables: number;
  totalCapacity: number;
  totalOccupiedSeats: number;
  tables: SeatingChartExportItem[];
}

/**
 * Checks whether a guest occupies a table seat (AT07).
 * Guests with attendance.needsSeat === false or guests.ageTier === 'baby' do NOT consume a seat.
 */
export async function isGuestConsumingSeat(
  txDb: TxDb,
  eventId: string,
  guestId: string
): Promise<boolean> {
  const [att] = await txDb
    .select({ needsSeat: attendance.needsSeat })
    .from(attendance)
    .where(and(eq(attendance.eventId, eventId), eq(attendance.guestId, guestId)));

  if (att && att.needsSeat === false) {
    return false;
  }

  const [g] = await txDb
    .select({ ageTier: guests.ageTier })
    .from(guests)
    .where(eq(guests.id, guestId));

  if (g && g.ageTier === 'baby') {
    return false;
  }

  return true;
}

/**
 * Counts the number of seat-consuming guests currently assigned to a table.
 */
export async function countOccupyingSeats(
  txDb: TxDb,
  eventId: string,
  tableId: string,
  excludeGuestId?: string
): Promise<number> {
  const assignments = await txDb
    .select({ guestId: seatAssignments.guestId })
    .from(seatAssignments)
    .where(eq(seatAssignments.tableId, tableId));

  const guestIds = assignments
    .map((a) => a.guestId)
    .filter((id) => (excludeGuestId ? id !== excludeGuestId : true));

  if (guestIds.length === 0) return 0;

  // Fetch attendance records for needsSeat
  const attRows = await txDb
    .select({ guestId: attendance.guestId, needsSeat: attendance.needsSeat })
    .from(attendance)
    .where(and(eq(attendance.eventId, eventId), inArray(attendance.guestId, guestIds)));

  const attMap = new Map(attRows.map((r) => [r.guestId, r.needsSeat]));

  // Fetch guests records for ageTier
  const guestRows = await txDb
    .select({ id: guests.id, ageTier: guests.ageTier })
    .from(guests)
    .where(inArray(guests.id, guestIds));

  const guestMap = new Map(guestRows.map((r) => [r.id, r.ageTier]));

  let consumingCount = 0;
  for (const gid of guestIds) {
    const needsSeat = attMap.get(gid);
    const ageTier = guestMap.get(gid);

    if (needsSeat === false || ageTier === 'baby') {
      continue;
    }
    consumingCount++;
  }

  return consumingCount;
}

/**
 * AT21 & AT07: Assign guest to table with pessimistic row locking (.for('update'))
 * and infant/child non-seat policy.
 */
export async function assignGuestToTable(
  txDb: TxDb,
  eventId: string,
  tableId: string,
  guestId: string,
  options?: { seatNumber?: number; notes?: string; version?: number }
): Promise<SeatAssignmentDto> {
  // Pessimistic row locking on table
  const [table] = await txDb
    .select()
    .from(tables)
    .where(eq(tables.id, tableId))
    .for('update');

  if (!table || table.eventId !== eventId) {
    throw new TableNotFoundError();
  }

  if (options?.version !== undefined && table.version !== options.version) {
    throw new OptimisticLockError(
      'Dữ liệu bàn đã bị thay đổi bởi người dùng khác. Vui lòng tải lại trang.',
      table.version
    );
  }

  const incomingNeedsSeat = await isGuestConsumingSeat(txDb, eventId, guestId);
  const occupiedSeats = await countOccupyingSeats(txDb, eventId, tableId, guestId);

  // Strict capacity check: if guest needs a seat and table is full, throw CapacityExceededError
  if (incomingNeedsSeat && occupiedSeats >= table.capacity) {
    throw new CapacityExceededError(
      `Bàn "${table.name}" đã hết chỗ (${occupiedSeats}/${table.capacity} ghế). Không thể xếp thêm khách.`,
      {
        tableId,
        capacity: table.capacity,
        currentOccupied: occupiedSeats,
      }
    );
  }

  return assignSeat(txDb, {
    eventId,
    tableId,
    guestId,
    seatNumber: options?.seatNumber,
    notes: options?.notes,
  });
}

/**
 * Unassigns a guest from any table in the event.
 */
export async function unassignGuest(
  txDb: TxDb,
  eventId: string,
  guestId: string,
  actorId?: string
): Promise<boolean> {
  const existing = await getGuestSeatAssignment(txDb, eventId, guestId);
  if (!existing) return false;

  const result = await unassignSeat(txDb, eventId, guestId);
  if (result && actorId) {
    await txDb.insert(auditLogs).values({
      userId: actorId,
      action: 'UNASSIGN_SEAT',
      entityType: 'table_assignment',
      entityId: guestId,
      beforeState: { tableId: existing.tableId, seatNumber: existing.seatNumber },
      afterState: null,
    });
  }
  return result;
}

/**
 * AT10: Safe Table Unseating on RSVP Decline.
 * When guest status changes to 'declined', auto-unseat guest and log audit trail.
 */
export async function handleAttendanceChange(
  txDb: TxDb,
  eventId: string,
  guestId: string,
  status: string,
  actorId?: string
): Promise<{ unseated: boolean; tableId?: string }> {
  if (status !== 'declined') {
    return { unseated: false };
  }

  const existingAssignment = await getGuestSeatAssignment(txDb, eventId, guestId);
  if (!existingAssignment) {
    return { unseated: false };
  }

  // Delete seat assignment
  await unassignSeat(txDb, eventId, guestId);

  // Force attendance flags
  await txDb
    .update(attendance)
    .set({
      needsSeat: false,
      needsMeal: false,
      updatedAt: new Date(),
    })
    .where(and(eq(attendance.eventId, eventId), eq(attendance.guestId, guestId)));

  // Record audit log
  await txDb.insert(auditLogs).values({
    userId: actorId || 'system',
    action: 'seat_unassigned_rsvp_decline',
    entityType: 'table_assignment',
    entityId: guestId,
    beforeState: {
      tableId: existingAssignment.tableId,
      seatNumber: existingAssignment.seatNumber,
    },
    afterState: null,
  });

  return {
    unseated: true,
    tableId: existingAssignment.tableId,
  };
}

/**
 * AT22: Table Capacity Reduction Guard.
 * Reject reducing capacity below currently assigned seat-consuming guests.
 */
export async function updateTableCapacity(
  txDb: TxDb,
  eventId: string,
  tableId: string,
  newCapacity: number,
  version?: number
): Promise<TableDto> {
  // Pessimistic lock
  const [table] = await txDb
    .select()
    .from(tables)
    .where(eq(tables.id, tableId))
    .for('update');

  if (!table || table.eventId !== eventId) {
    throw new TableNotFoundError();
  }

  if (version !== undefined && table.version !== version) {
    throw new OptimisticLockError(
      'Dữ liệu bàn đã bị thay đổi bởi người dùng khác. Vui lòng tải lại trang.',
      table.version
    );
  }

  if (newCapacity <= 0) {
    throw new Error('Sức chứa bàn phải lớn hơn 0');
  }

  const occupyingSeats = await countOccupyingSeats(txDb, eventId, tableId);

  if (newCapacity < occupyingSeats) {
    throw new InvalidCapacityReductionError(
      `Không thể giảm sức chứa dưới số khách đã xếp (${occupyingSeats} khách đang ngồi bàn)`,
      occupyingSeats,
      newCapacity
    );
  }

  return updateTable(txDb, tableId, {
    capacity: newCapacity,
    version: table.version,
  });
}

/**
 * AT26: Export A4 Seating Chart with role sanitization.
 * When role is 'family_view', all private notes, contact info, and sensitive data are redacted.
 */
export async function exportSeatingChartA4(
  txDb: TxDb,
  eventId: string,
  role: 'owner' | 'family_view' = 'owner'
): Promise<SeatingChartExport> {
  const tableRows = await txDb
    .select()
    .from(tables)
    .where(eq(tables.eventId, eventId))
    .orderBy(tables.name);

  const assignments = await txDb
    .select()
    .from(seatAssignments)
    .where(eq(seatAssignments.eventId, eventId));

  const guestIds = assignments.map((a) => a.guestId);

  let guestMap = new Map<string, typeof guests.$inferSelect>();
  let attMap = new Map<string, typeof attendance.$inferSelect>();

  if (guestIds.length > 0) {
    const gRows = await txDb
      .select()
      .from(guests)
      .where(inArray(guests.id, guestIds));
    guestMap = new Map(gRows.map((g) => [g.id, g]));

    const aRows = await txDb
      .select()
      .from(attendance)
      .where(and(eq(attendance.eventId, eventId), inArray(attendance.guestId, guestIds)));
    attMap = new Map(aRows.map((a) => [a.guestId, a]));
  }

  let totalCapacity = 0;
  let totalOccupiedSeats = 0;

  const exportTables: SeatingChartExportItem[] = [];

  for (const t of tableRows) {
    totalCapacity += t.capacity;
    const tableAssignments = assignments.filter((a) => a.tableId === t.id);

    let occupyingCount = 0;
    const assignedGuestsList = tableAssignments.map((a) => {
      const g = guestMap.get(a.guestId);
      const att = attMap.get(a.guestId);

      const isBaby = g?.ageTier === 'baby';
      const needsSeat = att ? att.needsSeat : true;
      const isOccupying = !isBaby && needsSeat;

      if (isOccupying) {
        occupyingCount++;
        totalOccupiedSeats++;
      }

      if (role === 'family_view') {
        return {
          guestId: a.guestId,
          displayName: g ? g.displayName : 'Khách mời',
          seatNumber: a.seatNumber,
          isOccupyingSeat: isOccupying,
          dietaryNotes: att?.dietaryNotes ?? null,
          phone: null,
          email: null,
          privateNotes: null,
        };
      }

      return {
        guestId: a.guestId,
        displayName: g ? g.displayName : 'Khách mời',
        seatNumber: a.seatNumber,
        isOccupyingSeat: isOccupying,
        dietaryNotes: att?.dietaryNotes ?? null,
        phone: g?.phone ?? null,
        email: g?.email ?? null,
        privateNotes: g?.privateNotes ?? null,
      };
    });

    exportTables.push({
      id: t.id,
      name: t.name,
      tableNumber: t.tableNumber,
      shape: t.shape,
      capacity: t.capacity,
      notes: role === 'family_view' ? null : t.notes, // Redacted for family_view
      assignedCount: tableAssignments.length,
      occupyingCount,
      guests: assignedGuestsList,
    });
  }

  return {
    eventId,
    exportedAt: new Date().toISOString(),
    role,
    totalTables: tableRows.length,
    totalCapacity,
    totalOccupiedSeats,
    tables: exportTables,
  };
}
