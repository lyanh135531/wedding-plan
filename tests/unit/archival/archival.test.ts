import { describe, it, expect } from 'vitest';
import { createMockG10TxDb } from '../../helpers/g10-mock-db';
import {
  getPostWeddingChecklist,
  freezeWeddingArchive,
  unfreezeWeddingArchive,
  isWeddingArchived,
} from '@/lib/archival';
import {
  WeddingAlreadyArchivedError,
  WeddingNotArchivedError,
  UnarchiveReasonRequiredError,
} from '@/lib/archival/errors';

describe('Gate G10: Post-Wedding Closing Tasks & Archival Freeze (PLAN §16, AT35, FL20)', () => {
  const weddingId = '00000000-0000-4000-8000-000000000001';

  function setupDb(overrides: any = {}) {
    return createMockG10TxDb({
      weddingSettings: [
        {
          id: weddingId,
          brideName: 'Cô Dâu',
          groomName: 'Chú Rể',
          isArchived: false,
          ...overrides,
        },
      ],
      costItems: [
        { id: 'c-1', contractedAmount: 50000000, paidAmount: 40000000, status: 'confirmed' }, // 10M unpaid
      ],
      preparationItems: [
        { id: 'p-1', title: 'Váy cưới', isRental: true, status: 'in_use' }, // unreturned rental
      ],
      gifts: [
        { id: 'g-1', amount: 1000000, isThanked: false, isSenderIdentified: true, isVoided: false }, // unthanked
        { id: 'g-2', amount: 500000, isThanked: true, isSenderIdentified: false, isVoided: false }, // unidentified
      ],
      postWeddingTasks: [],
      auditLogs: [],
    });
  }

  it('evaluates the 7 post-wedding closing tasks against live database records', async () => {
    const db = setupDb();
    const checklist = await getPostWeddingChecklist(db);

    expect(checklist.items.length).toBe(7);
    expect(checklist.isArchived).toBe(false);
    expect(checklist.allCompleted).toBe(false);

    const settleItem = checklist.items.find((i) => i.key === 'settle_supplier_balances')!;
    expect(settleItem.isCompleted).toBe(false);
    expect(settleItem.pendingCount).toBe(1);

    const rentalItem = checklist.items.find((i) => i.key === 'return_rentals')!;
    expect(rentalItem.isCompleted).toBe(false);
    expect(rentalItem.pendingCount).toBe(1);

    const thankItem = checklist.items.find((i) => i.key === 'complete_thank_you')!;
    expect(thankItem.isCompleted).toBe(false);
    expect(thankItem.pendingCount).toBe(1);

    const reconcileItem = checklist.items.find((i) => i.key === 'reconcile_gifts')!;
    expect(reconcileItem.isCompleted).toBe(false);
    expect(reconcileItem.pendingCount).toBe(1);
  });

  it('locks wedding into read-only archive state and logs audit record (AT35, FL20)', async () => {
    const db = setupDb();
    expect(await isWeddingArchived(db)).toBe(false);

    await freezeWeddingArchive(
      db,
      {
        archiveReason: 'Đám cưới đã hoàn tất toàn bộ các thủ tục và quyết toán',
        confirmed: true,
      },
      'owner-user-1'
    );

    expect(await isWeddingArchived(db)).toBe(true);

    const settings = db._store.weddingSettings[0];
    expect(settings.isArchived).toBe(true);
    expect(settings.archivedAt).toBeDefined();
    expect(settings.archivedByUserId).toBe('owner-user-1');
    expect(settings.archivedReason).toBe('Đám cưới đã hoàn tất toàn bộ các thủ tục và quyết toán');

    // Audit log entry created
    const log = db._store.auditLogs.find((l) => l.action === 'ARCHIVE_WEDDING');
    expect(log).toBeDefined();
    expect(log.userId).toBe('owner-user-1');
  });

  it('rejects archival freeze if wedding is already archived', async () => {
    const db = setupDb({ isArchived: true });
    await expect(
      freezeWeddingArchive(
        db,
        { archiveReason: 'Khóa lại lần 2', confirmed: true },
        'owner-user-1'
      )
    ).rejects.toThrow(WeddingAlreadyArchivedError);
  });

  it('re-opens archived wedding with mandatory audit reason (AT35, FL20, Edge Case 16)', async () => {
    const db = setupDb({ isArchived: true, archivedAt: new Date(), archivedReason: 'Đã khóa' });

    // Reject unarchive without reason
    await expect(
      unfreezeWeddingArchive(db, { unarchiveReason: '' }, 'owner-user-1')
    ).rejects.toThrow(UnarchiveReasonRequiredError);

    // Unarchive with reason
    await unfreezeWeddingArchive(
      db,
      { unarchiveReason: 'Cần cập nhật hóa đơn phát sinh muộn từ nhà xe' },
      'owner-user-1'
    );

    expect(await isWeddingArchived(db)).toBe(false);
    const settings = db._store.weddingSettings[0];
    expect(settings.isArchived).toBe(false);
    expect(settings.reopenedAt).toBeDefined();
    expect(settings.reopenedByUserId).toBe('owner-user-1');

    // Audit log entry created
    const log = db._store.auditLogs.find((l) => l.action === 'UNARCHIVE_WEDDING');
    expect(log).toBeDefined();
    expect(log.userId).toBe('owner-user-1');
    expect(log.afterState.unarchiveReason).toBe('Cần cập nhật hóa đơn phát sinh muộn từ nhà xe');
  });
});
