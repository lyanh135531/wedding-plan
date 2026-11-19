import { eq, and, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@/db/schema';
import { accommodations, roomAssignments } from '@/db/schema';
import {
  CreateAccommodationInput,
  UpdateAccommodationInput,
  AccommodationDto,
  AssignRoomInput,
  RoomAssignmentDto,
  accommodationDtoSchema,
  roomAssignmentDtoSchema,
} from '@/schemas/logistics';
import {
  AccommodationNotFoundError,
  RoomAssignmentNotFoundError,
  OptimisticLockError,
  CapacityExceededError,
  InvalidCapacityReductionError,
} from './errors';

import { TxDb } from './types';

export function mapToAccommodationDto(
  row: typeof accommodations.$inferSelect
): AccommodationDto {
  return accommodationDtoSchema.parse({
    id: row.id,
    eventId: row.eventId,
    name: row.name,
    locationAddress: row.locationAddress ?? null,
    checkInTime: row.checkInTime ? (row.checkInTime instanceof Date ? row.checkInTime.toISOString() : String(row.checkInTime)) : null,
    checkOutTime: row.checkOutTime ? (row.checkOutTime instanceof Date ? row.checkOutTime.toISOString() : String(row.checkOutTime)) : null,
    totalRooms: row.totalRooms,
    contactPhone: row.contactPhone ?? null,
    notes: row.notes ?? null,
    version: row.version,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  });
}

export function mapToRoomAssignmentDto(
  row: typeof roomAssignments.$inferSelect
): RoomAssignmentDto {
  return roomAssignmentDtoSchema.parse({
    id: row.id,
    accommodationId: row.accommodationId,
    eventId: row.eventId,
    roomNumber: row.roomNumber,
    guestId: row.guestId,
    checkInDate: row.checkInDate ? String(row.checkInDate) : null,
    checkOutDate: row.checkOutDate ? String(row.checkOutDate) : null,
    notes: row.notes ?? null,
    version: row.version,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  });
}

export async function createAccommodation(
  txDb: TxDb,
  input: CreateAccommodationInput
): Promise<AccommodationDto> {
  const [created] = await txDb
    .insert(accommodations)
    .values({
      eventId: input.eventId,
      name: input.name,
      locationAddress: input.locationAddress ?? null,
      checkInTime: input.checkInTime ? new Date(input.checkInTime) : null,
      checkOutTime: input.checkOutTime ? new Date(input.checkOutTime) : null,
      totalRooms: input.totalRooms ?? 1,
      contactPhone: input.contactPhone ?? null,
      notes: input.notes ?? null,
      version: 1,
    })
    .returning();

  return mapToAccommodationDto(created);
}

export async function getAccommodationById(
  txDb: TxDb,
  id: string
): Promise<AccommodationDto | null> {
  const [row] = await txDb
    .select()
    .from(accommodations)
    .where(eq(accommodations.id, id));

  if (!row) return null;
  return mapToAccommodationDto(row);
}

export async function listAccommodationsByEvent(
  txDb: TxDb,
  eventId: string
): Promise<AccommodationDto[]> {
  const rows = await txDb
    .select()
    .from(accommodations)
    .where(eq(accommodations.eventId, eventId))
    .orderBy(accommodations.name);

  return rows.map(mapToAccommodationDto);
}

export async function updateAccommodation(
  txDb: TxDb,
  id: string,
  input: UpdateAccommodationInput
): Promise<AccommodationDto> {
  const [existing] = await txDb
    .select()
    .from(accommodations)
    .where(eq(accommodations.id, id))
    .for('update');

  if (!existing) {
    throw new AccommodationNotFoundError();
  }

  if (input.version !== undefined && existing.version !== input.version) {
    throw new OptimisticLockError(
      'Dữ liệu lưu trú đã bị thay đổi bởi người dùng khác. Vui lòng tải lại trang.',
      existing.version
    );
  }

  const updateData: Partial<typeof accommodations.$inferInsert> = {
    version: existing.version + 1,
    updatedAt: new Date(),
  };

  if (input.totalRooms !== undefined) {
    const assigned = await txDb.select().from(roomAssignments).where(eq(roomAssignments.accommodationId, id));
    const used = new Set(assigned.map(r => r.roomNumber)).size;
    if (input.totalRooms < used) throw new InvalidCapacityReductionError('Không thể giảm số phòng dưới số phòng đã phân.', used, input.totalRooms);
  }

  if (input.name !== undefined) updateData.name = input.name;
  if (input.locationAddress !== undefined) updateData.locationAddress = input.locationAddress;
  if (input.checkInTime !== undefined) updateData.checkInTime = input.checkInTime ? new Date(input.checkInTime) : null;
  if (input.checkOutTime !== undefined) updateData.checkOutTime = input.checkOutTime ? new Date(input.checkOutTime) : null;
  if (input.totalRooms !== undefined) updateData.totalRooms = input.totalRooms;
  if (input.contactPhone !== undefined) updateData.contactPhone = input.contactPhone;
  if (input.notes !== undefined) updateData.notes = input.notes;

  const [updated] = await txDb
    .update(accommodations)
    .set(updateData)
    .where(eq(accommodations.id, id))
    .returning();

  return mapToAccommodationDto(updated);
}

export async function deleteAccommodation(
  txDb: TxDb,
  id: string
): Promise<boolean> {
  const [deleted] = await txDb
    .delete(accommodations)
    .where(eq(accommodations.id, id))
    .returning();

  return !!deleted;
}

export async function assignRoom(
  txDb: TxDb,
  input: AssignRoomInput
): Promise<RoomAssignmentDto> {
  const [accommodation] = await txDb
    .select()
    .from(accommodations)
    .where(eq(accommodations.id, input.accommodationId)).for('update');

  if (!accommodation) {
    throw new AccommodationNotFoundError();
  }
  if (accommodation.eventId !== input.eventId) throw new AccommodationNotFoundError();
  const current = await txDb.select().from(roomAssignments).where(eq(roomAssignments.accommodationId, input.accommodationId));
  const same = current.find(r => r.guestId === input.guestId);
  if (same) {
    if (same.roomNumber === input.roomNumber) return mapToRoomAssignmentDto(same);
    throw new CapacityExceededError('Khách đã được phân phòng tại đây. Gỡ phân phòng cũ trước khi đổi.');
  }
  const rooms = new Set(current.map(r => r.roomNumber));
  if (!rooms.has(input.roomNumber) && rooms.size >= accommodation.totalRooms) throw new CapacityExceededError('Nơi lưu trú đã hết phòng.');
  if (input.checkInDate && input.checkOutDate && input.checkOutDate < input.checkInDate) throw new CapacityExceededError('Ngày trả phòng phải sau ngày nhận phòng.');

  const [created] = await txDb
    .insert(roomAssignments)
    .values({
      accommodationId: input.accommodationId,
      eventId: input.eventId,
      roomNumber: input.roomNumber,
      guestId: input.guestId,
      checkInDate: input.checkInDate ?? null,
      checkOutDate: input.checkOutDate ?? null,
      notes: input.notes ?? null,
      version: 1,
    })
    .returning();

  return mapToRoomAssignmentDto(created);
}

export async function unassignRoom(
  txDb: TxDb,
  assignmentId: string
): Promise<boolean> {
  const [deleted] = await txDb
    .delete(roomAssignments)
    .where(eq(roomAssignments.id, assignmentId))
    .returning();

  return !!deleted;
}

export async function listRoomAssignments(
  txDb: TxDb,
  accommodationId: string
): Promise<RoomAssignmentDto[]> {
  const rows = await txDb
    .select()
    .from(roomAssignments)
    .where(eq(roomAssignments.accommodationId, accommodationId))
    .orderBy(roomAssignments.roomNumber);

  return rows.map(mapToRoomAssignmentDto);
}

export async function checkRoomAvailability(
  txDb: TxDb,
  accommodationId: string,
  roomNumber: string,
  checkInDate?: string,
  checkOutDate?: string
): Promise<{ isAvailable: boolean; currentOccupants: number }> {
  const query = txDb
    .select()
    .from(roomAssignments)
    .where(
      and(
        eq(roomAssignments.accommodationId, accommodationId),
        eq(roomAssignments.roomNumber, roomNumber)
      )
    );

  const rows = await query;
  return {
    isAvailable: rows.length === 0,
    currentOccupants: rows.length,
  };
}
