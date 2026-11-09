import { z } from 'zod';
import {
  uuidSchema,
  versionSchema,
  emailSchema,
  requiredStringSchema,
  notesSchema,
  vndCurrencyStringSchema,
  dateTimeStringSchema,
} from './common';

/**
 * Enums Phân Quyền
 */
export const userRoleEnum = z.enum(['owner', 'family_view']);
export type UserRole = z.infer<typeof userRoleEnum>;

export const memberInviteStatusEnum = z.enum(['pending', 'accepted', 'revoked']);
export type MemberInviteStatus = z.infer<typeof memberInviteStatusEnum>;

/**
 * Hồ sơ người dùng (Profiles)
 */
export const profileDtoSchema = z.object({
  id: z.string().min(1),
  email: emailSchema,
  display_name: requiredStringSchema('Tên hiển thị', 100),
  role: userRoleEnum,
  created_at: dateTimeStringSchema,
  updated_at: dateTimeStringSchema,
});
export type ProfileDto = z.infer<typeof profileDtoSchema>;

/**
 * Cập nhật hồ sơ cá nhân
 */
export const updateProfileSchema = z.object({
  display_name: requiredStringSchema('Tên hiển thị', 100),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/**
 * Cài đặt đám cưới (Wedding Settings) — DTO Chủ sở hữu (Owner)
 * Xem được cả ngân sách mục tiêu và ngân sách dự phòng.
 */
export const weddingSettingsOwnerDtoSchema = z.object({
  id: uuidSchema,
  bride_name: requiredStringSchema('Tên cô dâu', 100),
  groom_name: requiredStringSchema('Tên chú rể', 100),
  short_title: z.string().trim().max(100).nullable().optional(),
  tentative_date_note: requiredStringSchema('Ghi chú ngày dự kiến', 255),
  is_date_confirmed: z.boolean(),
  representative_event_id: uuidSchema.nullable().optional(),
  budget_target: vndCurrencyStringSchema.nullable().optional(),
  contingency_budget: vndCurrencyStringSchema.nullable().optional(),
  version: versionSchema,
  created_at: dateTimeStringSchema,
  updated_at: dateTimeStringSchema,
});
export type WeddingSettingsOwnerDto = z.infer<typeof weddingSettingsOwnerDtoSchema>;

/**
 * Cài đặt đám cưới (Wedding Settings) — DTO Người nhà (Family View-only)
 * Tuyệt đối che giấu budget_target và contingency_budget (AT03, AT36).
 */
export const weddingSettingsFamilyDtoSchema = weddingSettingsOwnerDtoSchema.omit({
  budget_target: true,
  contingency_budget: true,
});
export type WeddingSettingsFamilyDto = z.infer<typeof weddingSettingsFamilyDtoSchema>;

/**
 * Cập nhật Cài đặt đám cưới (Chỉ Chủ sở hữu được quyền)
 */
export const updateWeddingSettingsSchema = z.object({
  bride_name: requiredStringSchema('Tên cô dâu', 100),
  groom_name: requiredStringSchema('Tên chú rể', 100),
  short_title: z.string().trim().max(100).nullable().optional(),
  tentative_date_note: requiredStringSchema('Ghi chú ngày dự kiến', 255),
  is_date_confirmed: z.boolean(),
  representative_event_id: uuidSchema.nullable().optional(),
  budget_target: vndCurrencyStringSchema.nullable().optional(),
  contingency_budget: vndCurrencyStringSchema.nullable().optional(),
  version: versionSchema,
});
export type UpdateWeddingSettingsInput = z.infer<typeof updateWeddingSettingsSchema>;

/**
 * Lời mời thành viên tham gia (Member Invites) — Chỉ Chủ sở hữu
 */
export const createMemberInviteSchema = z.object({
  email: emailSchema,
  role: userRoleEnum.default('family_view'),
  allowed_event_ids: z.array(uuidSchema).min(1, { message: 'Phải chọn ít nhất 1 buổi lễ cho người nhà' }),
});
export type CreateMemberInviteInput = z.infer<typeof createMemberInviteSchema>;

export const memberInviteDtoSchema = z.object({
  id: uuidSchema,
  email: emailSchema,
  role: userRoleEnum,
  allowed_event_ids: z.array(uuidSchema),
  expires_at: dateTimeStringSchema,
  invited_by_user_id: z.string().min(1),
  status: memberInviteStatusEnum,
  invite_link: z.string().url().optional(), // Chỉ sinh khi tạo mới
  created_at: dateTimeStringSchema,
});
export type MemberInviteDto = z.infer<typeof memberInviteDtoSchema>;

/**
 * Xác nhận chấp nhận lời mời (Verify Token)
 */
export const acceptMemberInviteSchema = z.object({
  token: requiredStringSchema('Token mời', 128),
});
export type AcceptMemberInviteInput = z.infer<typeof acceptMemberInviteSchema>;
