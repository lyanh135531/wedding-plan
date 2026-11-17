import { z } from 'zod';
import {
  uuidSchema,
  versionSchema,
  dateTimeStringSchema,
  notesSchema,
} from './common';

// ============================================================================
// Enums & Types
// ============================================================================

export const PREPARATION_TYPES = ['idea', 'item', 'music', 'photo'] as const;
export const preparationTypeEnum = z.enum(PREPARATION_TYPES);
export type PreparationType = z.infer<typeof preparationTypeEnum>;

export const IDEA_STATUSES = ['reference', 'considering', 'decided', 'discarded'] as const;
export const ideaStatusEnum = z.enum(IDEA_STATUSES);
export type IdeaStatus = z.infer<typeof ideaStatusEnum>;

export const IDEA_CATEGORIES = ['style', 'decor', 'attire', 'other'] as const;
export const ideaCategoryEnum = z.enum(IDEA_CATEGORIES);
export type IdeaCategory = z.infer<typeof ideaCategoryEnum>;

export const ITEM_STATUSES = ['not_prepared', 'packed', 'brought', 'returned'] as const;
export const itemStatusEnum = z.enum(ITEM_STATUSES);
export type ItemStatus = z.infer<typeof itemStatusEnum>;

export const ITEM_PRIORITIES = ['low', 'medium', 'high'] as const;
export const itemPriorityEnum = z.enum(ITEM_PRIORITIES);
export type ItemPriority = z.infer<typeof itemPriorityEnum>;

export const PHOTO_PRIORITIES = ['must_have', 'nice_to_have'] as const;
export const photoPriorityEnum = z.enum(PHOTO_PRIORITIES);
export type PhotoPriority = z.infer<typeof photoPriorityEnum>;

export const CEREMONY_MOMENTS = [
  'guest_arrival',
  'entrance',
  'vows_rings',
  'toast',
  'first_dance',
  'party_games',
  'send_off',
] as const;
export const ceremonyMomentEnum = z.enum(CEREMONY_MOMENTS);
export type CeremonyMoment = z.infer<typeof ceremonyMomentEnum>;

// ============================================================================
// Safe External URL Schema (SSRF Prevention per PLAN §15, UI_UX_SPEC §7.8)
// ============================================================================

export const safeExternalUrlSchema = z
  .string()
  .trim()
  .url({ message: 'URL không đúng định dạng' })
  .refine(
    (url) => {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
        const hostname = parsed.hostname.toLowerCase();
        if (
          hostname === 'localhost' ||
          hostname === '127.0.0.1' ||
          hostname === '0.0.0.0' ||
          hostname === '169.254.169.254' ||
          hostname === '[::1]' ||
          hostname.endsWith('.internal') ||
          hostname.endsWith('.local')
        ) {
          return false;
        }
        return true;
      } catch {
        return false;
      }
    },
    { message: 'URL bên ngoài không hợp lệ hoặc thuộc dải mạng bị chặn' }
  );

export const nullableSafeExternalUrlSchema = z.preprocess(
  (val) => (typeof val === 'string' && val.trim() === '' ? null : val),
  safeExternalUrlSchema.nullable().optional()
);

// ============================================================================
// 1. Ideas Schemas (S22)
// ============================================================================

export const createIdeaSchema = z.object({
  eventId: uuidSchema,
  title: z.string().trim().min(1, { message: 'Tiêu đề ý tưởng không được để trống' }).max(255),
  category: z.string().trim().optional().nullable(),
  status: ideaStatusEnum.default('reference'),
  externalUrl: nullableSafeExternalUrlSchema,
  colorSwatches: z.array(z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, { message: 'Mã màu hex không hợp lệ' })).default([]),
  notes: notesSchema.optional().nullable(),
  linkedVendorId: uuidSchema.optional().nullable(),
  linkedTaskId: uuidSchema.optional().nullable(),
  isShared: z.boolean().default(false),
});

export interface CreateIdeaInput {
  eventId: string;
  title: string;
  category?: string | null;
  status?: IdeaStatus;
  externalUrl?: string | null;
  colorSwatches?: string[];
  notes?: string | null;
  linkedVendorId?: string | null;
  linkedTaskId?: string | null;
  isShared?: boolean;
}

export const updateIdeaSchema = z.object({
  title: z.string().trim().min(1, { message: 'Tiêu đề ý tưởng không được để trống' }).max(255).optional(),
  category: z.string().trim().optional().nullable(),
  status: ideaStatusEnum.optional(),
  externalUrl: nullableSafeExternalUrlSchema,
  colorSwatches: z.array(z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, { message: 'Mã màu hex không hợp lệ' })).optional(),
  notes: notesSchema.optional().nullable(),
  linkedVendorId: uuidSchema.optional().nullable(),
  linkedTaskId: uuidSchema.optional().nullable(),
  isShared: z.boolean().optional(),
  version: versionSchema.optional(),
});

export interface UpdateIdeaInput {
  title?: string;
  category?: string | null;
  status?: IdeaStatus;
  externalUrl?: string | null;
  colorSwatches?: string[];
  notes?: string | null;
  linkedVendorId?: string | null;
  linkedTaskId?: string | null;
  isShared?: boolean;
  version?: number;
}

export const previewIdeaPromotionSchema = z.object({
  ideaId: uuidSchema,
});
export type PreviewIdeaPromotionInput = z.infer<typeof previewIdeaPromotionSchema>;

// ============================================================================
// 2. Preparation Items Schemas (S23 Tab 1)
// ============================================================================

export const createPreparationItemSchema = z
  .object({
    eventId: uuidSchema,
    title: z.string().trim().min(1, { message: 'Tên đồ dùng không được để trống' }).max(255),
    category: z.string().trim().optional().nullable(),
    status: itemStatusEnum.default('not_prepared'),
    priority: itemPriorityEnum.default('medium'),
    quantity: z.number().int({ message: 'Số lượng phải là số nguyên' }).positive({ message: 'Số lượng phải lớn hơn 0' }).default(1),
    keeper: z.string().trim().optional().nullable(),
    location: z.string().trim().optional().nullable(),
    bringTime: z.string().trim().optional().nullable(),
    isRental: z.boolean().default(false),
    returnDueDate: z.string().optional().nullable(),
    notes: notesSchema.optional().nullable(),
    isShared: z.boolean().default(false),
  })
  .refine(
    (data) => {
      if (data.isRental) {
        return Boolean(data.returnDueDate && data.returnDueDate.trim().length > 0);
      }
      return true;
    },
    {
      message: 'Đồ thuê (isRental=true) bắt buộc phải có hạn trả (returnDueDate)',
      path: ['returnDueDate'],
    }
  );

export interface CreatePreparationItemInput {
  eventId: string;
  title: string;
  category?: string | null;
  status?: ItemStatus;
  priority?: ItemPriority | null;
  quantity?: number;
  keeper?: string | null;
  location?: string | null;
  bringTime?: string | null;
  isRental?: boolean;
  returnDueDate?: string | null;
  notes?: string | null;
  isShared?: boolean;
}

export const updatePreparationItemSchema = z
  .object({
    title: z.string().trim().min(1, { message: 'Tên đồ dùng không được để trống' }).max(255).optional(),
    category: z.string().trim().optional().nullable(),
    status: itemStatusEnum.optional(),
    priority: itemPriorityEnum.optional(),
    quantity: z.number().int({ message: 'Số lượng phải là số nguyên' }).positive({ message: 'Số lượng phải lớn hơn 0' }).optional(),
    keeper: z.string().trim().optional().nullable(),
    location: z.string().trim().optional().nullable(),
    bringTime: z.string().trim().optional().nullable(),
    isRental: z.boolean().optional(),
    returnDueDate: z.string().optional().nullable(),
    notes: notesSchema.optional().nullable(),
    isShared: z.boolean().optional(),
    version: versionSchema.optional(),
  })
  .refine(
    (data) => {
      if (data.isRental === true) {
        return Boolean(data.returnDueDate && data.returnDueDate.trim().length > 0);
      }
      return true;
    },
    {
      message: 'Đồ thuê (isRental=true) bắt buộc phải có hạn trả (returnDueDate)',
      path: ['returnDueDate'],
    }
  );

export interface UpdatePreparationItemInput {
  title?: string;
  category?: string | null;
  status?: ItemStatus;
  priority?: ItemPriority | null;
  quantity?: number;
  keeper?: string | null;
  location?: string | null;
  bringTime?: string | null;
  isRental?: boolean;
  returnDueDate?: string | null;
  notes?: string | null;
  isShared?: boolean;
  version?: number;
}

// ============================================================================
// 3. Music Playlist Schemas (S23 Tab 2)
// ============================================================================

export const createMusicTrackSchema = z.object({
  eventId: uuidSchema,
  title: z.string().trim().min(1, { message: 'Tên bài hát không được để trống' }).max(255),
  artist: z.string().trim().optional().nullable(),
  moment: z.string().trim().min(1, { message: 'Khoảnh khắc nghi lễ không được để trống' }),
  externalUrl: nullableSafeExternalUrlSchema,
  durationSeconds: z.number().int().nonnegative().optional().nullable(),
  cueNotes: z.string().trim().optional().nullable(),
  isBlacklisted: z.boolean().default(false),
  trackOrder: z.number().int().nonnegative().default(0),
  isShared: z.boolean().default(false),
});

export interface CreateMusicTrackInput {
  eventId: string;
  title: string;
  artist?: string | null;
  moment: string;
  externalUrl?: string | null;
  durationSeconds?: number | null;
  cueNotes?: string | null;
  isBlacklisted?: boolean;
  trackOrder?: number;
  isShared?: boolean;
}

export const updateMusicTrackSchema = z.object({
  title: z.string().trim().min(1, { message: 'Tên bài hát không được để trống' }).max(255).optional(),
  artist: z.string().trim().optional().nullable(),
  moment: z.string().trim().min(1).optional(),
  externalUrl: nullableSafeExternalUrlSchema,
  durationSeconds: z.number().int().nonnegative().optional().nullable(),
  cueNotes: z.string().trim().optional().nullable(),
  isBlacklisted: z.boolean().optional(),
  trackOrder: z.number().int().nonnegative().optional(),
  isShared: z.boolean().optional(),
  version: versionSchema.optional(),
});

export interface UpdateMusicTrackInput {
  title?: string;
  artist?: string | null;
  moment?: string;
  externalUrl?: string | null;
  durationSeconds?: number | null;
  cueNotes?: string | null;
  isBlacklisted?: boolean;
  trackOrder?: number;
  isShared?: boolean;
  version?: number;
}

export const reorderPlaylistSchema = z.object({
  eventId: uuidSchema,
  trackIds: z.array(uuidSchema).min(1, { message: 'Danh sách bài hát cần sắp xếp không được rỗng' }),
});
export type ReorderPlaylistInput = z.infer<typeof reorderPlaylistSchema>;

// ============================================================================
// 4. Photo Shot List Schemas (S23 Tab 3)
// ============================================================================

export const createPhotoShotSchema = z.object({
  eventId: uuidSchema,
  title: z.string().trim().min(1, { message: 'Tiêu đề cảnh chụp không được để trống' }).max(255),
  subjectGroup: z.string().trim().optional().nullable(),
  sessionName: z.string().trim().optional().nullable(),
  timeLocation: z.string().trim().optional().nullable(),
  priority: photoPriorityEnum.default('must_have'),
  gatheringLead: z.string().trim().optional().nullable(),
  notes: notesSchema.optional().nullable(),
  isShared: z.boolean().default(false),
});

export interface CreatePhotoShotInput {
  eventId: string;
  title: string;
  subjectGroup?: string | null;
  sessionName?: string | null;
  timeLocation?: string | null;
  priority?: PhotoPriority;
  gatheringLead?: string | null;
  notes?: string | null;
  isShared?: boolean;
}

export const updatePhotoShotSchema = z.object({
  title: z.string().trim().min(1, { message: 'Tiêu đề cảnh chụp không được để trống' }).max(255).optional(),
  subjectGroup: z.string().trim().optional().nullable(),
  sessionName: z.string().trim().optional().nullable(),
  timeLocation: z.string().trim().optional().nullable(),
  priority: photoPriorityEnum.optional(),
  gatheringLead: z.string().trim().optional().nullable(),
  notes: notesSchema.optional().nullable(),
  isExecuted: z.boolean().optional(),
  isShared: z.boolean().optional(),
  version: versionSchema.optional(),
});

export interface UpdatePhotoShotInput {
  title?: string;
  subjectGroup?: string | null;
  sessionName?: string | null;
  timeLocation?: string | null;
  priority?: PhotoPriority;
  gatheringLead?: string | null;
  notes?: string | null;
  isExecuted?: boolean;
  isShared?: boolean;
  version?: number;
}

export const handoverShotListSchema = z.object({
  handedOverAt: dateTimeStringSchema.optional(),
  recipient: z.string().trim().min(1, { message: 'Người nhận bàn giao không được để trống' }),
  channel: z.string().trim().optional().default('direct_handover'),
  notes: notesSchema.optional().nullable(),
});

export interface HandoverShotListInput {
  handedOverAt?: string;
  recipient: string;
  channel?: string;
  notes?: string | null;
}

// ============================================================================
// DTO Schemas
// ============================================================================

export const preparationItemDtoSchema = z.object({
  id: uuidSchema,
  eventId: uuidSchema,
  type: preparationTypeEnum,
  title: z.string(),
  category: z.string().nullable(),
  status: z.string(),
  priority: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  isRental: z.boolean(),
  returnDueDate: z.string().nullable(),
  isBlacklisted: z.boolean(),
  isShared: z.boolean(),
  version: z.number().int(),
  handedOverAt: z.string().nullable(),
  createdAt: dateTimeStringSchema,
  updatedAt: dateTimeStringSchema,
});
export type PreparationItemDto = z.infer<typeof preparationItemDtoSchema>;

export const preparationItemFamilyDtoSchema = z.object({
  id: uuidSchema,
  eventId: uuidSchema,
  type: preparationTypeEnum,
  title: z.string(),
  category: z.string().nullable(),
  status: z.string(),
  priority: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  isRental: z.boolean(),
  returnDueDate: z.string().nullable(),
  isBlacklisted: z.boolean(),
  isShared: z.literal(true),
  version: z.number().int(),
  handedOverAt: z.string().nullable(),
  createdAt: dateTimeStringSchema,
  updatedAt: dateTimeStringSchema,
});
export type PreparationItemFamilyDto = z.infer<typeof preparationItemFamilyDtoSchema>;
