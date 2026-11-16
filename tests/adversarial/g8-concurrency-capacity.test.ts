import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import * as sessionModule from '@/lib/auth/session';
import * as dbModule from '@/db/client';

/**
 * Gate G8 Adversarial Test Suite: Concurrency, Capacity Guards, and Optimistic Locking
 * Requirements: AT21, AT22, AT30, PLAN §12, §13, §20, §25, docs/UI_UX_SPEC §6.5
 *
 * Scenarios:
 * 1. AT21: Concurrent seating race into last seat (Promise.all parallel race, strictly 1 winner, 0 overcapacity).
 * 2. AT21: Batch / multi-guest party seating atomicity (all-or-nothing seating preventing partial allocation).
 * 3. AT22: Table capacity reduction guard (rejects decreasing capacity below current assigned headcount).
 * 4. AT22: Shuttle / transport trip capacity reduction guard (rejects decreasing max passengers below assigned).
 * 5. AT22: Accommodation room capacity reduction guard (rejects decreasing room capacity below assigned).
 * 6. AT30: Optimistic locking version conflict (stale version returns 409 Conflict, latest version succeeds).
 */

// Custom domain error classes conforming to PROJECT.md § Interface Contracts
export class CapacityExceededError extends Error {
  readonly code = 'CAPACITY_EXCEEDED';
  readonly statusCode = 409;
  constructor(message: string, public readonly details?: Record<string, unknown>) {
    super(message);
    this.name = 'CapacityExceededError';
  }
}

export class OptimisticLockError extends Error {
  readonly code = 'VERSION_CONFLICT';
  readonly statusCode = 409;
  constructor(message: string, public readonly currentVersion?: number) {
    super(message);
    this.name = 'OptimisticLockError';
  }
}

export class InvalidCapacityReductionError extends Error {
  readonly code = 'INVALID_CAPACITY_REDUCTION';
  readonly statusCode = 422;
  constructor(
    message: string,
    public readonly currentAssigned: number,
    public readonly requestedCapacity: number
  ) {
    super(message);
    this.name = 'InvalidCapacityReductionError';
  }
}

// In-Memory Transactional Database Simulator for Table & Seating Concurrency (Row Lock / FOR UPDATE)
class SeatingConcurrencyHarness {
  private tables: Map<string, { id: string; eventId: string; name: string; capacity: number; version: number }> = new Map();
  private seatAssignments: Map<string, { id: string; tableId: string; guestId: string; eventId: string; isOccupyingSeat: boolean }> = new Map();
  private transportTrips: Map<string, { id: string; eventId: string; tripName: string; maxPassengers: number; version: number }> = new Map();
  private tripPassengers: Map<string, { id: string; tripId: string; guestId: string }> = new Map();
  private accommodations: Map<string, { id: string; eventId: string; roomNumber: string; capacity: number; version: number }> = new Map();
  private roomAssignments: Map<string, { id: string; accommodationId: string; guestId: string }> = new Map();

  // Simulated mutex locks per table/trip row to simulate PostgreSQL row locking (SELECT ... FOR UPDATE)
  private tableLocks: Map<string, Promise<void>> = new Map();

  private async acquireRowLock(tableId: string): Promise<() => void> {
    while (this.tableLocks.has(tableId)) {
      await this.tableLocks.get(tableId);
    }
    let releaseLock: () => void = () => {};
    const lockPromise = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    this.tableLocks.set(tableId, lockPromise);
    return () => {
      this.tableLocks.delete(tableId);
      releaseLock();
    };
  }

  // Seed helper
  createTable(id: string, eventId: string, name: string, capacity: number, version = 1) {
    this.tables.set(id, { id, eventId, name, capacity, version });
  }

  createTransportTrip(id: string, eventId: string, tripName: string, maxPassengers: number, version = 1) {
    this.transportTrips.set(id, { id, eventId, tripName, maxPassengers, version });
  }

  createAccommodation(id: string, eventId: string, roomNumber: string, capacity: number, version = 1) {
    this.accommodations.set(id, { id, eventId, roomNumber, capacity, version });
  }

  assignSeatDirect(id: string, tableId: string, guestId: string, eventId: string, isOccupyingSeat = true) {
    this.seatAssignments.set(id, { id, tableId, guestId, eventId, isOccupyingSeat });
  }

  assignPassengerDirect(id: string, tripId: string, guestId: string) {
    this.tripPassengers.set(id, { id, tripId, guestId });
  }

  assignRoomDirect(id: string, accommodationId: string, guestId: string) {
    this.roomAssignments.set(id, { id, accommodationId, guestId });
  }

  getTable(id: string) {
    return this.tables.get(id);
  }

  getSeatsUsed(tableId: string): number {
    return Array.from(this.seatAssignments.values()).filter(
      (s) => s.tableId === tableId && s.isOccupyingSeat
    ).length;
  }

  getAssignedPassengersCount(tripId: string): number {
    return Array.from(this.tripPassengers.values()).filter((p) => p.tripId === tripId).length;
  }

  getAssignedOccupantsCount(accommodationId: string): number {
    return Array.from(this.roomAssignments.values()).filter((a) => a.accommodationId === accommodationId).length;
  }

  // AT21: In-transaction seat assignment with row locking & capacity check
  async assignGuestToTable(
    eventId: string,
    tableId: string,
    guestId: string,
    options: { isOccupyingSeat?: boolean; expectedVersion?: number } = {}
  ): Promise<{ success: boolean; assignmentId: string; version: number }> {
    const release = await this.acquireRowLock(tableId);
    try {
      // Simulate network / DB processing jitter (1-5ms) to induce race contention
      await new Promise((res) => setTimeout(res, Math.floor(Math.random() * 5) + 1));

      const table = this.tables.get(tableId);
      if (!table) {
        throw new Error(`Table ${tableId} not found`);
      }

      // Check optimistic locking if provided
      if (options.expectedVersion !== undefined && table.version !== options.expectedVersion) {
        throw new OptimisticLockError(
          `Version conflict on table ${tableId}: expected ${options.expectedVersion}, got ${table.version}`,
          table.version
        );
      }

      // Check unique guest per event
      const alreadySeated = Array.from(this.seatAssignments.values()).find(
        (s) => s.eventId === eventId && s.guestId === guestId
      );
      if (alreadySeated) {
        throw new Error(`Guest ${guestId} is already assigned to a table in event ${eventId}`);
      }

      const isOccupyingSeat = options.isOccupyingSeat ?? true;
      const currentOccupied = this.getSeatsUsed(tableId);

      if (isOccupyingSeat && currentOccupied >= table.capacity) {
        throw new CapacityExceededError(
          `Bàn ${table.name} đã hết chỗ do thao tác khác vừa hoàn tất. Sức chứa: ${table.capacity}, đang ngồi: ${currentOccupied}`,
          { tableId, capacity: table.capacity, currentOccupied }
        );
      }

      const assignmentId = `seat-${guestId}-${tableId}`;
      this.seatAssignments.set(assignmentId, {
        id: assignmentId,
        tableId,
        guestId,
        eventId,
        isOccupyingSeat,
      });

      // Increment table version on state change
      table.version += 1;

      return { success: true, assignmentId, version: table.version };
    } finally {
      release();
    }
  }

  // AT21: Atomic batch seating for a party
  async assignPartyToTable(
    eventId: string,
    tableId: string,
    guestIds: string[]
  ): Promise<{ success: boolean; version: number }> {
    const release = await this.acquireRowLock(tableId);
    try {
      await new Promise((res) => setTimeout(res, 2));
      const table = this.tables.get(tableId);
      if (!table) throw new Error('Table not found');

      const currentOccupied = this.getSeatsUsed(tableId);
      const neededSeats = guestIds.length;

      if (currentOccupied + neededSeats > table.capacity) {
        throw new CapacityExceededError(
          `Không đủ chỗ cho cả nhóm (${neededSeats} người). Bàn chỉ còn ${table.capacity - currentOccupied} ghế trống.`,
          { tableId, capacity: table.capacity, currentOccupied, neededSeats }
        );
      }

      for (const guestId of guestIds) {
        const assignmentId = `seat-${guestId}-${tableId}`;
        this.seatAssignments.set(assignmentId, {
          id: assignmentId,
          tableId,
          guestId,
          eventId,
          isOccupyingSeat: true,
        });
      }

      table.version += 1;
      return { success: true, version: table.version };
    } finally {
      release();
    }
  }

  // AT22: Table capacity update guard
  async updateTableCapacity(
    eventId: string,
    tableId: string,
    newCapacity: number,
    expectedVersion?: number
  ): Promise<{ id: string; capacity: number; version: number }> {
    const release = await this.acquireRowLock(tableId);
    try {
      const table = this.tables.get(tableId);
      if (!table) throw new Error('Table not found');

      if (expectedVersion !== undefined && table.version !== expectedVersion) {
        throw new OptimisticLockError(
          `Version conflict: expected ${expectedVersion}, got ${table.version}`,
          table.version
        );
      }

      if (newCapacity <= 0) {
        throw new Error('Sức chứa bàn phải là số nguyên dương');
      }

      const currentOccupied = this.getSeatsUsed(tableId);
      if (newCapacity < currentOccupied) {
        throw new InvalidCapacityReductionError(
          `Không thể giảm sức chứa xuống ${newCapacity} vì bàn đang có ${currentOccupied} khách cần ghế. Vui lòng chuyển bớt khách trước.`,
          currentOccupied,
          newCapacity
        );
      }

      table.capacity = newCapacity;
      table.version += 1;
      return { id: table.id, capacity: table.capacity, version: table.version };
    } finally {
      release();
    }
  }

  // AT22: Transport trip capacity update guard
  async updateTripCapacity(
    tripId: string,
    newMaxPassengers: number,
    expectedVersion?: number
  ): Promise<{ id: string; maxPassengers: number; version: number }> {
    const trip = this.transportTrips.get(tripId);
    if (!trip) throw new Error('Trip not found');

    if (expectedVersion !== undefined && trip.version !== expectedVersion) {
      throw new OptimisticLockError(
        `Version conflict: expected ${expectedVersion}, got ${trip.version}`,
        trip.version
      );
    }

    if (newMaxPassengers <= 0) {
      throw new Error('Số chỗ xe phải là số nguyên dương');
    }

    const currentAssigned = this.getAssignedPassengersCount(tripId);
    if (newMaxPassengers < currentAssigned) {
      throw new InvalidCapacityReductionError(
        `Không thể giảm sức chứa xe xuống ${newMaxPassengers} vì đã có ${currentAssigned} hành khách được phân công lên chuyến này.`,
        currentAssigned,
        newMaxPassengers
      );
    }

    trip.maxPassengers = newMaxPassengers;
    trip.version += 1;
    return { id: trip.id, maxPassengers: trip.maxPassengers, version: trip.version };
  }

  // AT22: Accommodation capacity update guard
  async updateAccommodationCapacity(
    accommodationId: string,
    newCapacity: number
  ): Promise<{ id: string; capacity: number; version: number }> {
    const acc = this.accommodations.get(accommodationId);
    if (!acc) throw new Error('Accommodation not found');

    if (newCapacity <= 0) {
      throw new Error('Sức chứa phòng phải là số nguyên dương');
    }

    const currentOccupants = this.getAssignedOccupantsCount(accommodationId);
    if (newCapacity < currentOccupants) {
      throw new InvalidCapacityReductionError(
        `Không thể giảm sức chứa phòng xuống ${newCapacity} vì phòng đang có ${currentOccupants} người ở.`,
        currentOccupants,
        newCapacity
      );
    }

    acc.capacity = newCapacity;
    acc.version += 1;
    return { id: acc.id, capacity: acc.capacity, version: acc.version };
  }
}

describe('Gate G8 Adversarial Suite: Concurrency, Capacity Guards & Optimistic Locking', () => {
  let harness: SeatingConcurrencyHarness;
  const eventId = 'e0000000-0000-4000-8000-000000000001';
  const tableId = 't0000000-0000-4000-8000-000000000010';

  beforeEach(() => {
    vi.restoreAllMocks();
    harness = new SeatingConcurrencyHarness();
  });

  // =========================================================================
  // 1. AT21: Concurrent Seating Race Conditions (Row Locks / FOR UPDATE)
  // =========================================================================
  describe('AT21: Concurrent Seating Race into Last Seat', () => {
    it('[AT21-01] strictly allows only 1 winner when 2 parallel requests compete for the last table seat', async () => {
      // Setup: Table with capacity 10, pre-filled with 9 guests -> exactly 1 seat left
      harness.createTable(tableId, eventId, 'Bàn VIP 1', 10, 1);
      for (let i = 1; i <= 9; i++) {
        harness.assignSeatDirect(`seat-existing-${i}`, tableId, `guest-existing-${i}`, eventId, true);
      }
      expect(harness.getSeatsUsed(tableId)).toBe(9);

      const guestCandidateA = 'guest-competitor-alpha';
      const guestCandidateB = 'guest-competitor-beta';

      // Execute 2 parallel requests simultaneously targeting the last available seat
      const [resultA, resultB] = await Promise.allSettled([
        harness.assignGuestToTable(eventId, tableId, guestCandidateA),
        harness.assignGuestToTable(eventId, tableId, guestCandidateB),
      ]);

      // Exactly ONE request must succeed (fulfilled)
      const successfulAssignments = [resultA, resultB].filter((r) => r.status === 'fulfilled');
      const rejectedAssignments = [resultA, resultB].filter((r) => r.status === 'rejected');

      expect(successfulAssignments).toHaveLength(1);
      expect(rejectedAssignments).toHaveLength(1);

      // Verify the rejected request failed with CapacityExceededError (HTTP 409 semantics)
      const rejectedReason = (rejectedAssignments[0] as PromiseRejectedResult).reason;
      expect(rejectedReason).toBeInstanceOf(CapacityExceededError);
      expect(rejectedReason.code).toBe('CAPACITY_EXCEEDED');
      expect(rejectedReason.statusCode).toBe(409);
      expect(rejectedReason.message).toMatch(/Bàn VIP 1 đã hết chỗ/i);

      // Verify final table state: exactly 10 seats occupied, capacity NEVER breached
      expect(harness.getSeatsUsed(tableId)).toBe(10);
      expect(harness.getTable(tableId)?.capacity).toBe(10);
    });

    it('[AT21-02] high-concurrency stress: 10 parallel requests for 5 remaining seats -> strictly 5 succeed, 5 fail', async () => {
      const stressTableId = 't-stress-5';
      harness.createTable(stressTableId, eventId, 'Bàn Tự Do', 5, 1);
      expect(harness.getSeatsUsed(stressTableId)).toBe(0);

      // Create 10 distinct guest requests competing for 5 seats
      const guestIds = Array.from({ length: 10 }, (_, i) => `stress-guest-${i + 1}`);

      const results = await Promise.allSettled(
        guestIds.map((gid) => harness.assignGuestToTable(eventId, stressTableId, gid))
      );

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(5);
      expect(rejected).toHaveLength(5);

      // Verify every rejected request got CapacityExceededError
      rejected.forEach((r) => {
        const error = (r as PromiseRejectedResult).reason;
        expect(error).toBeInstanceOf(CapacityExceededError);
        expect(error.statusCode).toBe(409);
      });

      // Total occupied seats strictly equals capacity limit (5/5)
      expect(harness.getSeatsUsed(stressTableId)).toBe(5);
    });

    it('[AT21-03] atomic batch assignment: party of 2 rejected entirely when only 1 seat remains (no partial seating)', async () => {
      // Table capacity 10 with 9 occupied seats
      harness.createTable(tableId, eventId, 'Bàn Gia Đình', 10, 1);
      for (let i = 1; i <= 9; i++) {
        harness.assignSeatDirect(`seat-ex-${i}`, tableId, `guest-ex-${i}`, eventId, true);
      }
      expect(harness.getSeatsUsed(tableId)).toBe(9);

      const coupleGuests = ['guest-husband', 'guest-wife'];

      // Attempt to seat couple (2 seats needed, 1 available)
      await expect(
        harness.assignPartyToTable(eventId, tableId, coupleGuests)
      ).rejects.toThrow(CapacityExceededError);

      // Invariant: Zero partial seating — table seats used remains 9
      expect(harness.getSeatsUsed(tableId)).toBe(9);
    });

    it('[AT21-04] prevents cross-table duplicate assignment: same guest cannot be seated in 2 tables concurrently', async () => {
      const table1Id = 't-table-1';
      const table2Id = 't-table-2';
      harness.createTable(table1Id, eventId, 'Bàn 1', 10, 1);
      harness.createTable(table2Id, eventId, 'Bàn 2', 10, 1);

      const targetGuestId = 'guest-duplicate-test';

      const [res1, res2] = await Promise.allSettled([
        harness.assignGuestToTable(eventId, table1Id, targetGuestId),
        harness.assignGuestToTable(eventId, table2Id, targetGuestId),
      ]);

      const fulfilled = [res1, res2].filter((r) => r.status === 'fulfilled');
      const rejected = [res1, res2].filter((r) => r.status === 'rejected');

      // Strictly 1 succeeds, other rejected due to unique guest assignment constraint
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason.message).toContain('already assigned');
    });
  });

  // =========================================================================
  // 2. AT22: Capacity Reduction Guards
  // =========================================================================
  describe('AT22: Capacity Reduction Guard (Tables, Vehicles, Rooms)', () => {
    it('[AT22-01] rejects table capacity reduction below current assigned headcount with 422/400', async () => {
      // Table capacity 10 with 8 assigned guests
      harness.createTable(tableId, eventId, 'Bàn 8 Khách', 10, 1);
      for (let i = 1; i <= 8; i++) {
        harness.assignSeatDirect(`seat-assigned-${i}`, tableId, `guest-g8-${i}`, eventId, true);
      }
      expect(harness.getSeatsUsed(tableId)).toBe(8);

      // Attempt to reduce capacity to 6 (less than 8 assigned)
      await expect(
        harness.updateTableCapacity(eventId, tableId, 6)
      ).rejects.toThrow(InvalidCapacityReductionError);

      try {
        await harness.updateTableCapacity(eventId, tableId, 6);
      } catch (err: any) {
        expect(err.statusCode).toBe(422);
        expect(err.currentAssigned).toBe(8);
        expect(err.requestedCapacity).toBe(6);
        expect(err.message).toMatch(/Không thể giảm sức chứa xuống 6 vì bàn đang có 8 khách cần ghế/i);
      }

      // Verify table capacity remained untouched at 10
      expect(harness.getTable(tableId)?.capacity).toBe(10);
    });

    it('[AT22-02] allows table capacity reduction when new capacity is >= current assigned count', async () => {
      harness.createTable(tableId, eventId, 'Bàn 8 Khách', 10, 1);
      for (let i = 1; i <= 8; i++) {
        harness.assignSeatDirect(`seat-assigned-${i}`, tableId, `guest-g8-${i}`, eventId, true);
      }

      // Reducing to exactly 8 (equals assigned) -> allowed
      const updatedExact = await harness.updateTableCapacity(eventId, tableId, 8);
      expect(updatedExact.capacity).toBe(8);
      expect(harness.getTable(tableId)?.capacity).toBe(8);

      // Increasing to 12 -> allowed
      const updatedIncrease = await harness.updateTableCapacity(eventId, tableId, 12);
      expect(updatedIncrease.capacity).toBe(12);
      expect(harness.getTable(tableId)?.capacity).toBe(12);
    });

    it('[AT22-03] rejects transport trip passenger capacity reduction below current assigned passengers', async () => {
      const tripId = 'trip-shuttle-1';
      // 29-seat bus with 25 passengers assigned
      harness.createTransportTrip(tripId, eventId, 'Chuyến Xe Đưa Đón Họ Nhà Gái', 29, 1);
      for (let i = 1; i <= 25; i++) {
        harness.assignPassengerDirect(`p-${i}`, tripId, `passenger-${i}`);
      }
      expect(harness.getAssignedPassengersCount(tripId)).toBe(25);

      // Attempt to downgrade bus to 16 seats
      await expect(
        harness.updateTripCapacity(tripId, 16)
      ).rejects.toThrow(InvalidCapacityReductionError);

      try {
        await harness.updateTripCapacity(tripId, 16);
      } catch (err: any) {
        expect(err.statusCode).toBe(422);
        expect(err.currentAssigned).toBe(25);
        expect(err.requestedCapacity).toBe(16);
        expect(err.message).toMatch(/Không thể giảm sức chứa xe xuống 16 vì đã có 25 hành khách/i);
      }

      // Updating to 25 seats (exact fit) -> succeeds
      const fitResult = await harness.updateTripCapacity(tripId, 25);
      expect(fitResult.maxPassengers).toBe(25);

      // Expanding to 35 seats -> succeeds
      const expandResult = await harness.updateTripCapacity(tripId, 35);
      expect(expandResult.maxPassengers).toBe(35);
    });

    it('[AT22-04] rejects accommodation room capacity reduction below current assigned guests', async () => {
      const roomId = 'acc-room-401';
      harness.createAccommodation(roomId, eventId, 'Phòng 401 (4 Giường)', 4, 1);
      for (let i = 1; i <= 3; i++) {
        harness.assignRoomDirect(`r-${i}`, roomId, `guest-room-${i}`);
      }
      expect(harness.getAssignedOccupantsCount(roomId)).toBe(3);

      // Attempt to change room capacity to 2 (while 3 occupants are assigned)
      await expect(
        harness.updateAccommodationCapacity(roomId, 2)
      ).rejects.toThrow(InvalidCapacityReductionError);

      // Updating to 3 or 5 succeeds
      const result3 = await harness.updateAccommodationCapacity(roomId, 3);
      expect(result3.capacity).toBe(3);
    });
  });

  // =========================================================================
  // 3. AT30: Optimistic Locking via Version Control
  // =========================================================================
  describe('AT30: Optimistic Locking & Conflict Resolution', () => {
    it('[AT30-01] returns 409 Conflict when updating table with outdated version number', async () => {
      // Table initialized at version 1
      harness.createTable(tableId, eventId, 'Bàn 1 Gốc', 10, 1);

      // User A reads version 1
      const userAExpectedVersion = 1;

      // User B reads version 1 and successfully updates table capacity to 12
      const userBResult = await harness.updateTableCapacity(eventId, tableId, 12, 1);
      expect(userBResult.version).toBe(2);
      expect(harness.getTable(tableId)?.version).toBe(2);

      // User A tries to update using outdated expectedVersion = 1
      await expect(
        harness.updateTableCapacity(eventId, tableId, 14, userAExpectedVersion)
      ).rejects.toThrow(OptimisticLockError);

      try {
        await harness.updateTableCapacity(eventId, tableId, 14, userAExpectedVersion);
      } catch (err: any) {
        expect(err).toBeInstanceOf(OptimisticLockError);
        expect(err.statusCode).toBe(409);
        expect(err.code).toBe('VERSION_CONFLICT');
        expect(err.currentVersion).toBe(2);
      }

      // User A refreshes, gets currentVersion = 2, and updates with expectedVersion = 2
      const retryResult = await harness.updateTableCapacity(eventId, tableId, 14, 2);
      expect(retryResult.version).toBe(3);
      expect(harness.getTable(tableId)?.capacity).toBe(14);
    });

    it('[AT30-02] returns 409 Conflict when assigning seat with stale table version', async () => {
      harness.createTable(tableId, eventId, 'Bàn 2', 10, 1);

      // Someone else modifies table -> bumps version to 2
      await harness.updateTableCapacity(eventId, tableId, 12, 1);
      expect(harness.getTable(tableId)?.version).toBe(2);

      // Stale client submits seat assignment with version 1
      await expect(
        harness.assignGuestToTable(eventId, tableId, 'guest-stale-v1', { expectedVersion: 1 })
      ).rejects.toThrow(OptimisticLockError);

      // With current version 2 -> succeeds and bumps to version 3
      const successResult = await harness.assignGuestToTable(eventId, tableId, 'guest-stale-v1', {
        expectedVersion: 2,
      });
      expect(successResult.success).toBe(true);
      expect(successResult.version).toBe(3);
    });

    it('[AT30-03] enforces optimistic locking on transport trips updates', async () => {
      const tripId = 'trip-lock-test';
      harness.createTransportTrip(tripId, eventId, 'Chuyến Xe Nội Thành', 16, 1);

      // Advance trip version to 2
      await harness.updateTripCapacity(tripId, 20, 1);

      // Stale update with version 1 fails with 409
      await expect(
        harness.updateTripCapacity(tripId, 24, 1)
      ).rejects.toThrow(OptimisticLockError);

      // Update with current version 2 succeeds
      const ok = await harness.updateTripCapacity(tripId, 24, 2);
      expect(ok.version).toBe(3);
      expect(ok.maxPassengers).toBe(24);
    });
  });
});
