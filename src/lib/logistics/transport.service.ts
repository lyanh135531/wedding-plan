import { eq, and } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@/db/schema';
import { transportTrips, tripPassengers } from '@/db/schema';
import {
  CreateTransportTripInput,
  UpdateTransportTripInput,
  TransportTripDto,
  TripPassengerDto,
  transportTripDtoSchema,
  tripPassengerDtoSchema,
} from '@/schemas/logistics';
import {
  TripNotFoundError,
  CapacityExceededError,
  TripCapacityExceededError,
  InvalidCapacityReductionError,
  OptimisticLockError,
} from './errors';

import { TxDb } from './types';

export function mapToTransportTripDto(
  row: typeof transportTrips.$inferSelect
): TransportTripDto {
  return transportTripDtoSchema.parse({
    id: row.id,
    eventId: row.eventId,
    name: row.name,
    vehicleType: row.vehicleType,
    departureTime: row.departureTime ? (row.departureTime instanceof Date ? row.departureTime.toISOString() : String(row.departureTime)) : null,
    departureLocation: row.departureLocation ?? null,
    arrivalLocation: row.arrivalLocation ?? null,
    capacity: row.capacity,
    driverContact: row.driverContact ?? null,
    notes: row.notes ?? null,
    version: row.version,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  });
}

export function mapToTripPassengerDto(
  row: typeof tripPassengers.$inferSelect
): TripPassengerDto {
  return tripPassengerDtoSchema.parse({
    id: row.id,
    tripId: row.tripId,
    eventId: row.eventId,
    guestId: row.guestId,
    pickupPoint: row.pickupPoint ?? null,
    notes: row.notes ?? null,
    version: row.version,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  });
}

export async function createTransportTrip(
  txDb: TxDb,
  input: CreateTransportTripInput
): Promise<TransportTripDto> {
  const [created] = await txDb
    .insert(transportTrips)
    .values({
      eventId: input.eventId,
      name: input.name,
      vehicleType: input.vehicleType ?? 'shuttle_bus',
      departureTime: input.departureTime ? new Date(input.departureTime) : null,
      departureLocation: input.departureLocation ?? null,
      arrivalLocation: input.arrivalLocation ?? null,
      capacity: input.capacity,
      driverContact: input.driverContact ?? null,
      notes: input.notes ?? null,
      version: 1,
    })
    .returning();

  return mapToTransportTripDto(created);
}

export async function getTransportTripById(
  txDb: TxDb,
  id: string,
  forUpdate = false
): Promise<TransportTripDto | null> {
  const query = txDb.select().from(transportTrips).where(eq(transportTrips.id, id));
  if (forUpdate) {
    query.for('update');
  }
  const [row] = await query;
  if (!row) return null;
  return mapToTransportTripDto(row);
}

export async function listTransportTripsByEvent(
  txDb: TxDb,
  eventId: string
): Promise<TransportTripDto[]> {
  const rows = await txDb
    .select()
    .from(transportTrips)
    .where(eq(transportTrips.eventId, eventId))
    .orderBy(transportTrips.departureTime);

  return rows.map(mapToTransportTripDto);
}

export async function updateTransportTrip(
  txDb: TxDb,
  id: string,
  input: UpdateTransportTripInput
): Promise<TransportTripDto> {
  const [existing] = await txDb
    .select()
    .from(transportTrips)
    .where(eq(transportTrips.id, id))
    .for('update');

  if (!existing) {
    throw new TripNotFoundError();
  }

  if (input.version !== undefined && existing.version !== input.version) {
    throw new OptimisticLockError(
      'Dữ liệu chuyến xe đã bị thay đổi bởi người dùng khác. Vui lòng tải lại trang.',
      existing.version
    );
  }

  const updateData: Partial<typeof transportTrips.$inferInsert> = {
    version: existing.version + 1,
    updatedAt: new Date(),
  };

  if (input.name !== undefined) updateData.name = input.name;
  if (input.vehicleType !== undefined) updateData.vehicleType = input.vehicleType;
  if (input.departureTime !== undefined) updateData.departureTime = input.departureTime ? new Date(input.departureTime) : null;
  if (input.departureLocation !== undefined) updateData.departureLocation = input.departureLocation;
  if (input.arrivalLocation !== undefined) updateData.arrivalLocation = input.arrivalLocation;
  if (input.capacity !== undefined) updateData.capacity = input.capacity;
  if (input.driverContact !== undefined) updateData.driverContact = input.driverContact;
  if (input.notes !== undefined) updateData.notes = input.notes;

  const [updated] = await txDb
    .update(transportTrips)
    .set(updateData)
    .where(eq(transportTrips.id, id))
    .returning();

  return mapToTransportTripDto(updated);
}

export async function deleteTransportTrip(
  txDb: TxDb,
  id: string
): Promise<boolean> {
  const [deleted] = await txDb
    .delete(transportTrips)
    .where(eq(transportTrips.id, id))
    .returning();

  return !!deleted;
}

/**
 * Assigns a guest to a transport trip with row-level capacity locking.
 * Throws CapacityExceededError if vehicle capacity is reached.
 */
export async function assignPassenger(
  txDb: TxDb,
  eventId: string,
  tripId: string,
  guestId: string,
  pickupPoint?: string | null,
  notes?: string | null
): Promise<TripPassengerDto> {
  // Pessimistic lock on trip row
  const [trip] = await txDb
    .select()
    .from(transportTrips)
    .where(eq(transportTrips.id, tripId))
    .for('update');

  if (!trip || trip.eventId !== eventId) {
    throw new TripNotFoundError();
  }

  // Count current passengers
  const passengers = await txDb
    .select()
    .from(tripPassengers)
    .where(eq(tripPassengers.tripId, tripId));

  const isAlreadyAssigned = passengers.some((p) => p.guestId === guestId);

  if (!isAlreadyAssigned && passengers.length >= trip.capacity) {
    throw new CapacityExceededError(
      `Chuyến xe "${trip.name}" đã hết chỗ (${passengers.length}/${trip.capacity}). Không thể nhận thêm hành khách.`,
      {
        tripId,
        capacity: trip.capacity,
        currentPassengers: passengers.length,
      }
    );
  }

  const [existingAssignment] = await txDb
    .select()
    .from(tripPassengers)
    .where(and(eq(tripPassengers.tripId, tripId), eq(tripPassengers.guestId, guestId)));

  if (existingAssignment) {
    const [updated] = await txDb
      .update(tripPassengers)
      .set({
        pickupPoint: pickupPoint ?? null,
        notes: notes ?? null,
        version: existingAssignment.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(tripPassengers.id, existingAssignment.id))
      .returning();

    return mapToTripPassengerDto(updated);
  }

  const [created] = await txDb
    .insert(tripPassengers)
    .values({
      tripId,
      eventId,
      guestId,
      pickupPoint: pickupPoint ?? null,
      notes: notes ?? null,
      version: 1,
    })
    .returning();

  return mapToTripPassengerDto(created);
}

export async function unassignPassenger(
  txDb: TxDb,
  tripId: string,
  guestId: string
): Promise<boolean> {
  const [deleted] = await txDb
    .delete(tripPassengers)
    .where(and(eq(tripPassengers.tripId, tripId), eq(tripPassengers.guestId, guestId)))
    .returning();

  return !!deleted;
}

export async function listTripPassengers(
  txDb: TxDb,
  tripId: string
): Promise<TripPassengerDto[]> {
  const rows = await txDb
    .select()
    .from(tripPassengers)
    .where(eq(tripPassengers.tripId, tripId));

  return rows.map(mapToTripPassengerDto);
}

/**
 * AT22: Reject reducing vehicle capacity below currently assigned passengers.
 */
export async function updateTripCapacity(
  txDb: TxDb,
  eventId: string,
  tripId: string,
  newCapacity: number,
  version?: number
): Promise<TransportTripDto> {
  // Pessimistic lock on trip row
  const [trip] = await txDb
    .select()
    .from(transportTrips)
    .where(eq(transportTrips.id, tripId))
    .for('update');

  if (!trip || trip.eventId !== eventId) {
    throw new TripNotFoundError();
  }

  if (version !== undefined && trip.version !== version) {
    throw new OptimisticLockError(
      'Dữ liệu chuyến xe đã bị thay đổi bởi người dùng khác. Vui lòng tải lại trang.',
      trip.version
    );
  }

  if (newCapacity <= 0) {
    throw new Error('Sức chứa xe phải lớn hơn 0');
  }

  const passengers = await txDb
    .select()
    .from(tripPassengers)
    .where(eq(tripPassengers.tripId, tripId));

  if (newCapacity < passengers.length) {
    throw new InvalidCapacityReductionError(
      `Không thể giảm sức chứa dưới số hành khách đã phân bổ (${passengers.length} khách đã gán)`,
      passengers.length,
      newCapacity
    );
  }

  return updateTransportTrip(txDb, tripId, {
    capacity: newCapacity,
    version: trip.version,
  });
}
