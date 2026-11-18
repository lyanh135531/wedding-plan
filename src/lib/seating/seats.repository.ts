import { eq, and } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@/db/schema';
import { seatAssignments } from '@/db/schema';
import {
  AssignSeatInput,
  SeatAssignmentDto,
  SeatAssignmentFamilyDto,
  seatAssignmentDtoSchema,
  seatAssignmentFamilyDtoSchema,
} from '@/schemas/seating';

import { TxDb } from './types';

export function mapToSeatAssignmentDto(row: typeof seatAssignments.$inferSelect): SeatAssignmentDto {
  return seatAssignmentDtoSchema.parse({
    id: row.id,
    eventId: row.eventId,
    tableId: row.tableId,
    guestId: row.guestId,
    seatNumber: row.seatNumber ?? null,
    notes: row.notes ?? null,
    version: row.version,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  });
}

export function mapToSeatAssignmentFamilyDto(row: typeof seatAssignments.$inferSelect): SeatAssignmentFamilyDto {
  return seatAssignmentFamilyDtoSchema.parse({
    id: row.id,
    eventId: row.eventId,
    tableId: row.tableId,
    guestId: row.guestId,
    seatNumber: row.seatNumber ?? null,
    notes: null,
    version: row.version,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  });
}

export async function assignSeat(
  txDb: TxDb,
  input: AssignSeatInput
): Promise<SeatAssignmentDto> {
  const [existing] = await txDb
    .select()
    .from(seatAssignments)
    .where(
      and(
        eq(seatAssignments.eventId, input.eventId),
        eq(seatAssignments.guestId, input.guestId)
      )
    )
    .for('update');

  if (existing) {
    const [updated] = await txDb
      .update(seatAssignments)
      .set({
        tableId: input.tableId,
        seatNumber: input.seatNumber ?? null,
        notes: input.notes ?? null,
        version: existing.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(seatAssignments.id, existing.id))
      .returning();

    return mapToSeatAssignmentDto(updated);
  }

  const [created] = await txDb
    .insert(seatAssignments)
    .values({
      eventId: input.eventId,
      tableId: input.tableId,
      guestId: input.guestId,
      seatNumber: input.seatNumber ?? null,
      notes: input.notes ?? null,
      version: 1,
    })
    .returning();

  return mapToSeatAssignmentDto(created);
}

export async function unassignSeat(
  txDb: TxDb,
  eventId: string,
  guestId: string,
  expectedTableId?: string
): Promise<boolean> {
  const [deleted] = await txDb
    .delete(seatAssignments)
    .where(
      and(
        eq(seatAssignments.eventId, eventId),
        eq(seatAssignments.guestId, guestId),
        expectedTableId ? eq(seatAssignments.tableId, expectedTableId) : undefined
      )
    )
    .returning();

  return !!deleted;
}

export async function getTableAssignments(
  txDb: TxDb,
  tableId: string
): Promise<SeatAssignmentDto[]> {
  const rows = await txDb
    .select()
    .from(seatAssignments)
    .where(eq(seatAssignments.tableId, tableId))
    .orderBy(seatAssignments.seatNumber);

  return rows.map(mapToSeatAssignmentDto);
}

export async function getGuestSeatAssignment(
  txDb: TxDb,
  eventId: string,
  guestId: string
): Promise<SeatAssignmentDto | null> {
  const [row] = await txDb
    .select()
    .from(seatAssignments)
    .where(
      and(
        eq(seatAssignments.eventId, eventId),
        eq(seatAssignments.guestId, guestId)
      )
    );

  if (!row) return null;
  return mapToSeatAssignmentDto(row);
}

export async function listSeatAssignmentsByEvent(
  txDb: TxDb,
  eventId: string
): Promise<SeatAssignmentDto[]> {
  const rows = await txDb
    .select()
    .from(seatAssignments)
    .where(eq(seatAssignments.eventId, eventId));

  return rows.map(mapToSeatAssignmentDto);
}
