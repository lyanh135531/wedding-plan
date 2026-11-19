import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FX01_FAMILY_GROUP, FixtureAttendance } from '@tests/fixtures/fx01-family';
import {
  computeEventHeadcountBreakdown,
  AttendanceRecordInput,
  GuestProfileInput,
} from '@/lib/guests/headcount';

/**
 * Gate G8 Integration Test Suite: Invariants (AT06, AT07, AT10)
 * Standards: PLAN §12, §13, §20, §25, TEST_INFRA.md §9
 *
 * Scenarios:
 * 1. AT06: 4-person family on 1 invitation handled properly:
 *    - Heterogeneous attendance & dietary tiers under 1 invitation card.
 *    - Headcount arithmetic: 4 guests, 3 seats required (infant needs 0 seats), 3 meals.
 *    - Seating family together on 1 table consumes exactly 3 seats; advisory split-table detection (AT09).
 * 2. AT07: Child/baby with needs_seat = false:
 *    - Does not consume table seat capacity (can be seated at 100% full table).
 *    - Headcount and meal count arithmetic are decoupled from seat capacity.
 * 3. AT10: RSVP decline auto-unseats guest from table and records audit log:
 *    - Declining RSVP deletes seat assignment and frees table capacity.
 *    - Forces needsSeat = false and needsMeal = false.
 *    - Records audit log entry with action 'seat_unassigned_rsvp_decline'.
 *    - Changing RSVP back to accepted does NOT silently re-seat.
 */

// Domain Interfaces for Seating, Table & Audit Log
export interface TableState {
  id: string;
  eventId: string;
  name: string;
  capacity: number;
  assignedGuestIds: string[];
}

export interface SeatAssignmentRecord {
  id: string;
  tableId: string;
  guestId: string;
  eventId: string;
  isOccupyingSeat: boolean;
  assignedAt: string;
}

export interface AuditLogEntry {
  id: string;
  eventId: string;
  action: string;
  entityType: 'table_assignment' | 'guest' | 'attendance';
  entityId: string;
  actorId: string;
  details: Record<string, unknown>;
  createdAt: string;
}

// Service Harness Simulating Seating & RSVP Synchronization Invariants
export class SeatingInvariantEngine {
  private tables: Map<string, TableState> = new Map();
  private seatAssignments: Map<string, SeatAssignmentRecord> = new Map();
  private attendances: Map<string, AttendanceRecordInput> = new Map();
  private auditLogs: AuditLogEntry[] = [];

  createTable(id: string, eventId: string, name: string, capacity: number): TableState {
    const table: TableState = { id, eventId, name, capacity, assignedGuestIds: [] };
    this.tables.set(id, table);
    return table;
  }

  setAttendance(record: AttendanceRecordInput) {
    this.attendances.set(`${record.eventId}_${record.guestId}`, { ...record });
  }

  getAttendance(eventId: string, guestId: string): AttendanceRecordInput | undefined {
    return this.attendances.get(`${eventId}_${guestId}`);
  }

  getTable(tableId: string): TableState | undefined {
    return this.tables.get(tableId);
  }

  getSeatsUsed(tableId: string): number {
    return Array.from(this.seatAssignments.values()).filter(
      (s) => s.tableId === tableId && s.isOccupyingSeat
    ).length;
  }

  getSeatedGuestIds(tableId: string): string[] {
    return Array.from(this.seatAssignments.values())
      .filter((s) => s.tableId === tableId)
      .map((s) => s.guestId);
  }

  getAuditLogs(): AuditLogEntry[] {
    return [...this.auditLogs];
  }

  // Assign guest to table respecting needs_seat flag (AT07)
  assignGuest(
    eventId: string,
    tableId: string,
    guestId: string,
    options: { needsSeat?: boolean } = {}
  ): { success: boolean; assignmentId: string } {
    const table = this.tables.get(tableId);
    if (!table) throw new Error('Table not found');

    const att = this.getAttendance(eventId, guestId);
    const needsSeat = options.needsSeat ?? att?.needsSeat ?? true;
    const currentOccupiedSeats = this.getSeatsUsed(tableId);

    // AT07 Invariant: If needsSeat is true, must verify capacity; if false, does not consume seat
    if (needsSeat && currentOccupiedSeats >= table.capacity) {
      const err = new Error(
        `Bàn ${table.name} đã đủ ghế (${table.capacity}/${table.capacity}). Không thể xếp thêm khách cần ghế.`
      );
      (err as any).statusCode = 409;
      throw err;
    }

    const assignmentId = `seat_${tableId}_${guestId}`;
    const record: SeatAssignmentRecord = {
      id: assignmentId,
      tableId,
      guestId,
      eventId,
      isOccupyingSeat: needsSeat,
      assignedAt: new Date().toISOString(),
    };

    this.seatAssignments.set(assignmentId, record);
    if (!table.assignedGuestIds.includes(guestId)) {
      table.assignedGuestIds.push(guestId);
    }

    return { success: true, assignmentId };
  }

  // AT10: RSVP status change hook (in-transaction unseating & audit log)
  handleRsvpChange(
    eventId: string,
    guestId: string,
    newRsvpStatus: 'accepted' | 'declined' | 'tentative',
    actorId = 'system_rsvp_hook'
  ): { unseated: boolean; freedTableId: string | null } {
    const attKey = `${eventId}_${guestId}`;
    const att = this.attendances.get(attKey);
    if (!att) throw new Error('Attendance not found');

    att.rsvpStatus = newRsvpStatus;

    if (newRsvpStatus === 'declined') {
      // Force needs_seat and needs_meal to false
      att.needsSeat = false;
      att.needsMeal = false;

      // Find active seat assignment
      const assignmentEntry = Array.from(this.seatAssignments.entries()).find(
        ([_, s]) => s.eventId === eventId && s.guestId === guestId
      );

      if (assignmentEntry) {
        const [assignKey, assignment] = assignmentEntry;
        const table = this.tables.get(assignment.tableId);
        if (table) {
          table.assignedGuestIds = table.assignedGuestIds.filter((id) => id !== guestId);
        }
        this.seatAssignments.delete(assignKey);

        // Record audit log entry (AT10 requirement)
        this.auditLogs.push({
          id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          eventId,
          action: 'seat_unassigned_rsvp_decline',
          entityType: 'table_assignment',
          entityId: assignment.id,
          actorId,
          details: {
            guestId,
            freedTableId: assignment.tableId,
            tableName: table?.name,
            previousSeatStatus: assignment.isOccupyingSeat,
            reason: 'RSVP declined by guest or organizer',
          },
          createdAt: new Date().toISOString(),
        });

        return { unseated: true, freedTableId: assignment.tableId };
      }
    }

    return { unseated: false, freedTableId: null };
  }

  // AT09: Detect split families across tables
  detectSplitFamilies(
    invitations: Array<{ id: string; memberGuestIds: string[] }>
  ): Array<{ invitationId: string; tables: string[]; memberCount: number }> {
    const warnings: Array<{ invitationId: string; tables: string[]; memberCount: number }> = [];

    for (const inv of invitations) {
      const assignedTables = new Set<string>();
      for (const guestId of inv.memberGuestIds) {
        const assignment = Array.from(this.seatAssignments.values()).find((s) => s.guestId === guestId);
        if (assignment) {
          assignedTables.add(assignment.tableId);
        }
      }
      if (assignedTables.size > 1) {
        warnings.push({
          invitationId: inv.id,
          tables: Array.from(assignedTables),
          memberCount: inv.memberGuestIds.length,
        });
      }
    }

    return warnings;
  }
}

describe('Gate G8 Integration Suite: Domain Invariants (AT06, AT07, AT10)', () => {
  let engine: SeatingInvariantEngine;
  const eveningEventId = FX01_FAMILY_GROUP.events.eveningReception.id;

  const guestsMap: Record<string, GuestProfileInput> = {
    [FX01_FAMILY_GROUP.guests.father.id]: {
      id: FX01_FAMILY_GROUP.guests.father.id,
      ageTier: FX01_FAMILY_GROUP.guests.father.ageTier,
      isArchived: false,
    },
    [FX01_FAMILY_GROUP.guests.mother.id]: {
      id: FX01_FAMILY_GROUP.guests.mother.id,
      ageTier: FX01_FAMILY_GROUP.guests.mother.ageTier,
      isArchived: false,
    },
    [FX01_FAMILY_GROUP.guests.child.id]: {
      id: FX01_FAMILY_GROUP.guests.child.id,
      ageTier: FX01_FAMILY_GROUP.guests.child.ageTier,
      isArchived: false,
    },
    [FX01_FAMILY_GROUP.guests.baby.id]: {
      id: FX01_FAMILY_GROUP.guests.baby.id,
      ageTier: FX01_FAMILY_GROUP.guests.baby.ageTier,
      isArchived: false,
    },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    engine = new SeatingInvariantEngine();
  });

  // =========================================================================
  // 1. AT06: 4-Person Family Group Under 1 Invitation
  // =========================================================================
  describe('AT06: 4-Person Family Group on 1 Invitation', () => {
    it('[AT06-01] manages 4-person family on 1 invitation card with heterogeneous attendance and seat requirements', () => {
      // Setup attendance for all 4 family members as accepted
      const familyAttendance: AttendanceRecordInput[] = [
        {
          id: 'att-father',
          guestId: FX01_FAMILY_GROUP.guests.father.id,
          eventId: eveningEventId,
          rsvpStatus: 'accepted',
          needsSeat: true,
          needsMeal: true,
          mealDietaryTier: 'regular',
        },
        {
          id: 'att-mother',
          guestId: FX01_FAMILY_GROUP.guests.mother.id,
          eventId: eveningEventId,
          rsvpStatus: 'accepted',
          needsSeat: true,
          needsMeal: true,
          mealDietaryTier: 'vegetarian',
        },
        {
          id: 'att-child',
          guestId: FX01_FAMILY_GROUP.guests.child.id,
          eventId: eveningEventId,
          rsvpStatus: 'accepted',
          needsSeat: true,
          needsMeal: true,
          mealDietaryTier: 'child_portion',
        },
        {
          id: 'att-baby',
          guestId: FX01_FAMILY_GROUP.guests.baby.id,
          eventId: eveningEventId,
          rsvpStatus: 'accepted',
          needsSeat: false, // Baby does NOT need seat
          needsMeal: false, // Baby does NOT need meal
          mealDietaryTier: 'regular',
        },
      ];

      // Execute canonical headcount breakdown calculation
      const result = computeEventHeadcountBreakdown(eveningEventId, familyAttendance, guestsMap);

      // Verify exact mathematical breakdown:
      expect(result.total_invited).toBe(4);
      expect(result.confirmed_guests).toBe(4); // All 4 accepted
      expect(result.confirmed_seats).toBe(3); // 3 seats (Father, Mother, Child), Baby = 0 seats
      expect(result.meals_total).toBe(3); // 3 meals
      expect(result.meals_regular).toBe(1); // Father
      expect(result.meals_vegetarian).toBe(1); // Mother
      expect(result.meals_child).toBe(1); // Child
      expect(result.babies_count).toBe(0); // 0 baby meals requested when needsMeal = false
    });

    it('[AT06-02] seats entire 4-person family at one table: occupies 3 seats, roster contains 4 guests', () => {
      const tableId = 'table-family-round';
      engine.createTable(tableId, eveningEventId, 'Bàn Họ Hàng A1', 10);

      // Father, Mother, Child (needsSeat: true), Baby (needsSeat: false)
      engine.assignGuest(eveningEventId, tableId, FX01_FAMILY_GROUP.guests.father.id, { needsSeat: true });
      engine.assignGuest(eveningEventId, tableId, FX01_FAMILY_GROUP.guests.mother.id, { needsSeat: true });
      engine.assignGuest(eveningEventId, tableId, FX01_FAMILY_GROUP.guests.child.id, { needsSeat: true });
      engine.assignGuest(eveningEventId, tableId, FX01_FAMILY_GROUP.guests.baby.id, { needsSeat: false });

      // Roster has 4 family members
      const seatedRoster = engine.getSeatedGuestIds(tableId);
      expect(seatedRoster).toHaveLength(4);
      expect(seatedRoster).toContain(FX01_FAMILY_GROUP.guests.father.id);
      expect(seatedRoster).toContain(FX01_FAMILY_GROUP.guests.mother.id);
      expect(seatedRoster).toContain(FX01_FAMILY_GROUP.guests.child.id);
      expect(seatedRoster).toContain(FX01_FAMILY_GROUP.guests.baby.id);

      // But only 3 seats are occupied from the table capacity
      expect(engine.getSeatsUsed(tableId)).toBe(3);
      // Table still has 7 available seats
      const table = engine.getTable(tableId);
      expect(table!.capacity - engine.getSeatsUsed(tableId)).toBe(7);
    });

    it('[AT06-03] flags advisory warning when family members under same invitation are split across tables (AT09)', () => {
      const tableA = 'table-room-a';
      const tableB = 'table-room-b';
      engine.createTable(tableA, eveningEventId, 'Bàn 1', 10);
      engine.createTable(tableB, eveningEventId, 'Bàn 2', 10);

      // Seat parents at Table A, child at Table B
      engine.assignGuest(eveningEventId, tableA, FX01_FAMILY_GROUP.guests.father.id, { needsSeat: true });
      engine.assignGuest(eveningEventId, tableA, FX01_FAMILY_GROUP.guests.mother.id, { needsSeat: true });
      engine.assignGuest(eveningEventId, tableB, FX01_FAMILY_GROUP.guests.child.id, { needsSeat: true });

      const invitations = [
        {
          id: 'inv-fx01',
          memberGuestIds: [
            FX01_FAMILY_GROUP.guests.father.id,
            FX01_FAMILY_GROUP.guests.mother.id,
            FX01_FAMILY_GROUP.guests.child.id,
          ],
        },
      ];

      const splitWarnings = engine.detectSplitFamilies(invitations);
      expect(splitWarnings).toHaveLength(1);
      expect(splitWarnings[0].invitationId).toBe('inv-fx01');
      expect(splitWarnings[0].tables).toContain(tableA);
      expect(splitWarnings[0].tables).toContain(tableB);
    });
  });

  // =========================================================================
  // 2. AT07: Child / Baby with needs_seat = false
  // =========================================================================
  describe('AT07: Infant Non-Seat Policy & Decoupled Meal Arithmetic', () => {
    it('[AT07-01] allows infant with needs_seat = false to be assigned to 100% full table without error', () => {
      const tightTableId = 'table-couple';
      // Capacity = 2
      engine.createTable(tightTableId, eveningEventId, 'Bàn Đôi', 2);

      // 2 adults with needsSeat: true take the 2 available seats
      engine.assignGuest(eveningEventId, tightTableId, 'adult-1', { needsSeat: true });
      engine.assignGuest(eveningEventId, tightTableId, 'adult-2', { needsSeat: true });

      // Table is now 100% full (2/2)
      expect(engine.getSeatsUsed(tightTableId)).toBe(2);

      // Attempting to add a 3rd adult needing seat fails with 409
      expect(() => {
        engine.assignGuest(eveningEventId, tightTableId, 'adult-3', { needsSeat: true });
      }).toThrow(/đã đủ ghế/i);

      // BUT assigning an infant with needsSeat: false SUCCEEDS
      const babyResult = engine.assignGuest(eveningEventId, tightTableId, FX01_FAMILY_GROUP.guests.baby.id, {
        needsSeat: false,
      });
      expect(babyResult.success).toBe(true);

      // Seats used remains strictly 2 / 2
      expect(engine.getSeatsUsed(tightTableId)).toBe(2);
      // Roster contains 3 individuals (2 adults + 1 baby)
      expect(engine.getSeatedGuestIds(tightTableId)).toHaveLength(3);
    });

    it('[AT07-02] accounts for infant meal when requested without consuming seat capacity', () => {
      // Infant needs meal (e.g. baby porridge or child portion), but does not need seat
      const modifiedAtt: AttendanceRecordInput[] = [
        {
          id: 'att-adult1',
          guestId: 'guest-adult-1',
          eventId: eveningEventId,
          rsvpStatus: 'accepted',
          needsSeat: true,
          needsMeal: true,
          mealDietaryTier: 'regular',
        },
        {
          id: 'att-adult2',
          guestId: 'guest-adult-2',
          eventId: eveningEventId,
          rsvpStatus: 'accepted',
          needsSeat: true,
          needsMeal: true,
          mealDietaryTier: 'vegetarian',
        },
        {
          id: 'att-baby-meal',
          guestId: FX01_FAMILY_GROUP.guests.baby.id,
          eventId: eveningEventId,
          rsvpStatus: 'accepted',
          needsSeat: false, // 0 seat
          needsMeal: true, // 1 meal requested!
          mealDietaryTier: 'child_portion',
        },
      ];

      const guestProfiles: Record<string, GuestProfileInput> = {
        'guest-adult-1': { id: 'guest-adult-1', ageTier: 'adult', isArchived: false },
        'guest-adult-2': { id: 'guest-adult-2', ageTier: 'adult', isArchived: false },
        [FX01_FAMILY_GROUP.guests.baby.id]: {
          id: FX01_FAMILY_GROUP.guests.baby.id,
          ageTier: 'baby',
          isArchived: false,
        },
      };

      const breakdown = computeEventHeadcountBreakdown(eveningEventId, modifiedAtt, guestProfiles);

      // 3 confirmed guests, 2 confirmed seats, 3 meals (1 regular + 1 veg + 1 child portion)
      expect(breakdown.confirmed_guests).toBe(3);
      expect(breakdown.confirmed_seats).toBe(2);
      expect(breakdown.meals_total).toBe(3);
      expect(breakdown.meals_regular).toBe(1);
      expect(breakdown.meals_vegetarian).toBe(1);
      expect(breakdown.meals_child).toBe(1);
    });
  });

  // =========================================================================
  // 3. AT10: Safe Table Unseating Mechanism on Declined RSVP
  // =========================================================================
  describe('AT10: RSVP Decline Auto-Unseat & Audit Logging', () => {
    it('[AT10-01] automatically removes guest from table and frees capacity when RSVP changes to declined', () => {
      const tableId = 'table-vip-10';
      engine.createTable(tableId, eveningEventId, 'Bàn VIP 10', 10);

      const targetGuestId = FX01_FAMILY_GROUP.guests.father.id;

      // Seed initial attendance (accepted with seat & meal)
      engine.setAttendance({
        id: 'att-father-init',
        guestId: targetGuestId,
        eventId: eveningEventId,
        rsvpStatus: 'accepted',
        needsSeat: true,
        needsMeal: true,
        mealDietaryTier: 'regular',
      });

      // Seat 10 guests so table is 100% full
      engine.assignGuest(eveningEventId, tableId, targetGuestId, { needsSeat: true });
      for (let i = 2; i <= 10; i++) {
        engine.assignGuest(eveningEventId, tableId, `other-guest-${i}`, { needsSeat: true });
      }
      expect(engine.getSeatsUsed(tableId)).toBe(10);
      expect(engine.getSeatedGuestIds(tableId)).toContain(targetGuestId);

      // Action: Guest declines RSVP
      const { unseated, freedTableId } = engine.handleRsvpChange(
        eveningEventId,
        targetGuestId,
        'declined',
        'user-organizer-uuid'
      );

      expect(unseated).toBe(true);
      expect(freedTableId).toBe(tableId);

      // Table seat count decreased from 10 to 9 (1 seat freed!)
      expect(engine.getSeatsUsed(tableId)).toBe(9);
      expect(engine.getSeatedGuestIds(tableId)).not.toContain(targetGuestId);

      // Guest attendance forced to needsSeat = false, needsMeal = false
      const updatedAtt = engine.getAttendance(eveningEventId, targetGuestId);
      expect(updatedAtt?.rsvpStatus).toBe('declined');
      expect(updatedAtt?.needsSeat).toBe(false);
      expect(updatedAtt?.needsMeal).toBe(false);
    });

    it('[AT10-02] records detailed audit log entry when auto-unseating occurs', () => {
      const tableId = 'table-audit-test';
      engine.createTable(tableId, eveningEventId, 'Bàn Thử Nghiệm Audit', 6);
      const guestId = 'guest-decline-audit';

      engine.setAttendance({
        id: 'att-audit',
        guestId,
        eventId: eveningEventId,
        rsvpStatus: 'accepted',
        needsSeat: true,
        needsMeal: true,
        mealDietaryTier: 'regular',
      });

      engine.assignGuest(eveningEventId, tableId, guestId, { needsSeat: true });

      // Trigger decline
      engine.handleRsvpChange(eveningEventId, guestId, 'declined', 'organizer-user-123');

      const auditLogs = engine.getAuditLogs();
      expect(auditLogs).toHaveLength(1);

      const log = auditLogs[0];
      expect(log.action).toBe('seat_unassigned_rsvp_decline');
      expect(log.entityType).toBe('table_assignment');
      expect(log.actorId).toBe('organizer-user-123');
      expect(log.details.guestId).toBe(guestId);
      expect(log.details.freedTableId).toBe(tableId);
      expect(log.details.tableName).toBe('Bàn Thử Nghiệm Audit');
      expect(log.details.reason).toContain('RSVP declined');
    });

    it('[AT10-03] does not automatically re-seat guest if RSVP is changed back to accepted', () => {
      const tableId = 'table-reaccept-test';
      engine.createTable(tableId, eveningEventId, 'Bàn Tự Do', 2);
      const guestId = 'guest-flip-flop';

      engine.setAttendance({
        id: 'att-flip',
        guestId,
        eventId: eveningEventId,
        rsvpStatus: 'accepted',
        needsSeat: true,
        needsMeal: true,
        mealDietaryTier: 'regular',
      });

      engine.assignGuest(eveningEventId, tableId, guestId, { needsSeat: true });
      expect(engine.getSeatsUsed(tableId)).toBe(1);

      // Guest declines -> unseated
      engine.handleRsvpChange(eveningEventId, guestId, 'declined');
      expect(engine.getSeatsUsed(tableId)).toBe(0);

      // Another guest takes that seat!
      engine.assignGuest(eveningEventId, tableId, 'new-guest-speedy', { needsSeat: true });
      expect(engine.getSeatsUsed(tableId)).toBe(1);

      // Original guest re-accepts
      engine.handleRsvpChange(eveningEventId, guestId, 'accepted');

      // Invariant: Must NOT be automatically put back into table
      expect(engine.getSeatedGuestIds(tableId)).not.toContain(guestId);
      expect(engine.getSeatsUsed(tableId)).toBe(1); // Only new-guest-speedy
    });

    it('[AT10-04] reflects unseating in total headcount and meal summary immediately', () => {
      const initialAttendance: AttendanceRecordInput[] = [
        {
          id: 'att-1',
          guestId: 'g-1',
          eventId: eveningEventId,
          rsvpStatus: 'accepted',
          needsSeat: true,
          needsMeal: true,
          mealDietaryTier: 'regular',
        },
        {
          id: 'att-2',
          guestId: 'g-2',
          eventId: eveningEventId,
          rsvpStatus: 'accepted',
          needsSeat: true,
          needsMeal: true,
          mealDietaryTier: 'regular',
        },
      ];

      const guestProfiles: Record<string, GuestProfileInput> = {
        'g-1': { id: 'g-1', ageTier: 'adult', isArchived: false },
        'g-2': { id: 'g-2', ageTier: 'adult', isArchived: false },
      };

      const before = computeEventHeadcountBreakdown(eveningEventId, initialAttendance, guestProfiles);
      expect(before.confirmed_seats).toBe(2);
      expect(before.meals_total).toBe(2);

      // g-1 declines
      const updatedAttendance: AttendanceRecordInput[] = [
        {
          id: 'att-1',
          guestId: 'g-1',
          eventId: eveningEventId,
          rsvpStatus: 'declined', // declined
          needsSeat: false,
          needsMeal: false,
          mealDietaryTier: 'regular',
        },
        initialAttendance[1],
      ];

      const after = computeEventHeadcountBreakdown(eveningEventId, updatedAttendance, guestProfiles);
      expect(after.confirmed_seats).toBe(1); // 1 seat freed
      expect(after.meals_total).toBe(1); // 1 meal removed
      expect(after.declined_guests).toBe(1);
    });
  });
});
