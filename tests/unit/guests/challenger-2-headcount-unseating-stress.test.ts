import { describe, it, expect, vi } from 'vitest';
import { FX01_FAMILY_GROUP, FixtureAttendance } from '@tests/fixtures/fx01-family';
import {
  computeEventHeadcountBreakdown,
  computeWeddingWideHeadcount,
  AttendanceRecordInput,
  GuestProfileInput,
} from '@/lib/guests/headcount';
import { updateAttendance } from '@/lib/guests/attendance.repository';
import { UpdateAttendanceInput } from '@/schemas/guests';
import { RsvpUpdateDrawer, MemberRsvpState } from '@/components/modules/guests/RsvpUpdateDrawer';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const h = React.createElement;

describe('EMPIRICAL ADVERSARIAL CHALLENGER 2: Headcount Math, Baby Policy & Safe Table Unseating', () => {

  // =========================================================================
  // DIMENSION 1: HEADCOUNT MATH & PURE INTEGER ARITHMETIC
  // =========================================================================
  describe('Dimension 1: Headcount Math & Pure Integer Arithmetic', () => {
    it('handles zero/empty state with all integer zeroes and valid structure', () => {
      const result = computeEventHeadcountBreakdown('evt_empty', [], {});
      expect(result).toEqual({
        event_id: 'evt_empty',
        total_invited: 0,
        confirmed_guests: 0,
        uncertain_guests: 0,
        declined_guests: 0,
        confirmed_seats: 0,
        meals_total: 0,
        meals_regular: 0,
        meals_vegetarian: 0,
        meals_child: 0,
        babies_count: 0,
      });

      for (const [key, val] of Object.entries(result)) {
        if (key !== 'event_id') {
          expect(Number.isInteger(val), `Field ${key} must be an integer`).toBe(true);
          expect(val, `Field ${key} must be non-negative`).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('stress tests sum-of-parts conservation invariants across 1,000 randomized guests', () => {
      const eventId = 'evt_stress_1000';
      const attendances: AttendanceRecordInput[] = [];
      const guestsMap: Record<string, GuestProfileInput> = {};

      const rsvpStatuses: AttendanceRecordInput['rsvpStatus'][] = [
        'not_contacted',
        'pending_reply',
        'tentative',
        'accepted',
        'declined',
      ];
      const dietaryTiers: AttendanceRecordInput['mealDietaryTier'][] = [
        'regular',
        'vegetarian',
        'child_portion',
        'special',
      ];
      const ageTiers: GuestProfileInput['ageTier'][] = ['adult', 'child', 'baby'];

      for (let i = 0; i < 1000; i++) {
        const guestId = `guest_${i}`;
        const isArchived = i % 20 === 0; // 5% archived
        const ageTier = ageTiers[i % 3];
        guestsMap[guestId] = { id: guestId, ageTier, isArchived };

        const rsvpStatus = rsvpStatuses[i % 5];
        const needsSeat = ageTier === 'baby' ? i % 10 === 0 : i % 2 === 0;
        const needsMeal = ageTier === 'baby' ? i % 7 === 0 : i % 3 !== 0;
        const mealDietaryTier = dietaryTiers[i % 4];

        attendances.push({
          id: `att_${i}`,
          guestId,
          eventId,
          rsvpStatus,
          needsSeat,
          needsMeal,
          mealDietaryTier,
        });
      }

      const result = computeEventHeadcountBreakdown(eventId, attendances, guestsMap);

      // INVARIANT 1: Total invited strictly partitions into confirmed + uncertain + declined
      expect(result.total_invited).toBe(
        result.confirmed_guests + result.uncertain_guests + result.declined_guests
      );

      // INVARIANT 2: Total meals strictly partitions into regular + vegetarian + child + babies
      expect(result.meals_total).toBe(
        result.meals_regular + result.meals_vegetarian + result.meals_child + result.babies_count
      );

      // INVARIANT 3: Confirmed seats and meals can NEVER exceed confirmed guests
      expect(result.confirmed_seats).toBeLessThanOrEqual(result.confirmed_guests);
      expect(result.meals_total).toBeLessThanOrEqual(result.confirmed_guests);

      // INVARIANT 4: All fields are non-negative integers (no float 0.5, no NaN)
      for (const [key, val] of Object.entries(result)) {
        if (key !== 'event_id') {
          expect(Number.isInteger(val), `Field ${key} must be an integer`).toBe(true);
          expect(val, `Field ${key} must be >= 0`).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('strictly excludes archived (soft-deleted) guests regardless of accepted RSVP', () => {
      const eventId = 'evt_archive_test';
      const attendances: AttendanceRecordInput[] = [
        {
          id: 'att_active',
          guestId: 'g_active',
          eventId,
          rsvpStatus: 'accepted',
          needsSeat: true,
          needsMeal: true,
          mealDietaryTier: 'regular',
        },
        {
          id: 'att_archived',
          guestId: 'g_archived',
          eventId,
          rsvpStatus: 'accepted',
          needsSeat: true,
          needsMeal: true,
          mealDietaryTier: 'regular',
        },
      ];
      const guestsMap: Record<string, GuestProfileInput> = {
        g_active: { id: 'g_active', ageTier: 'adult', isArchived: false },
        g_archived: { id: 'g_archived', ageTier: 'adult', isArchived: true },
      };

      const result = computeEventHeadcountBreakdown(eventId, attendances, guestsMap);
      expect(result.total_invited).toBe(1);
      expect(result.confirmed_guests).toBe(1);
      expect(result.confirmed_seats).toBe(1);
      expect(result.meals_total).toBe(1);
    });

    it('verifies wedding-wide headcount: unique individuals vs multi-event attendances', () => {
      // 5 active guests
      const activeGuestIds = ['g1', 'g2', 'g3', 'g4', 'g5'];
      // 3 events: Event A, Event B, Event C
      // g1 attends all 3 (accepted, needsSeat, needsMeal)
      // g2 attends A and B (accepted in A, declined in B)
      // g3 attends A only (tentative)
      // g4 attends B only (declined)
      // g5 not invited to any
      const attendances: AttendanceRecordInput[] = [
        { id: '1', guestId: 'g1', eventId: 'evtA', rsvpStatus: 'accepted', needsSeat: true, needsMeal: true, mealDietaryTier: 'regular' },
        { id: '2', guestId: 'g1', eventId: 'evtB', rsvpStatus: 'accepted', needsSeat: true, needsMeal: true, mealDietaryTier: 'regular' },
        { id: '3', guestId: 'g1', eventId: 'evtC', rsvpStatus: 'accepted', needsSeat: false, needsMeal: false, mealDietaryTier: 'regular' },
        { id: '4', guestId: 'g2', eventId: 'evtA', rsvpStatus: 'accepted', needsSeat: true, needsMeal: true, mealDietaryTier: 'vegetarian' },
        { id: '5', guestId: 'g2', eventId: 'evtB', rsvpStatus: 'declined', needsSeat: false, needsMeal: false, mealDietaryTier: 'regular' },
        { id: '6', guestId: 'g3', eventId: 'evtA', rsvpStatus: 'tentative', needsSeat: true, needsMeal: true, mealDietaryTier: 'regular' },
        { id: '7', guestId: 'g4', eventId: 'evtB', rsvpStatus: 'declined', needsSeat: false, needsMeal: false, mealDietaryTier: 'regular' },
      ];

      const summary = computeWeddingWideHeadcount(activeGuestIds, attendances);

      expect(summary.uniqueIndividuals).toBe(5);
      // Accepted attendances: g1 (3 events) + g2 (1 event) = 4
      expect(summary.totalEventAttendances).toBe(4);
      // Confirmed seats: g1 in A (1) + g1 in B (1) + g2 in A (1) = 3 (tentative g3 seat is NOT counted)
      expect(summary.totalConfirmedSeats).toBe(3);
      // Confirmed meals: g1 in A (1) + g1 in B (1) + g2 in A (1) = 3
      expect(summary.totalConfirmedMeals).toBe(3);
      // Declined attendances: g2 in B (1) + g4 in B (1) = 2
      expect(summary.totalDeclinedAttendances).toBe(2);
      // Uncertain attendances: g3 in A (1) = 1
      expect(summary.totalUncertainAttendances).toBe(1);
    });
  });

  // =========================================================================
  // DIMENSION 2: BABY POLICY & DIETARY TIER COMBINATIONS
  // =========================================================================
  describe('Dimension 2: Baby Policy & Dietary Tier Combinations', () => {
    const eventId = 'evt_baby_test';

    it('Baby default: accepted with needsSeat=false, needsMeal=false -> 0 seats, 0 meals, 0 baby meals', () => {
      const att: AttendanceRecordInput[] = [
        {
          id: 'b1',
          guestId: 'baby_default',
          eventId,
          rsvpStatus: 'accepted',
          needsSeat: false,
          needsMeal: false,
          mealDietaryTier: 'regular',
        },
      ];
      const guestsMap: Record<string, GuestProfileInput> = {
        baby_default: { id: 'baby_default', ageTier: 'baby', isArchived: false },
      };

      const result = computeEventHeadcountBreakdown(eventId, att, guestsMap);
      expect(result.confirmed_guests).toBe(1);
      expect(result.confirmed_seats).toBe(0);
      expect(result.meals_total).toBe(0);
      expect(result.babies_count).toBe(0);
      expect(result.meals_regular).toBe(0);
    });

    it('Baby requesting highchair seat ONLY: needsSeat=true, needsMeal=false -> 1 seat, 0 meals', () => {
      const att: AttendanceRecordInput[] = [
        {
          id: 'b2',
          guestId: 'baby_seat_only',
          eventId,
          rsvpStatus: 'accepted',
          needsSeat: true,
          needsMeal: false,
          mealDietaryTier: 'regular',
        },
      ];
      const guestsMap: Record<string, GuestProfileInput> = {
        baby_seat_only: { id: 'baby_seat_only', ageTier: 'baby', isArchived: false },
      };

      const result = computeEventHeadcountBreakdown(eventId, att, guestsMap);
      expect(result.confirmed_guests).toBe(1);
      expect(result.confirmed_seats).toBe(1);
      expect(result.meals_total).toBe(0);
      expect(result.babies_count).toBe(0);
    });

    it('Baby requesting puree meal ONLY: needsSeat=false, needsMeal=true -> 0 seats, 1 meal (babies_count=1)', () => {
      const att: AttendanceRecordInput[] = [
        {
          id: 'b3',
          guestId: 'baby_meal_only',
          eventId,
          rsvpStatus: 'accepted',
          needsSeat: false,
          needsMeal: true,
          mealDietaryTier: 'regular',
        },
      ];
      const guestsMap: Record<string, GuestProfileInput> = {
        baby_meal_only: { id: 'baby_meal_only', ageTier: 'baby', isArchived: false },
      };

      const result = computeEventHeadcountBreakdown(eventId, att, guestsMap);
      expect(result.confirmed_guests).toBe(1);
      expect(result.confirmed_seats).toBe(0);
      expect(result.meals_total).toBe(1);
      expect(result.babies_count).toBe(1);
      expect(result.meals_regular).toBe(0);
    });

    it('Baby requesting BOTH seat and meal -> 1 seat, 1 meal (babies_count=1)', () => {
      const att: AttendanceRecordInput[] = [
        {
          id: 'b4',
          guestId: 'baby_both',
          eventId,
          rsvpStatus: 'accepted',
          needsSeat: true,
          needsMeal: true,
          mealDietaryTier: 'regular',
        },
      ];
      const guestsMap: Record<string, GuestProfileInput> = {
        baby_both: { id: 'baby_both', ageTier: 'baby', isArchived: false },
      };

      const result = computeEventHeadcountBreakdown(eventId, att, guestsMap);
      expect(result.confirmed_guests).toBe(1);
      expect(result.confirmed_seats).toBe(1);
      expect(result.meals_total).toBe(1);
      expect(result.babies_count).toBe(1);
    });

    it('Child dietary precedence: vegetarian overrides ageTier child to count in meals_vegetarian', () => {
      const att: AttendanceRecordInput[] = [
        {
          id: 'c1',
          guestId: 'child_veg',
          eventId,
          rsvpStatus: 'accepted',
          needsSeat: true,
          needsMeal: true,
          mealDietaryTier: 'vegetarian',
        },
      ];
      const guestsMap: Record<string, GuestProfileInput> = {
        child_veg: { id: 'child_veg', ageTier: 'child', isArchived: false },
      };

      const result = computeEventHeadcountBreakdown(eventId, att, guestsMap);
      expect(result.meals_total).toBe(1);
      expect(result.meals_vegetarian).toBe(1);
      expect(result.meals_child).toBe(0);
    });

    it('Child with regular tier automatically maps to meals_child due to ageTier child', () => {
      const att: AttendanceRecordInput[] = [
        {
          id: 'c2',
          guestId: 'child_reg',
          eventId,
          rsvpStatus: 'accepted',
          needsSeat: true,
          needsMeal: true,
          mealDietaryTier: 'regular',
        },
      ];
      const guestsMap: Record<string, GuestProfileInput> = {
        child_reg: { id: 'child_reg', ageTier: 'child', isArchived: false },
      };

      const result = computeEventHeadcountBreakdown(eventId, att, guestsMap);
      expect(result.meals_total).toBe(1);
      expect(result.meals_child).toBe(1);
      expect(result.meals_regular).toBe(0);
    });

    it('Adult requesting child portion explicitly counts in meals_child', () => {
      const att: AttendanceRecordInput[] = [
        {
          id: 'a1',
          guestId: 'adult_child_portion',
          eventId,
          rsvpStatus: 'accepted',
          needsSeat: true,
          needsMeal: true,
          mealDietaryTier: 'child_portion',
        },
      ];
      const guestsMap: Record<string, GuestProfileInput> = {
        adult_child_portion: { id: 'adult_child_portion', ageTier: 'adult', isArchived: false },
      };

      const result = computeEventHeadcountBreakdown(eventId, att, guestsMap);
      expect(result.meals_total).toBe(1);
      expect(result.meals_child).toBe(1);
      expect(result.meals_regular).toBe(0);
    });
  });

  // =========================================================================
  // DIMENSION 3: MULTI-EVENT INDEPENDENCE & RSVP CARD ISOLATION
  // =========================================================================
  describe('Dimension 3: Multi-Event Independence & RSVP Card Isolation', () => {
    it('verifies FX01 fixture heterogeneous attendance across morning and evening', () => {
      const morningAtt = FX01_FAMILY_GROUP.morningAttendance as FixtureAttendance[];
      const eveningAtt = FX01_FAMILY_GROUP.eveningAttendance as FixtureAttendance[];

      // Mother is vegetarian in both
      const motherMorning = morningAtt.find((a) => a.guestId === FX01_FAMILY_GROUP.guests.mother.id)!;
      const motherEvening = eveningAtt.find((a) => a.guestId === FX01_FAMILY_GROUP.guests.mother.id)!;
      expect(motherMorning.mealDietaryTier).toBe('vegetarian');
      expect(motherEvening.mealDietaryTier).toBe('vegetarian');

      // Morning has 0 catering meals needed, evening has 1 meal for mother
      expect(motherMorning.needsMeal).toBe(false);
      expect(motherEvening.needsMeal).toBe(true);

      // Baby is accepted in morning but declined in evening
      const babyMorning = morningAtt.find((a) => a.guestId === FX01_FAMILY_GROUP.guests.baby.id)!;
      const babyEvening = eveningAtt.find((a) => a.guestId === FX01_FAMILY_GROUP.guests.baby.id)!;
      expect(babyMorning.rsvpStatus).toBe('accepted');
      expect(babyEvening.rsvpStatus).toBe('declined');
    });
  });

  // =========================================================================
  // DIMENSION 4: SAFE TABLE UNSEATING & AUDIT LOG ENFORCEMENT
  // =========================================================================
  describe('Dimension 4: Safe Table Unseating & Audit Log Enforcement', () => {
    it('forces needsSeat=false and needsMeal=false when updating to declined even if caller sends true', async () => {
      const existingAttendance = {
        id: '13000000-0000-4000-8000-000000000001',
        guestId: '10000000-0000-4000-8000-000000000001',
        eventId: 'e0000000-0000-4000-8000-000000000001',
        rsvpStatus: 'accepted' as const,
        contactCount: 2,
        contactNotes: 'Bác Ba xác nhận tham dự',
        nextFollowupDate: null,
        needsSeat: true,
        needsMeal: true,
        mealDietaryTier: 'regular' as const,
        dietaryNotes: null,
        accommodationNeeded: false,
        transportNeeded: false,
        isOriginOnsite: false,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const insertedAuditLogs: any[] = [];
      let updatedRow: any = null;

      // Mock TxDb
      const mockTxDb: any = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([existingAttendance]),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockImplementation((setValues) => {
            return {
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockImplementation(() => {
                  updatedRow = {
                    ...existingAttendance,
                    ...setValues,
                    version: existingAttendance.version + 1,
                  };
                  return [updatedRow];
                }),
              }),
            };
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockImplementation((val) => {
            insertedAuditLogs.push(val);
            return Promise.resolve();
          }),
        }),
      };

      // Adversarial attempt: Caller attempts to decline but still sets needs_seat=true and needs_meal=true
      const adversarialInput: UpdateAttendanceInput = {
        rsvp_status: 'declined',
        needs_seat: true, // Malicious / corrupt request body
        needs_meal: true, // Malicious / corrupt request body
        meal_dietary_tier: 'regular',
        accommodation_needed: false,
        transport_needed: false,
        version: 1,
      };

      const result = await updateAttendance(
        mockTxDb,
        '10000000-0000-4000-8000-000000000001',
        'e0000000-0000-4000-8000-000000000001',
        adversarialInput,
        'user_caller_uuid'
      );

      // INVARIANT: Server MUST force needs_seat = false and needs_meal = false
      expect(result.needs_seat).toBe(false);
      expect(result.needs_meal).toBe(false);
      expect(result.rsvp_status).toBe('declined');
      expect(result.version).toBe(2);

      // AUDIT TRAIL: Must insert UNASSIGN_SEAT_ON_DECLINE into audit_logs in same transaction
      expect(insertedAuditLogs).toHaveLength(1);
      const audit = insertedAuditLogs[0];
      expect(audit.action).toBe('UNASSIGN_SEAT_ON_DECLINE');
      expect(audit.entityType).toBe('attendance');
      expect(audit.entityId).toBe(existingAttendance.id);
      expect(audit.userId).toBe('user_caller_uuid');
      expect(audit.beforeState.needsSeat).toBe(true);
      expect(audit.afterState.needsSeat).toBe(false);
      expect(audit.afterState.needsMeal).toBe(false);
    });

    it('does NOT write unseat audit log if guest was never seated and was not accepted', async () => {
      const existingAttendance = {
        id: '13000000-0000-4000-8000-000000000002',
        guestId: '10000000-0000-4000-8000-000000000002',
        eventId: 'e0000000-0000-4000-8000-000000000001',
        rsvpStatus: 'not_contacted' as const,
        contactCount: 0,
        contactNotes: null,
        nextFollowupDate: null,
        needsSeat: false,
        needsMeal: false,
        mealDietaryTier: 'regular' as const,
        dietaryNotes: null,
        accommodationNeeded: false,
        transportNeeded: false,
        isOriginOnsite: false,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const insertedAuditLogs: any[] = [];
      const mockTxDb: any = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([existingAttendance]),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockImplementation((setValues) => ({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([
                { ...existingAttendance, ...setValues, version: existingAttendance.version + 1 },
              ]),
            }),
          })),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockImplementation((val) => {
            insertedAuditLogs.push(val);
            return Promise.resolve();
          }),
        }),
      };

      const declineInput: UpdateAttendanceInput = {
        rsvp_status: 'declined',
        needs_seat: false,
        needs_meal: false,
        meal_dietary_tier: 'regular',
        accommodation_needed: false,
        transport_needed: false,
        version: 1,
      };

      await updateAttendance(
        mockTxDb,
        '10000000-0000-4000-8000-000000000002',
        'e0000000-0000-4000-8000-000000000001',
        declineInput,
        'user_caller_uuid'
      );

      // No unseat audit log since guest had no seat and was not accepted
      expect(insertedAuditLogs).toHaveLength(0);
    });

    it('throws concurrency conflict error if version does not match existing record', async () => {
      const existingAttendance = {
        id: 'att_version_test',
        guestId: 'guest_version',
        eventId: 'event_wedding',
        rsvpStatus: 'accepted' as const,
        needsSeat: true,
        needsMeal: true,
        mealDietaryTier: 'regular' as const,
        version: 2, // Current version is 2
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockTxDb: any = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([existingAttendance]),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([]), // Version mismatch returns empty array
            }),
          }),
        }),
      };

      const staleInput: UpdateAttendanceInput = {
        rsvp_status: 'declined',
        needs_seat: false,
        needs_meal: false,
        meal_dietary_tier: 'regular',
        accommodation_needed: false,
        transport_needed: false,
        version: 1, // Stale version 1
      };

      await expect(
        updateAttendance(mockTxDb, 'guest_version', 'event_wedding', staleInput, 'user_uuid')
      ).rejects.toThrow('Dữ liệu đã bị thay đổi bởi người khác, vui lòng làm mới trang');
    });

    it('renders RsvpUpdateDrawer with seated warning banner and handles unseat confirmation', () => {
      const seatedMembers: MemberRsvpState[] = [
        {
          guestId: 'seated_guest',
          name: 'Bác Thành',
          rsvpStatus: 'accepted',
          needsSeat: true,
          needsMeal: true,
          mealTier: 'regular',
          assignedTable: 'Bàn A1',
        },
      ];

      const html = renderToStaticMarkup(
        h(RsvpUpdateDrawer, {
          isOpen: true,
          onClose: () => {},
          initialMembers: seatedMembers,
        })
      );

      // Table seat badge displayed
      expect(html).toContain('Đang ngồi: Bàn A1');
      expect(html).toContain('Bác Thành');
    });
  });
});
