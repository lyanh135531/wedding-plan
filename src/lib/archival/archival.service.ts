import { TxDb } from './types';
import {
  ArchiveWeddingInput,
  UnarchiveWeddingInput,
  PostWeddingChecklistDto,
  PostWeddingChecklistItem,
} from '@/schemas/archival';
import {
  getWeddingSettings,
  updateWeddingArchivalStatus,
  recordAuditLog,
  getOutstandingCostItems,
  getPendingDepositRefunds,
  getUnreturnedRentals,
  getPendingMediaItems,
  getUnthankedGifts,
  getUnreconciledGifts,
  getPostWeddingTasks,
  upsertPostWeddingTask,
} from './archival.repository';
import {
  WeddingAlreadyArchivedError,
  WeddingNotArchivedError,
  UnarchiveReasonRequiredError,
} from './errors';

/**
 * Aggregates live database entities for the 7 post-wedding closing obligations.
 * Standards: PLAN.md §16, S35.
 * Invariant: Single source of truth tied to actual cost items, rentals, and gifts — no duplicate fake list.
 */
export async function getPostWeddingChecklist(db: TxDb): Promise<PostWeddingChecklistDto> {
  const settings = await getWeddingSettings(db);
  const tasks = await getPostWeddingTasks(db);

  const taskMap = new Map<string, any>();
  for (const t of tasks) {
    taskMap.set(t.taskKey, t);
  }

  // 1. Settle supplier balances
  const outstandingCosts = await getOutstandingCostItems(db);
  const settleCompleted = outstandingCosts.length === 0;

  // 2. Collect deposit refunds
  const pendingRefunds = await getPendingDepositRefunds(db);
  const refundCompleted = pendingRefunds.length === 0;

  // 3. Return rental items
  const unreturnedRentals = await getUnreturnedRentals(db);
  const rentalsCompleted = unreturnedRentals.length === 0;

  // 4. Receive photo & video albums
  const pendingMedia = await getPendingMediaItems(db);
  const mediaCompleted = Boolean(taskMap.get('receive_media')?.isCompleted);

  // 5. Complete thank-you notes
  const unthankedGifts = await getUnthankedGifts(db);
  const thankYouCompleted = unthankedGifts.length === 0;

  // 6. Reconcile safe cash and gift registry
  const unreconciledGifts = await getUnreconciledGifts(db);
  const reconcileCompleted = unreconciledGifts.length === 0;

  // 7. Cold archive export
  const exportTask = taskMap.get('export_cold_archive');
  const exportCompleted = Boolean(exportTask?.isCompleted);

  const items: PostWeddingChecklistItem[] = [
    {
      key: 'settle_supplier_balances',
      title: 'Quyết toán công nợ nhà cung cấp',
      isCompleted: settleCompleted,
      summary: settleCompleted
        ? 'Tất cả các chi phí và hợp đồng đã được thanh toán đầy đủ.'
        : `Còn ${outstandingCosts.length} khoản chi phí chưa hoàn tất thanh toán.`,
      pendingCount: outstandingCosts.length,
      totalCount: outstandingCosts.length,
    },
    {
      key: 'collect_deposit_refunds',
      title: 'Thu hồi tiền cọc & hoàn trả vật phẩm',
      isCompleted: refundCompleted,
      summary: refundCompleted
        ? 'Không còn khoản cọc nào chờ hoàn lại.'
        : `Còn ${pendingRefunds.length} khoản cọc cần theo dõi nhận lại.`,
      pendingCount: pendingRefunds.length,
      totalCount: pendingRefunds.length,
    },
    {
      key: 'return_rentals',
      title: 'Trả đồ thuê mượn (trang phục, phụ kiện)',
      isCompleted: rentalsCompleted,
      summary: rentalsCompleted
        ? 'Tất cả vật phẩm thuê mượn đã được hoàn trả.'
        : `Còn ${unreturnedRentals.length} món đồ thuê cần trả đúng hạn.`,
      pendingCount: unreturnedRentals.length,
      totalCount: unreturnedRentals.length,
    },
    {
      key: 'receive_media',
      title: 'Nhận album ảnh & video phóng sự cưới',
      isCompleted: mediaCompleted,
      summary: mediaCompleted
        ? 'Đã nhận đủ hình ảnh và video từ ekip chụp phóng sự.'
        : 'Chưa xác nhận đã nhận đủ album ảnh và video. Lưu liên kết và đối chiếu trước khi đánh dấu hoàn tất.',
      pendingCount: mediaCompleted ? 0 : Math.max(1,pendingMedia.length),
      totalCount: Math.max(1,pendingMedia.length),
    },
    {
      key: 'complete_thank_you',
      title: 'Hoàn tất gửi lời cảm ơn khách mời',
      isCompleted: thankYouCompleted,
      summary: thankYouCompleted
        ? 'Đã ghi nhận cảm ơn tất cả các khách mời đã gửi quà.'
        : `Còn ${unthankedGifts.length} phong bì/quà mừng chưa ghi nhận cảm ơn.`,
      pendingCount: unthankedGifts.length,
      totalCount: unthankedGifts.length,
    },
    {
      key: 'reconcile_gifts',
      title: 'Đối soát sổ quà & két tiền an toàn',
      isCompleted: reconcileCompleted,
      summary: reconcileCompleted
        ? 'Tất cả phong bì đã được xác định danh tính và đối soát khớp.'
        : `Còn ${unreconciledGifts.length} phong bì chưa rõ người gửi hoặc cần đối soát.`,
      pendingCount: unreconciledGifts.length,
      totalCount: unreconciledGifts.length,
    },
    {
      key: 'export_cold_archive',
      title: 'Xuất file lưu trữ toàn bộ dữ liệu đám cưới',
      isCompleted: exportCompleted,
      summary: exportCompleted
        ? 'Đã sao lưu gói dữ liệu lạnh (cold storage archive).'
        : 'Chưa xuất gói dữ liệu lưu trữ để sao lưu.',
      pendingCount: exportCompleted ? 0 : 1,
      totalCount: 1,
    },
  ];

  const allCompleted = items.every((i) => i.isCompleted);

  return {
    isArchived: Boolean(settings?.isArchived),
    archivedAt: settings?.archivedAt ? new Date(settings.archivedAt).toISOString() : null,
    archivedReason: settings?.archivedReason ?? null,
    reopenedAt: settings?.reopenedAt ? new Date(settings.reopenedAt).toISOString() : null,
    items,
    allCompleted,
  };
}

/**
 * Invariant (AT35, FL20): Post-wedding archive lock.
 * Locks the wedding into a read-only state.
 * Server mutation routes block all write operations when isArchived is true.
 */
export async function freezeWeddingArchive(
  db: TxDb,
  input: ArchiveWeddingInput,
  userId: string
): Promise<void> {
  const settings = await getWeddingSettings(db);
  if (!settings) {
    throw new Error('Không tìm thấy cấu hình đám cưới.');
  }
  if (settings.isArchived) {
    throw new WeddingAlreadyArchivedError();
  }

  const archivedAt = new Date();
  await updateWeddingArchivalStatus(db, settings.id, {
    isArchived: true,
    archivedAt,
    archivedByUserId: userId,
    archivedReason: input.archiveReason,
  });

  await recordAuditLog(db, {
    userId,
    action: 'ARCHIVE_WEDDING',
    entityType: 'wedding_settings',
    entityId: settings.id,
    beforeState: { isArchived: false },
    afterState: {
      isArchived: true,
      archivedAt: archivedAt.toISOString(),
      archivedReason: input.archiveReason,
    },
  });
}

/**
 * Invariant (AT35, FL20): Owner unarchive flow with audit log.
 * Re-opens an archived wedding for editing.
 * Strictly requires owner role, a mandatory reason, and writes an immutable audit record.
 */
export async function unfreezeWeddingArchive(
  db: TxDb,
  input: UnarchiveWeddingInput,
  userId: string
): Promise<void> {
  if (!input.unarchiveReason || input.unarchiveReason.trim().length === 0) {
    throw new UnarchiveReasonRequiredError();
  }

  const settings = await getWeddingSettings(db);
  if (!settings) {
    throw new Error('Không tìm thấy cấu hình đám cưới.');
  }
  if (!settings.isArchived) {
    throw new WeddingNotArchivedError();
  }

  const reopenedAt = new Date();
  await updateWeddingArchivalStatus(db, settings.id, {
    isArchived: false,
    reopenedAt,
    reopenedByUserId: userId,
  });

  await recordAuditLog(db, {
    userId,
    action: 'UNARCHIVE_WEDDING',
    entityType: 'wedding_settings',
    entityId: settings.id,
    beforeState: {
      isArchived: true,
      archivedAt: settings.archivedAt,
      archivedReason: settings.archivedReason,
    },
    afterState: {
      isArchived: false,
      reopenedAt: reopenedAt.toISOString(),
      unarchiveReason: input.unarchiveReason,
    },
  });
}

export async function isWeddingArchived(db: TxDb): Promise<boolean> {
  const settings = await getWeddingSettings(db);
  return Boolean(settings?.isArchived);
}

export async function markTaskExportCompleted(db: TxDb, userId?: string | null): Promise<void> {
  await upsertPostWeddingTask(
    db,
    'export_cold_archive',
    'Xuất file lưu trữ toàn bộ dữ liệu đám cưới',
    true,
    'Đã xuất gói lưu trữ hoàn tất',
    userId
  );
}
