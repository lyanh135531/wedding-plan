import { describe, it, expect } from 'vitest';
import { createMockG10TxDb } from '../../helpers/g10-mock-db';
import {
  toggleCheckIn,
  checkInGuest,
  undoCheckIn,
  createWalkInGuest,
  searchGuests,
  getSummary,
} from '@/lib/attendance';
import {
  CheckInDisabledError,
  DeclinedGuestConfirmationRequiredError,
  TableCapacityExceededError,
  AttendanceNotFoundError,
} from '@/lib/attendance/errors';

describe('Gate G10: Attendance Check-in Service & Operations (PLAN §14.3)', () => {
  const eventId = '00000000-0000-4000-8000-000000000001';
  const guest1Id = '00000000-0000-4000-8000-000000000010';
  const guestDeclinedId = '00000000-0000-4000-8000-000000000020';
  const table1Id = '00000000-0000-4000-8000-000000000100';

  function setupDb() {
    return createMockG10TxDb({
      events: [{ id: eventId, isCheckInEnabled: true }],
      guests: [
        { id: guest1Id, displayName: 'Nguyễn Văn An', phone: '0901234567', isOriginOnsite: false },
        { id: guestDeclinedId, displayName: 'Trần Thị Bình', phone: '0912345678', isOriginOnsite: false },
      ],
      attendance: [
        {
          eventId,
          guestId: guest1Id,
          rsvpStatus: 'accepted',
          isCheckedIn: false,
          checkInTime: null,
          isOriginOnsite: false,
          version: 1,
        },
        {
          eventId,
          guestId: guestDeclinedId,
          rsvpStatus: 'declined',
          isCheckedIn: false,
          checkInTime: null,
          isOriginOnsite: false,
          version: 1,
        },
      ],
      tables: [
        { id: table1Id, eventId, name: 'Bàn VIP 1', tableNumber: '1', capacity: 2 },
      ],
      seatAssignments: [
        { id: 'seat-1', eventId, tableId: table1Id, guestId: guest1Id, seatNumber: 1 },
      ],
    });
  }

  it('performs one-tap check-in and resolves assigned table and seat number', async () => {
    const db = setupDb();
    const result = await checkInGuest(db, {
      eventId,
      guestId: guest1Id,
      checkInNotes: 'Đến cùng gia đình',
    }, 'user-reception');

    expect(result.isCheckedIn).toBe(true);
    expect(result.checkInTime).toBeDefined();
    expect(result.checkedInByUserId).toBe('user-reception');
    expect(result.tableName).toBe('Bàn VIP 1');
    expect(result.tableNumber).toBe(1);
    expect(result.seatNumber).toBe(1);

    const summary = await getSummary(db, eventId);
    expect(summary.checkedInCount).toBe(1);
    expect(summary.notCheckedInCount).toBe(1);
  });

  it('rejects check-in when check-in feature is disabled for the event', async () => {
    const db = setupDb();
    await toggleCheckIn(db, eventId, false);

    await expect(
      checkInGuest(db, { eventId, guestId: guest1Id })
    ).rejects.toThrow(CheckInDisabledError);
  });

  it('requires confirmation when checking in a previously declined guest (Edge Case 5)', async () => {
    const db = setupDb();

    // Attempt without confirmation -> rejects with DeclinedGuestConfirmationRequiredError
    await expect(
      checkInGuest(db, { eventId, guestId: guestDeclinedId, confirmDeclinedOverride: false })
    ).rejects.toThrow(DeclinedGuestConfirmationRequiredError);

    // Attempt with confirmation -> succeeds
    const checked = await checkInGuest(db, {
      eventId,
      guestId: guestDeclinedId,
      confirmDeclinedOverride: true,
      checkInNotes: 'Khách đến đột xuất dù từng báo từ chối',
    });

    expect(checked.isCheckedIn).toBe(true);
  });

  it('undoes check-in with audit log notes', async () => {
    const db = setupDb();
    await checkInGuest(db, { eventId, guestId: guest1Id });

    const undone = await undoCheckIn(db, {
      eventId,
      guestId: guest1Id,
      undoReason: 'Điểm danh nhầm người',
    }, 'reception-lead');

    expect(undone.isCheckedIn).toBe(false);
    expect(undone.checkInTime).toBeNull();
    expect(undone.checkInNotes).toContain('Hoàn tác điểm danh');
  });

  it('creates walk-in guest with isOriginOnsite: true and checks in (Edge Case 6 table capacity)', async () => {
    const db = setupDb();

    // Table 1 capacity is 2, currently has 1 assigned seat (guest1Id)
    // Add 1 walk-in to table 1 -> succeeds
    const walkIn1 = await createWalkInGuest(db, {
      eventId,
      fullName: 'Phạm Minh Cường',
      phone: '0988 888 888',
      tableId: table1Id,
    });

    expect(walkIn1.phone).toBe('0988888888');
    expect(walkIn1.isOriginOnsite).toBe(true);
    expect(walkIn1.isCheckedIn).toBe(true);
    expect(walkIn1.tableName).toBe('Bàn VIP 1');

    // Attempt to add a 2nd walk-in to Table 1 which now has 2/2 -> 409 TableCapacityExceededError
    await expect(
      createWalkInGuest(db, {
        eventId,
        fullName: 'Lê Hoàng Dũng',
        tableId: table1Id,
      })
    ).rejects.toThrow(TableCapacityExceededError);
  });

  it('searches guests by unaccented name or phone', async () => {
    const db = setupDb();
    // Query 'nguyen van an' without accents matches 'Nguyễn Văn An'
    const resultsName = await searchGuests(db, eventId, 'nguyen van an');
    expect(resultsName.length).toBe(1);
    expect(resultsName[0].fullName).toBe('Nguyễn Văn An');

    // Query by phone
    const resultsPhone = await searchGuests(db, eventId, '0901234567');
    expect(resultsPhone.length).toBe(1);
    expect(resultsPhone[0].guestId).toBe(guest1Id);
  });
});
