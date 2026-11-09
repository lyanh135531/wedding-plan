import { z } from 'zod';
import {
  uuidSchema,
  requiredStringSchema,
  dateTimeStringSchema,
} from './common';

/**
 * Enums Tệp Đính Kèm
 */
export const attachmentEntityTypeEnum = z.enum(['cost_item', 'vendor', 'wedding', 'task']);
export type AttachmentEntityType = z.infer<typeof attachmentEntityTypeEnum>;

export const processingStatusEnum = z.enum(['pending', 'ready', 'failed']);
export type ProcessingStatus = z.infer<typeof processingStatusEnum>;

export const imageVariantTypeEnum = z.enum(['thumbnail_320', 'preview_1600']);
export type ImageVariantType = z.infer<typeof imageVariantTypeEnum>;

/**
 * Danh sách MIME types được phép tải lên (AT39)
 */
export const ALLOWED_UPLOAD_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export const uploadMimeTypeEnum = z.enum(ALLOWED_UPLOAD_MIME_TYPES);

/**
 * Giới hạn kích thước tệp
 */
export const MAX_IMAGE_FILE_SIZE = 20 * 1024 * 1024; // 20 MiB
export const MAX_PDF_FILE_SIZE = 10 * 1024 * 1024;   // 10 MiB

/**
 * Metadata tệp đính kèm — DTO Chủ sở hữu (Owner)
 */
export const attachmentOwnerDtoSchema = z.object({
  id: uuidSchema,
  storage_key: z.string().min(1),
  original_name: requiredStringSchema('Tên tệp gốc', 255),
  mime_type: z.string().min(1),
  file_size_bytes: z.number().int().positive(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  checksum_sha256: z.string().length(64),
  is_private: z.boolean(),
  owner_only: z.boolean(),
  entity_type: attachmentEntityTypeEnum,
  entity_id: uuidSchema.nullable().optional(),
  processing_status: processingStatusEnum,
  error_message: z.string().nullable().optional(),
  uploader_user_id: z.string().min(1),
  created_at: dateTimeStringSchema,
  updated_at: dateTimeStringSchema,
});
export type AttachmentOwnerDto = z.infer<typeof attachmentOwnerDtoSchema>;

/**
 * Metadata tệp đính kèm — DTO Người nhà (Family View-only)
 * Chỉ hiển thị tệp có owner_only = false và is_private = false.
 * Không xem được file_size gốc hay storage_key máy chủ (AT41).
 */
export const attachmentFamilyDtoSchema = z.object({
  id: uuidSchema,
  original_name: requiredStringSchema('Tên tệp', 255),
  mime_type: z.string().min(1),
  entity_type: attachmentEntityTypeEnum,
  entity_id: uuidSchema.nullable().optional(),
  thumbnail_url: z.string().url().optional(),
  preview_url: z.string().url().optional(),
});
export type AttachmentFamilyDto = z.infer<typeof attachmentFamilyDtoSchema>;

/**
 * Schema kiểm tra tệp tải lên (Multipart Header & Metadata Validation)
 */
export const fileUploadHeaderSchema = z.object({
  content_type: uploadMimeTypeEnum,
  content_length: z.coerce.number().int().positive().max(MAX_IMAGE_FILE_SIZE, {
    message: 'Kích thước tệp vượt quá giới hạn tối đa cho phép',
  }),
  entity_type: attachmentEntityTypeEnum,
  entity_id: uuidSchema.nullable().optional(),
  owner_only: z.coerce.boolean().default(true),
});
export type FileUploadHeaderInput = z.infer<typeof fileUploadHeaderSchema>;
