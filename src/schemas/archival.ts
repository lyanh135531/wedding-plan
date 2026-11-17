import { z } from 'zod';
import { uuidSchema, notesSchema } from './common';

export const POST_WEDDING_TASK_KEYS = [
  'settle_supplier_balances',
  'collect_deposit_refunds',
  'return_rentals',
  'receive_media',
  'complete_thank_you',
  'reconcile_gifts',
  'export_cold_archive',
] as const;
export const postWeddingTaskKeyEnum = z.enum(POST_WEDDING_TASK_KEYS);
export type PostWeddingTaskKey = z.infer<typeof postWeddingTaskKeyEnum>;

export const archiveWeddingSchema = z.object({
  archiveReason: z.string().trim().min(1, { message: 'Lý do chuyển sang lưu trữ là bắt buộc' }).max(500),
  confirmed: z.literal(true, {
    errorMap: () => ({ message: 'Xác nhận khóa lưu trữ là bắt buộc' }),
  }),
});
export type ArchiveWeddingInput = z.infer<typeof archiveWeddingSchema>;

export const unarchiveWeddingSchema = z.object({
  unarchiveReason: z.string().trim().min(1, { message: 'Lý do mở lại đám cưới là bắt buộc' }).max(500),
});
export type UnarchiveWeddingInput = z.infer<typeof unarchiveWeddingSchema>;

export const mediaVaultLinkSchema = z.object({
  title: z.string().trim().min(1, { message: 'Tiêu đề liên kết không được để trống' }).max(255),
  url: z.string().url({ message: 'Đường dẫn không hợp lệ' }).refine((url) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
      const host = parsed.hostname.toLowerCase();
      if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1') return false;
      if (host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.16.') || host.endsWith('.local')) return false;
      return true;
    } catch {
      return false;
    }
  }, { message: 'Đường dẫn liên kết không an toàn hoặc là địa chỉ mạng nội bộ' }),
  mediaType: z.enum(['photo_album', 'video_highlight', 'raw_footage', 'other']).default('photo_album'),
  notes: notesSchema.optional().nullable(),
});
export type MediaVaultLinkInput = z.infer<typeof mediaVaultLinkSchema>;

export const postWeddingChecklistItemSchema = z.object({
  key: postWeddingTaskKeyEnum,
  title: z.string(),
  isCompleted: z.boolean(),
  summary: z.string(),
  pendingCount: z.number(),
  totalCount: z.number(),
  details: z.any().optional(),
});
export type PostWeddingChecklistItem = z.infer<typeof postWeddingChecklistItemSchema>;

export const postWeddingChecklistDtoSchema = z.object({
  isArchived: z.boolean(),
  archivedAt: z.string().nullable(),
  archivedReason: z.string().nullable(),
  reopenedAt: z.string().nullable(),
  items: z.array(postWeddingChecklistItemSchema),
  allCompleted: z.boolean(),
});
export type PostWeddingChecklistDto = z.infer<typeof postWeddingChecklistDtoSchema>;
