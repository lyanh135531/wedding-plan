import { describe, it, expect } from 'vitest';
import {
  createTable,
  getTableById,
  listTablesByEvent,
  updateTable,
  deleteTable,
  assignSeat,
  unassignSeat,
  getTableAssignments,
  assignGuestToTable,
  handleAttendanceChange,
  updateTableCapacity,
  exportSeatingChartA4,
  CapacityExceededError,
  OptimisticLockError,
} from '@/lib/seating';
import { createMockG8TxDb } from '@tests/helpers/g8-mock-db';

describe('Gate G8 Seating Unit Tests (AT07, AT10, AT21, AT22, AT26)', () => {
  const eventId = '11111111-1111-4111-8111-111111111111';
  const tableId = '22222222-2222-4222-8222-222222222222';
  const adultGuestId = '33333333-3333-4333-8333-333333333333';
  const babyGuestId = '44444444-4444-4444-8444-444444444444';
  const guest1Id = '55555555-5555-4555-8555-555555555555';
  const guest2Id = '66666666-6666-4666-8666-666666666666';
  const guest3Id = '77777777-7777-4777-8777-777777777777';

  describe('1. Tables Repository CRUD & Optimistic Locking', () => {
    it('creates table with valid schema and default values', async () => {
      const txDb = createMockG8TxDb();

      const created = await createTable(txDb, {
        eventId,
        name: 'Bàn VIP 01',
        tableNumber: 'A1',
        shape: 'round',
        capacity: 10,
        notes: 'Ghi chú bàn VIP',
      });

      expect(created.name).toBe('Bàn VIP 01');
      expect(created.capacity).toBe(10);
      expect(created.shape).toBe('round');
      expect(created.version).toBe(1);
    });

    it('retrieves table by ID', async () => {
      const txDb = createMockG8TxDb({
        tables: [
          {
            id: tableId,
            eventId,
            name: 'Bàn A1',
            tableNumber: '01',
            shape: 'round',
            capacity: 10,
            notes: 'Gần sân khấu',
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });

      const table = await getTableById(txDb, tableId);
      expect(table).not.toBeNull();
      expect(table?.id).toBe(tableId);
      expect(table?.name).toBe('Bàn A1');
    });

    it('masks table notes when role is family_view (AT26)', async () => {
      const txDb = createMockG8TxDb({
        tables: [
          {
            id: tableId,
            eventId,
            name: 'Bàn Họ Hàng',
            tableNumber: 'H1',
            shape: 'rectangular',
            capacity: 8,
            notes: 'Ghi chú bí mật gia đình',
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });

      const ownerList = await listTablesByEvent(txDb, eventId, 'owner');
      expect(ownerList[0].notes).toBe('Ghi chú bí mật gia đình');

      const familyList = await listTablesByEvent(txDb, eventId, 'family_view');
      expect(familyList[0].notes).toBeNull();
    });

    it('rejects update with stale version (Optimistic Locking AT30)', async () => {
      const txDb = createMockG8TxDb({
        tables: [
          {
            id: tableId,
            eventId,
            name: 'Bàn A1',
            shape: 'round',
            capacity: 10,
            version: 2, // Current version is 2
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });

      await expect(
        updateTable(txDb, tableId, {
          capacity: 12,
          version: 1, // Stale version submitted
        })
      ).rejects.toThrow(OptimisticLockError);
    });

    it('deletes table', async () => {
      const txDb = createMockG8TxDb({
        tables: [
          {
            id: tableId,
            eventId,
            name: 'Bàn Cần Xóa',
            shape: 'round',
            capacity: 10,
            version: 1,
          },
        ],
      });

      const success = await deleteTable(txDb, tableId);
      expect(success).toBe(true);
      expect(txDb._store.tables.length).toBe(0);
    });
  });

  describe('2. Seat Assignment Repository', () => {
    it('assigns and unassigns seat for a guest', async () => {
      const txDb = createMockG8TxDb();

      const assigned = await assignSeat(txDb, {
        eventId,
        tableId,
        guestId: adultGuestId,
        seatNumber: 1,
      });

      expect(assigned.tableId).toBe(tableId);
      expect(assigned.guestId).toBe(adultGuestId);
      expect(assigned.seatNumber).toBe(1);

      const unseated = await unassignSeat(txDb, eventId, adultGuestId);
      expect(unseated).toBe(true);
    });

    it('retrieves table seat assignments', async () => {
      const seatId = '88888888-8888-4888-8888-888888888888';
      const txDb = createMockG8TxDb({
        seatAssignments: [
          {
            id: seatId,
            eventId,
            tableId,
            guestId: adultGuestId,
            seatNumber: 1,
            notes: null,
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });

      const list = await getTableAssignments(txDb, tableId);
      expect(list.length).toBe(1);
      expect(list[0].guestId).toBe(adultGuestId);
    });
  });

  describe('3. AT21: In-Transaction Table Capacity Validation', () => {
    it('rejects seating guest when table capacity is exceeded', async () => {
      // Table capacity = 2, already 2 adults seated
      const txDb = createMockG8TxDb({
        tables: [
          {
            id: tableId,
            eventId,
            name: 'Bàn 2 Chỗ',
            shape: 'round',
            capacity: 2,
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        seatAssignments: [
          { id: '10000000-0000-4000-8000-000000000001', tableId, guestId: guest1Id, eventId, seatNumber: 1, version: 1 },
          { id: '10000000-0000-4000-8000-000000000002', tableId, guestId: guest2Id, eventId, seatNumber: 2, version: 1 },
        ],
        attendance: [
          { guestId: guest1Id, eventId, needsSeat: true },
          { guestId: guest2Id, eventId, needsSeat: true },
          { guestId: adultGuestId, eventId, needsSeat: true },
        ],
        guests: [
          { id: guest1Id, ageTier: 'adult' },
          { id: guest2Id, ageTier: 'adult' },
          { id: adultGuestId, ageTier: 'adult' },
        ],
      });

      await expect(
        assignGuestToTable(txDb, eventId, tableId, adultGuestId)
      ).rejects.toThrow(CapacityExceededError);
    });

    it('allows seating guest when table has remaining capacity', async () => {
      // Table capacity = 2, only 1 adult seated
      const txDb = createMockG8TxDb({
        tables: [
          {
            id: tableId,
            eventId,
            name: 'Bàn 2 Chỗ',
            shape: 'round',
            capacity: 2,
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        seatAssignments: [
          { id: '10000000-0000-4000-8000-000000000001', tableId, guestId: guest1Id, eventId, seatNumber: 1, version: 1 },
        ],
        attendance: [
          { guestId: guest1Id, eventId, needsSeat: true },
          { guestId: adultGuestId, eventId, needsSeat: true },
        ],
        guests: [
          { id: guest1Id, ageTier: 'adult' },
          { id: adultGuestId, ageTier: 'adult' },
        ],
      });

      const assigned = await assignGuestToTable(txDb, eventId, tableId, adultGuestId);
      expect(assigned.guestId).toBe(adultGuestId);
      expect(assigned.tableId).toBe(tableId);
    });
  });

  describe('4. AT07: Child / Infant Non-Seat Policy', () => {
    it('allows baby/non-seat guest to be assigned to a 100% full table without error', async () => {
      // Table capacity = 2, already 2 adults seated (100% full)
      const txDb = createMockG8TxDb({
        tables: [
          {
            id: tableId,
            eventId,
            name: 'Bàn Đầy',
            shape: 'round',
            capacity: 2,
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        seatAssignments: [
          { id: '10000000-0000-4000-8000-000000000001', tableId, guestId: guest1Id, eventId, seatNumber: 1, version: 1 },
          { id: '10000000-0000-4000-8000-000000000002', tableId, guestId: guest2Id, eventId, seatNumber: 2, version: 1 },
        ],
        attendance: [
          { guestId: guest1Id, eventId, needsSeat: true },
          { guestId: guest2Id, eventId, needsSeat: true },
          { guestId: babyGuestId, eventId, needsSeat: false }, // does not need seat
        ],
        guests: [
          { id: guest1Id, ageTier: 'adult' },
          { id: guest2Id, ageTier: 'adult' },
          { id: babyGuestId, ageTier: 'baby' },
        ],
      });

      // Seating baby succeeds even though table is at max capacity!
      const assignment = await assignGuestToTable(txDb, eventId, tableId, babyGuestId);
      expect(assignment.guestId).toBe(babyGuestId);
      expect(assignment.tableId).toBe(tableId);
    });
  });

  describe('5. AT10: Safe Table Unseating on Declined RSVP', () => {
    it('automatically unseats guest and logs audit trail when status becomes declined', async () => {
      const seatId = '10000000-0000-4000-8000-000000000010';
      const txDb = createMockG8TxDb({
        seatAssignments: [
          {
            id: seatId,
            tableId,
            guestId: adultGuestId,
            eventId,
            seatNumber: 3,
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        attendance: [
          {
            guestId: adultGuestId,
            eventId,
            rsvpStatus: 'accepted',
            needsSeat: true,
            needsMeal: true,
          },
        ],
        auditLogs: [],
      });

      const result = await handleAttendanceChange(
        txDb,
        eventId,
        adultGuestId,
        'declined',
        'user-admin'
      );

      expect(result.unseated).toBe(true);
      expect(result.tableId).toBe(tableId);

      // Verify seat assignment removed
      expect(txDb._store.seatAssignments.length).toBe(0);

      // Verify audit log entry created
      expect(txDb._store.auditLogs.length).toBe(1);
      expect(txDb._store.auditLogs[0].action).toBe('seat_unassigned_rsvp_decline');
      expect(txDb._store.auditLogs[0].entityId).toBe(adultGuestId);
    });

    it('does nothing when status is not declined', async () => {
      const seatId = '10000000-0000-4000-8000-000000000010';
      const txDb = createMockG8TxDb({
        seatAssignments: [
          { id: seatId, tableId, guestId: adultGuestId, eventId, seatNumber: 3, version: 1 },
        ],
      });

      const result = await handleAttendanceChange(
        txDb,
        eventId,
        adultGuestId,
        'accepted'
      );

      expect(result.unseated).toBe(false);
      expect(txDb._store.seatAssignments.length).toBe(1);
    });
  });

  describe('6. AT22: Table Capacity Reduction Guard', () => {
    it('rejects reducing capacity below currently assigned seat-consuming guests', async () => {
      // Currently 3 guests occupying seats
      const txDb = createMockG8TxDb({
        tables: [
          {
            id: tableId,
            eventId,
            name: 'Bàn Lớn',
            shape: 'round',
            capacity: 10,
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        seatAssignments: [
          { id: '10000000-0000-4000-8000-000000000001', tableId, guestId: guest1Id, eventId, version: 1 },
          { id: '10000000-0000-4000-8000-000000000002', tableId, guestId: guest2Id, eventId, version: 1 },
          { id: '10000000-0000-4000-8000-000000000003', tableId, guestId: guest3Id, eventId, version: 1 },
        ],
        attendance: [
          { guestId: guest1Id, eventId, needsSeat: true },
          { guestId: guest2Id, eventId, needsSeat: true },
          { guestId: guest3Id, eventId, needsSeat: true },
        ],
        guests: [
          { id: guest1Id, ageTier: 'adult' },
          { id: guest2Id, ageTier: 'adult' },
          { id: guest3Id, ageTier: 'adult' },
        ],
      });

      // Attempt to reduce capacity from 10 to 2 (while 3 guests are seated)
      await expect(
        updateTableCapacity(txDb, eventId, tableId, 2, 1)
      ).rejects.toThrow(CapacityExceededError);
    });

    it('allows reducing capacity down to exact assigned count or above', async () => {
      const txDb = createMockG8TxDb({
        tables: [
          {
            id: tableId,
            eventId,
            name: 'Bàn Lớn',
            shape: 'round',
            capacity: 10,
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        seatAssignments: [
          { id: '10000000-0000-4000-8000-000000000001', tableId, guestId: guest1Id, eventId, version: 1 },
          { id: '10000000-0000-4000-8000-000000000002', tableId, guestId: guest2Id, eventId, version: 1 },
        ],
        attendance: [
          { guestId: guest1Id, eventId, needsSeat: true },
          { guestId: guest2Id, eventId, needsSeat: true },
        ],
        guests: [
          { id: guest1Id, ageTier: 'adult' },
          { id: guest2Id, ageTier: 'adult' },
        ],
      });

      // Reducing to 2 (matching the 2 seated guests) succeeds
      const updated = await updateTableCapacity(txDb, eventId, tableId, 2, 1);
      expect(updated.capacity).toBe(2);
    });
  });

  describe('7. AT26: A4 Seating Chart Export Sanitization', () => {
    it('strips private notes, phone, email for family_view and preserves for owner', async () => {
      const txDb = createMockG8TxDb({
        tables: [
          {
            id: tableId,
            eventId,
            name: 'Bàn Trung Tâm',
            tableNumber: 'TT-01',
            shape: 'round',
            capacity: 10,
            notes: 'Ghi chú bàn riêng: Khách quan trọng',
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        seatAssignments: [
          {
            id: '10000000-0000-4000-8000-000000000001',
            tableId,
            guestId: adultGuestId,
            eventId,
            seatNumber: 1,
            notes: 'Ngồi đầu bàn',
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        guests: [
          {
            id: adultGuestId,
            displayName: 'Trần Văn VIP',
            phone: '0987654321',
            email: 'vip@example.com',
            privateNotes: 'Ghi chú riêng về phong bì',
            ageTier: 'adult',
          },
        ],
        attendance: [
          {
            guestId: adultGuestId,
            eventId,
            needsSeat: true,
            dietaryNotes: 'Ăn chay một phần',
          },
        ],
      });

      // Owner export: contains private notes and contact info
      const ownerExport = await exportSeatingChartA4(txDb, eventId, 'owner');
      expect(ownerExport.tables[0].notes).toBe('Ghi chú bàn riêng: Khách quan trọng');
      expect(ownerExport.tables[0].guests[0].phone).toBe('0987654321');
      expect(ownerExport.tables[0].guests[0].email).toBe('vip@example.com');
      expect(ownerExport.tables[0].guests[0].privateNotes).toBe('Ghi chú riêng về phong bì');
      expect(ownerExport.tables[0].guests[0].dietaryNotes).toBe('Ăn chay một phần');

      // Family view export: all private details stripped!
      const familyExport = await exportSeatingChartA4(txDb, eventId, 'family_view');
      expect(familyExport.tables[0].notes).toBeNull();
      expect(familyExport.tables[0].guests[0].phone).toBeNull();
      expect(familyExport.tables[0].guests[0].email).toBeNull();
      expect(familyExport.tables[0].guests[0].privateNotes).toBeNull();
      expect(familyExport.tables[0].guests[0].displayName).toBe('Trần Văn VIP'); // Display name preserved
      expect(familyExport.tables[0].guests[0].dietaryNotes).toBe('Ăn chay một phần'); // Operational dietary info preserved
    });
  });
});
