import { describe, it, expect } from 'vitest';
import { createMockG10TxDb } from '../../helpers/g10-mock-db';
import {
  createHandoverSnapshot,
  getHandoverDeltaDiff,
  deliverHandover,
  listHandoverPackets,
  getHandoverPacket,
} from '@/lib/handovers';

describe('Gate G10: Handover Packets & Snapshot Diffing (PLAN §14.4, FL13, AT26)', () => {
  const eventId = '00000000-0000-4000-8000-000000000001';

  function setupDb() {
    return createMockG10TxDb({
      events: [{ id: eventId }],
      timelineItems: [
        {
          id: 'tl-1',
          eventId,
          title: 'Đón khách',
          scheduledStartTime: new Date('2028-11-20T17:30:00Z'),
          scheduledEndTime: new Date('2028-11-20T18:30:00Z'),
          status: 'not_started',
          isShared: true,
        },
      ],
      tables: [
        { id: 'tb-1', eventId, name: 'Bàn 1', tableNumber: '1', capacity: 10 },
      ],
      seatAssignments: [
        { id: 'sa-1', eventId, tableId: 'tb-1', guestId: 'g-1', seatNumber: 1 },
      ],
      attendance: [
        { id: 'att-1', eventId, guestId: 'g-1', needsMeal: true, rsvpStatus: 'accepted' },
      ],
      supportAssignments: [
        { id: 'sup-1', eventId, name: 'Anh Tuấn', phone: '0901112222', roles: ['dieu_phoi'] },
      ],
      preparationItems: [
        { id: 'pr-1', eventId, title: 'Bó hoa cưới', type: 'flower', status: 'ready', isRental: false },
      ],
    });
  }

  it('uses operational scope defaults when the caller omits scope', async () => {
    const snapshot = await createHandoverSnapshot(setupDb(), {
      eventId,
      title: 'Default scope',
    });
    expect(snapshot.scope.includeFinancials).toBe(false);
    expect(snapshot.scope.includeTimeline).toBe(true);
    expect(snapshot.snapshotData.timeline).toHaveLength(1);
    expect(snapshot.snapshotData.seating.assignedSeatsCount).toBe(1);
  });

  it('creates an immutable snapshot capturing live event operational state', async () => {
    const db = setupDb();
    const snapshot = await createHandoverSnapshot(db, {
      eventId,
      title: 'Bản chốt vận hành v1',
      scope: {
        includeTimeline: true,
        includeSeating: true,
        includeCatering: true,
        includeSupport: true,
        includeChecklist: true,
      },
    }, 'user-planner');

    expect(snapshot.id).toBeDefined();
    expect(snapshot.version).toBe(1);
    expect(snapshot.title).toBe('Bản chốt vận hành v1');
    expect(snapshot.handoverStatus).toBe('draft');
    const data = snapshot.snapshotData as any;
    expect(data.timeline.length).toBe(1);
    expect(data.seating.assignedSeatsCount).toBe(1);
    expect(data.catering.totalMealsNeeded).toBe(1);
  });

  it('detects delta diff when live state changes after snapshot (FL13, Edge Case 13)', async () => {
    const db = setupDb();
    const snapshot = await createHandoverSnapshot(db, {
      eventId,
      title: 'Bản chốt v1',
      scope: {
        includeTimeline: true,
        includeSeating: true,
        includeCatering: true,
        includeSupport: true,
        includeChecklist: true,
      },
    });

    // Check diff immediately -> hasChanges = false
    let diff = await getHandoverDeltaDiff(db, snapshot.id);
    expect(diff.hasChanges).toBe(false);

    // Modify live data: add 2 new seats to live tables
    db._store.seatAssignments.push(
      { id: 'sa-2', eventId, tableId: 'tb-1', guestId: 'g-2', seatNumber: 2 },
      { id: 'sa-3', eventId, tableId: 'tb-1', guestId: 'g-3', seatNumber: 3 }
    );
    // Add 2 new meals to attendance
    db._store.attendance.push(
      { id: 'att-2', eventId, guestId: 'g-2', needsMeal: true, rsvpStatus: 'accepted' },
      { id: 'att-3', eventId, guestId: 'g-3', needsMeal: true, rsvpStatus: 'accepted' }
    );

    // Re-check diff -> hasChanges = true, identifies modifiedSections ['seating', 'catering']
    diff = await getHandoverDeltaDiff(db, snapshot.id);
    expect(diff.hasChanges).toBe(true);
    expect(diff.modifiedSections).toContain('seating');
    expect(diff.modifiedSections).toContain('catering');
    expect(diff.diffSummary).toContain('Chưa bàn giao lại');
  });

  it('records delivery of handover pack to recipient', async () => {
    const db = setupDb();
    const snapshot = await createHandoverSnapshot(db, {
      eventId,
      title: 'Bản chốt v1',
      scope: {
        includeTimeline: true,
        includeSeating: true,
        includeCatering: true,
        includeSupport: true,
        includeChecklist: true,
      },
    });

    const delivered = await deliverHandover(db, snapshot.id, {
      handedOverTo: 'Quản lý sảnh tiệc - Anh Hoàng',
      handedOverChannel: 'Trực tiếp tại sảnh',
    });

    expect(delivered.handoverStatus).toBe('handed_over');
    expect(delivered.handedOverTo).toBe('Quản lý sảnh tiệc - Anh Hoàng');
    expect(delivered.handedOverAt).toBeDefined();
    expect(delivered.handedOverChannel).toBe('Trực tiếp tại sảnh');
  });

  it('strips financial data when accessed via family_view (AT26, Edge Case 14)', async () => {
    const db = setupDb();
    // Snapshot with financial and private data in snapshotData
    db._store.handoverPackets.push({
      id: 'snap-family-test',
      eventId,
      version: 1,
      title: 'Bản in A4',
      scope: { includeTimeline: true, includeSeating: true },
      snapshotData: {
        timeline: [{ title: 'Lễ cưới' }],
        financials: { totalBudget: 500000000, totalCost: 450000000 },
        gifts: { totalGifts: 200000000 },
      },
      handoverStatus: 'draft',
      isSharedWithFamily: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const familyPack = await getHandoverPacket(db, 'snap-family-test', 'family_view');
    expect(familyPack.snapshotData.timeline).toBeDefined();
    // Financials and gifts must be completely stripped!
    expect((familyPack.snapshotData as any).financials).toBeUndefined();
    expect((familyPack.snapshotData as any).gifts).toBeUndefined();
  });
});
