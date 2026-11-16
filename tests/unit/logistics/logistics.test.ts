import { describe, it, expect } from 'vitest';
import {
  createAccommodation,
  getAccommodationById,
  listAccommodationsByEvent,
  updateAccommodation,
  deleteAccommodation,
  assignRoom,
  unassignRoom,
  listRoomAssignments,
  checkRoomAvailability,
  createTransportTrip,
  getTransportTripById,
  listTransportTripsByEvent,
  updateTransportTrip,
  deleteTransportTrip,
  assignPassenger,
  unassignPassenger,
  listTripPassengers,
  updateTripCapacity,
  CapacityExceededError,
  OptimisticLockError,
  AccommodationNotFoundError,
  TripNotFoundError,
} from '@/lib/logistics';
import { createMockG8TxDb } from '@tests/helpers/g8-mock-db';

describe('Gate G8 Logistics Unit Tests (Accommodations & Transport Trips)', () => {
  const eventId = '11111111-1111-4111-8111-111111111111';
  const accommodationId = '22222222-2222-4222-8222-222222222222';
  const tripId = '33333333-3333-4333-8333-333333333333';
  const guest1Id = '44444444-4444-4444-8444-444444444444';
  const guest2Id = '55555555-5555-4555-8555-555555555555';
  const guest3Id = '66666666-6666-4666-8666-666666666666';

  describe('1. Accommodations Service CRUD & Optimistic Locking', () => {
    it('creates accommodation with totalRooms and contact phone', async () => {
      const txDb = createMockG8TxDb();

      const created = await createAccommodation(txDb, {
        eventId,
        name: 'Khách Sạn Rex Sài Gòn',
        locationAddress: '141 Nguyễn Huệ, Quận 1',
        totalRooms: 5,
        contactPhone: '0901234567',
        notes: 'Block phòng cho nhà trai',
      });

      expect(created.name).toBe('Khách Sạn Rex Sài Gòn');
      expect(created.totalRooms).toBe(5);
      expect(created.contactPhone).toBe('0901234567');
      expect(created.version).toBe(1);
    });

    it('retrieves accommodation by ID and lists by event', async () => {
      const txDb = createMockG8TxDb({
        accommodations: [
          {
            id: accommodationId,
            eventId,
            name: 'Khách Sạn Mường Thanh',
            locationAddress: null,
            checkInTime: null,
            checkOutTime: null,
            totalRooms: 10,
            contactPhone: null,
            notes: null,
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });

      const acc = await getAccommodationById(txDb, accommodationId);
      expect(acc).not.toBeNull();
      expect(acc?.name).toBe('Khách Sạn Mường Thanh');

      const list = await listAccommodationsByEvent(txDb, eventId);
      expect(list.length).toBe(1);
      expect(list[0].id).toBe(accommodationId);
    });

    it('rejects accommodation update with stale version', async () => {
      const txDb = createMockG8TxDb({
        accommodations: [
          {
            id: accommodationId,
            eventId,
            name: 'Khách Sạn Mường Thanh',
            totalRooms: 10,
            version: 2, // Current version is 2
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });

      await expect(
        updateAccommodation(txDb, accommodationId, {
          totalRooms: 12,
          version: 1, // Stale
        })
      ).rejects.toThrow(OptimisticLockError);
    });

    it('deletes accommodation', async () => {
      const txDb = createMockG8TxDb({
        accommodations: [
          {
            id: accommodationId,
            eventId,
            name: 'Khách Sạn Xóa',
            totalRooms: 2,
            version: 1,
          },
        ],
      });

      const deleted = await deleteAccommodation(txDb, accommodationId);
      expect(deleted).toBe(true);
      expect(txDb._store.accommodations.length).toBe(0);
    });
  });

  describe('2. Room Assignments & Availability', () => {
    it('assigns and unassigns guests to rooms', async () => {
      const txDb = createMockG8TxDb({
        accommodations: [
          {
            id: accommodationId,
            eventId,
            name: 'Khách sạn Caravelle',
            totalRooms: 5,
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });

      const assignment = await assignRoom(txDb, {
        accommodationId,
        eventId,
        roomNumber: '501',
        guestId: guest1Id,
        checkInDate: '2028-02-15',
        checkOutDate: '2028-02-18',
        notes: 'Phòng hướng biển',
      });

      expect(assignment.roomNumber).toBe('501');
      expect(assignment.guestId).toBe(guest1Id);
      expect(assignment.checkInDate).toBe('2028-02-15');

      const unassigned = await unassignRoom(txDb, assignment.id);
      expect(unassigned).toBe(true);
    });

    it('checks room availability correctly', async () => {
      const txDb = createMockG8TxDb({
        roomAssignments: [
          {
            id: '10000000-0000-4000-8000-000000000001',
            accommodationId,
            eventId,
            roomNumber: '301',
            guestId: guest1Id,
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });

      const room301 = await checkRoomAvailability(txDb, accommodationId, '301');
      expect(room301.isAvailable).toBe(false);
      expect(room301.currentOccupants).toBe(1);

      const room302 = await checkRoomAvailability(txDb, accommodationId, '302');
      expect(room302.isAvailable).toBe(true);
      expect(room302.currentOccupants).toBe(0);
    });
  });

  describe('3. Transport Trips Service CRUD', () => {
    it('creates a transport trip with vehicle type and capacity', async () => {
      const txDb = createMockG8TxDb();

      const trip = await createTransportTrip(txDb, {
        eventId,
        name: 'Xe Đưa Đón Nhà Gái - Sân Bay Tân Sơn Nhất',
        vehicleType: 'shuttle_bus',
        departureTime: '2028-02-15T08:00:00Z',
        departureLocation: 'Ga Quốc Nội Tân Sơn Nhất',
        arrivalLocation: 'Khách Sạn Rex',
        capacity: 29,
        driverContact: 'Bác Tài Tuấn - 0918112233',
        notes: 'Đón đoàn 20 khách chuyến bay VN123',
      });

      expect(trip.name).toContain('Xe Đưa Đón Nhà Gái');
      expect(trip.vehicleType).toBe('shuttle_bus');
      expect(trip.capacity).toBe(29);
      expect(trip.version).toBe(1);
    });

    it('rejects update with stale version (Optimistic Locking AT30)', async () => {
      const txDb = createMockG8TxDb({
        transportTrips: [
          {
            id: tripId,
            eventId,
            name: 'Xe 16 Chỗ',
            vehicleType: 'van',
            capacity: 16,
            version: 2, // Current version is 2
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });

      await expect(
        updateTransportTrip(txDb, tripId, {
          capacity: 18,
          version: 1, // Stale
        })
      ).rejects.toThrow(OptimisticLockError);
    });

    it('deletes transport trip', async () => {
      const txDb = createMockG8TxDb({
        transportTrips: [
          {
            id: tripId,
            eventId,
            name: 'Xe Xóa',
            vehicleType: 'car',
            capacity: 4,
            version: 1,
          },
        ],
      });

      const deleted = await deleteTransportTrip(txDb, tripId);
      expect(deleted).toBe(true);
      expect(txDb._store.transportTrips.length).toBe(0);
    });
  });

  describe('4. Transport Passenger Capacity Guards (AT21 & AT22)', () => {
    it('rejects assigning passenger when vehicle capacity is reached (AT21)', async () => {
      // Vehicle capacity = 2, already 2 passengers assigned
      const txDb = createMockG8TxDb({
        transportTrips: [
          {
            id: tripId,
            eventId,
            name: 'Xe 2 Chỗ',
            vehicleType: 'car',
            capacity: 2,
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        tripPassengers: [
          { id: '10000000-0000-4000-8000-000000000001', tripId, eventId, guestId: guest1Id, version: 1 },
          { id: '10000000-0000-4000-8000-000000000002', tripId, eventId, guestId: guest2Id, version: 1 },
        ],
      });

      await expect(
        assignPassenger(txDb, eventId, tripId, guest3Id)
      ).rejects.toThrow(CapacityExceededError);
    });

    it('allows assigning passenger when vehicle has remaining capacity', async () => {
      // Vehicle capacity = 2, only 1 passenger assigned
      const txDb = createMockG8TxDb({
        transportTrips: [
          {
            id: tripId,
            eventId,
            name: 'Xe 2 Chỗ',
            vehicleType: 'car',
            capacity: 2,
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        tripPassengers: [
          { id: '10000000-0000-4000-8000-000000000001', tripId, eventId, guestId: guest1Id, version: 1 },
        ],
      });

      const assigned = await assignPassenger(
        txDb,
        eventId,
        tripId,
        guest2Id,
        'Cổng 2 Ga Quốc Nội'
      );

      expect(assigned.guestId).toBe(guest2Id);
      expect(assigned.pickupPoint).toBe('Cổng 2 Ga Quốc Nội');
    });

    it('unassigns passenger from trip', async () => {
      const txDb = createMockG8TxDb({
        tripPassengers: [
          { id: '10000000-0000-4000-8000-000000000001', tripId, eventId, guestId: guest1Id, version: 1 },
        ],
      });

      const unassigned = await unassignPassenger(txDb, tripId, guest1Id);
      expect(unassigned).toBe(true);
      expect(txDb._store.tripPassengers.length).toBe(0);
    });

    it('rejects reducing vehicle capacity below assigned passenger count (AT22)', async () => {
      // Currently 2 passengers assigned
      const txDb = createMockG8TxDb({
        transportTrips: [
          {
            id: tripId,
            eventId,
            name: 'Xe 16 Chỗ',
            vehicleType: 'van',
            capacity: 16,
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        tripPassengers: [
          { id: '10000000-0000-4000-8000-000000000001', tripId, eventId, guestId: guest1Id, version: 1 },
          { id: '10000000-0000-4000-8000-000000000002', tripId, eventId, guestId: guest2Id, version: 1 },
        ],
      });

      // Attempt to reduce capacity from 16 to 1 (while 2 passengers are assigned)
      await expect(
        updateTripCapacity(txDb, eventId, tripId, 1, 1)
      ).rejects.toThrow(CapacityExceededError);
    });

    it('allows reducing vehicle capacity down to currently assigned count or above (AT22)', async () => {
      const txDb = createMockG8TxDb({
        transportTrips: [
          {
            id: tripId,
            eventId,
            name: 'Xe 16 Chỗ',
            vehicleType: 'van',
            capacity: 16,
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        tripPassengers: [
          { id: '10000000-0000-4000-8000-000000000001', tripId, eventId, guestId: guest1Id, version: 1 },
          { id: '10000000-0000-4000-8000-000000000002', tripId, eventId, guestId: guest2Id, version: 1 },
        ],
      });

      // Reducing to 2 (matching the 2 assigned passengers) succeeds
      const updated = await updateTripCapacity(txDb, eventId, tripId, 2, 1);
      expect(updated.capacity).toBe(2);
    });
  });
});
