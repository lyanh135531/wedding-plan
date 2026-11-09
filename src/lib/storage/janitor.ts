import { db } from '@/db/client';
import { attachments } from '@/db/schema/files';
import { lt, eq, and } from 'drizzle-orm';
import { getUploadRootDir, safeResolvePath, safeUnlinkFile } from './storage';

/**
 * Quét dọn các tệp mồ côi hoặc tác vụ treo pending quá hạn (> 24 giờ) (PLAN §17.1, RV11, AT42)
 */
export async function runStorageJanitorCleanup(): Promise<{
  reclaimedPending: number;
  purgedFailed: number;
}> {
  const rootUploadDir = getUploadRootDir();
  const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 giờ trước

  // 1. Tìm các bản ghi pending đã hết hạn lease quá 24 giờ
  const expiredPending = await db
    .select()
    .from(attachments)
    .where(
      and(
        eq(attachments.processingStatus, 'pending'),
        lt(attachments.leaseExpiresAt, cutoffTime)
      )
    );

  let reclaimedPending = 0;
  for (const item of expiredPending) {
    try {
      const filePath = safeResolvePath(rootUploadDir, item.storageKey);
      await safeUnlinkFile(filePath);
    } catch {
      // Bỏ qua lỗi path khi dọn tệp mồ côi
    }

    await db
      .update(attachments)
      .set({
        processingStatus: 'failed',
        errorMessage: 'Tác vụ hết hạn lease 24h và bị thu hồi bởi Janitor.',
        leaseExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(attachments.id, item.id));

    reclaimedPending++;
  }

  return {
    reclaimedPending,
    purgedFailed: 0,
  };
}
