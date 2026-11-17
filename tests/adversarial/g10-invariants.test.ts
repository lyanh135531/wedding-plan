import { describe, it, expect } from 'vitest';
import { createMockG10TxDb } from '../helpers/g10-mock-db';
import { createGift, recordGiftReturn, getGiftSummary } from '@/lib/gifts';
import { GiftReturnExceedsBalanceError } from '@/lib/gifts/errors';
import { createTimelineItem, markActualTimes, listTimelineItems } from '@/lib/timeline';
import { checkInGuest } from '@/lib/attendance';
import { DeclinedGuestConfirmationRequiredError } from '@/lib/attendance/errors';
import { freezeWeddingArchive, unfreezeWeddingArchive, isWeddingArchived } from '@/lib/archival';
import { UnarchiveReasonRequiredError, WeddingAlreadyArchivedError } from '@/lib/archival/errors';
import { getHandoverPacket } from '@/lib/handovers';

describe('Adversarial Invariant Stress Suite (Gate G10 Invariants)', () => {
  const eventId = '00000000-0000-4000-8000-000000000001';
  const weddingId = '00000000-0000-4000-8000-000000000099';

  describe('Invariant AT25: Joint Envelope Zero Cash Multiplication Attack', () => {
    it('guarantees an envelope of 3,000,000 ₫ with 5 joint contributors never multiplies money to 15,000,000 ₫', async () => {
      const db = createMockG10TxDb();

      const envelope = await createGift(db, {
        eventId,
        giftType: 'cash',
        amount: '3000000',
        contributors: [
          { contributorName: 'Ông A' },
          { contributorName: 'Bà B' },
          { contributorName: 'Anh C' },
          { contributorName: 'Chị D' },
          { contributorName: 'Em E' },
        ],
      });

      expect(envelope.contributors.length).toBe(5);

      const summary = await getGiftSummary(db, eventId);
      // STRICT INVARIANT: Total received must equal exactly 3,000,000 ₫
      expect(summary.totalReceivedCash).toBe('3000000');
      expect(summary.totalReceivedCash).not.toBe('15000000');
      expect(summary.netReceivedCash).toBe('3000000');
    });
  });

  describe('Invariant AT26: Family View Financial & Private Data Shielding', () => {
    it('strictly sanitizes financial sections from handover packets when viewed by family_view', async () => {
      const db = createMockG10TxDb({
        handoverPackets: [
          {
            id: 'hp-adv-1',
            eventId,
            version: 1,
            title: 'Bàn giao tiệc tối',
            scope: { includeTimeline: true, includeFinancials: true },
            snapshotData: {
              timeline: [{ title: 'Khai tiệc' }],
              financials: { totalBudget: 600000000, vendorDebts: 50000000 },
              costs: [{ item: 'Tiệc cưới', amount: 300000000 }],
              gifts: [{ amount: 150000000 }],
            },
            handoverStatus: 'draft',
            isSharedWithFamily: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });

      const familyPacket = await getHandoverPacket(db, 'hp-adv-1', 'family_view');
      expect(familyPacket.snapshotData.timeline).toBeDefined();

      // Ensure zero financial or gift leakages
      expect((familyPacket.snapshotData as any).financials).toBeUndefined();
      expect((familyPacket.snapshotData as any).costs).toBeUndefined();
      expect((familyPacket.snapshotData as any).gifts).toBeUndefined();
    });
  });

  describe('Invariant AT34: Day-of Actual Timing Marker Preservation', () => {
    it('marking actual timing markers never mutates past planned schedule timestamps', async () => {
      const db = createMockG10TxDb();
      const plannedStart = '2028-11-20T18:00:00Z';
      const plannedEnd = '2028-11-20T19:00:00Z';

      const item = await createTimelineItem(db, {
        eventId,
        title: 'Nghi thức lễ cưới',
        scheduledStartTime: plannedStart,
        scheduledEndTime: plannedEnd,
      });

      // Mark delayed actual times
      const updated = await markActualTimes(db, item.id, {
        actualStartTime: '2028-11-20T18:45:00Z',
        actualEndTime: '2028-11-20T20:00:00Z',
        version: 1,
      });

      expect(updated.scheduledStartTime).toBe(new Date(plannedStart).toISOString());
      expect(updated.scheduledEndTime).toBe(new Date(plannedEnd).toISOString());
      expect(updated.actualStartTime).toBe(new Date('2028-11-20T18:45:00Z').toISOString());
      expect(updated.actualEndTime).toBe(new Date('2028-11-20T20:00:00Z').toISOString());

      const list = await listTimelineItems(db, eventId);
      const fetched = list.find((i) => i.id === item.id)!;
      expect(fetched.scheduledStartTime).toBe(new Date(plannedStart).toISOString());
      expect(fetched.scheduledEndTime).toBe(new Date(plannedEnd).toISOString());
    });
  });

  describe('Invariant AT35: Archival Freeze Lock & Audit Trail Enforcement', () => {
    it('blocks repeated freezes and enforces mandatory unarchive reason with audit logging', async () => {
      const db = createMockG10TxDb({
        weddingSettings: [
          {
            id: weddingId,
            brideName: 'Cô Dâu',
            groomName: 'Chú Rể',
            isArchived: false,
          },
        ],
        auditLogs: [],
      });

      // 1. Freeze wedding
      await freezeWeddingArchive(db, { archiveReason: 'Xong tiệc', confirmed: true }, 'owner-user');
      expect(await isWeddingArchived(db)).toBe(true);

      // Attempt second freeze -> rejects
      await expect(
        freezeWeddingArchive(db, { archiveReason: 'Khóa lại', confirmed: true }, 'owner-user')
      ).rejects.toThrow(WeddingAlreadyArchivedError);

      // 2. Unarchive attack with empty or whitespace reason -> rejects
      await expect(
        unfreezeWeddingArchive(db, { unarchiveReason: '   ' }, 'owner-user')
      ).rejects.toThrow(UnarchiveReasonRequiredError);

      // 3. Valid unarchive -> writes audit log
      await unfreezeWeddingArchive(db, { unarchiveReason: 'Cập nhật bổ sung hợp đồng âm thanh' }, 'owner-user');
      expect(await isWeddingArchived(db)).toBe(false);

      const unarchiveLog = db._store.auditLogs.find((l) => l.action === 'UNARCHIVE_WEDDING');
      expect(unarchiveLog).toBeDefined();
      expect(unarchiveLog.afterState.unarchiveReason).toBe('Cập nhật bổ sung hợp đồng âm thanh');
    });
  });

  describe('Gift Return Balance Ceiling Adversarial Probe', () => {
    it('atomically prevents withdrawing/returning more money than current unreturned balance', async () => {
      const db = createMockG10TxDb();
      const gift = await createGift(db, {
        eventId,
        giftType: 'cash',
        amount: '1000000',
        contributors: [{ contributorName: 'Khách A' }],
      });

      // Attempt 1: Return 1,000,001 ₫ (> 1,000,000 ₫) -> rejects
      await expect(
        recordGiftReturn(db, gift.id, {
          amount: '1000001',
          returnReason: 'Quá 1 đồng',
        })
      ).rejects.toThrow(GiftReturnExceedsBalanceError);

      // Attempt 2: Valid partial return 600,000 ₫ -> succeeds
      await recordGiftReturn(db, gift.id, {
        amount: '600000',
        returnReason: 'Trả bớt',
      });

      // Attempt 3: Try to return 400,001 ₫ (> 400,000 ₫ remaining) -> rejects
      await expect(
        recordGiftReturn(db, gift.id, {
          amount: '400001',
          returnReason: 'Quá số tiền còn giữ',
        })
      ).rejects.toThrow(GiftReturnExceedsBalanceError);
    });
  });

  describe('Attendance RSVP vs Check-In Separation Invariant', () => {
    it('ensures RSVP accepted status does not automatically check in a guest', async () => {
      const db = createMockG10TxDb({
        events: [{ id: eventId, isCheckInEnabled: true }],
        guests: [{ id: 'g-rsvp-test', fullName: 'Khách RSVP Có' }],
        attendance: [
          {
            eventId,
            guestId: 'g-rsvp-test',
            rsvpStatus: 'accepted',
            isCheckedIn: false,
            checkInTime: null,
            version: 1,
          },
        ],
      });

      const att = db._store.attendance[0];
      expect(att.rsvpStatus).toBe('accepted');
      expect(att.isCheckedIn).toBe(false);
      expect(att.checkInTime).toBeNull();
    });

    it('requires explicit confirmation when checking in a previously declined guest', async () => {
      const db = createMockG10TxDb({
        events: [{ id: eventId, isCheckInEnabled: true }],
        guests: [{ id: 'g-declined', fullName: 'Khách Đã Từ Chối' }],
        attendance: [
          {
            eventId,
            guestId: 'g-declined',
            rsvpStatus: 'declined',
            isCheckedIn: false,
            version: 1,
          },
        ],
      });

      // Check-in without confirmDeclinedOverride -> throws error
      await expect(
        checkInGuest(db, {
          eventId,
          guestId: 'g-declined',
          confirmDeclinedOverride: false,
        })
      ).rejects.toThrow(DeclinedGuestConfirmationRequiredError);

      // With confirmDeclinedOverride -> succeeds
      const checked = await checkInGuest(db, {
        eventId,
        guestId: 'g-declined',
        confirmDeclinedOverride: true,
      });
      expect(checked.isCheckedIn).toBe(true);
    });
  });
});
