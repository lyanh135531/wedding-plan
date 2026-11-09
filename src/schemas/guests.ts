import { z } from 'zod';
import {
  uuidSchema,
  versionSchema,
  requiredStringSchema,
  nullableVietnamesePhoneSchema,
  nullableEmailSchema,
  notesSchema,
  dateStringSchema,
  dateTimeStringSchema,
} from './common';

/**
 * Enums Khách Mời & Tham Dự
 */
export const guestSideEnum = z.enum(['groom', 'bride', 'mutual', 'unassigned']);
export type GuestSide = z.infer<typeof guestSideEnum>;

export const ageTierEnum = z.enum(['adult', 'child', 'baby']);
export type AgeTier = z.infer<typeof ageTierEnum>;

export const deliveryMethodEnum = z.enum(['paper', 'electronic', 'in_person']);
export type DeliveryMethod = z.infer<typeof deliveryMethodEnum>;

export const invitationStatusEnum = z.enum(['save_the_date', 'preparing', 'sent']);
export type InvitationStatus = z.infer<typeof invitationStatusEnum>;

export const rsvpStatusEnum = z.enum(['not_contacted', 'pending_reply', 'tentative', 'accepted', 'declined']);
export type RsvpStatus = z.infer<typeof rsvpStatusEnum>;

export const dietaryTierEnum = z.enum(['regular', 'vegetarian', 'child_portion', 'special']);
export type DietaryTier = z.infer<typeof dietaryTierEnum>;

/**
 * Nhóm quan hệ khách (Guest Groups)
 */
export const guestGroupDtoSchema = z.object({
  id: uuidSchema,
  name: requiredStringSchema('Tên nhóm', 100),
  side: guestSideEnum,
  sort_order: z.number().int().default(0),
  created_at: dateTimeStringSchema,
  updated_at: dateTimeStringSchema,
});
export type GuestGroupDto = z.infer<typeof guestGroupDtoSchema>;

export const createGuestGroupSchema = z.object({
  name: requiredStringSchema('Tên nhóm', 100),
  side: guestSideEnum.default('unassigned'),
  sort_order: z.number().int().default(0),
});
export type CreateGuestGroupInput = z.infer<typeof createGuestGroupSchema>;

/**
 * Hồ sơ khách (Guests) — DTO Chủ sở hữu (Owner)
 * Xem và chỉnh sửa đầy đủ thông tin liên hệ và ghi chú riêng tư.
 */
export const guestOwnerDtoSchema = z.object({
  id: uuidSchema,
  display_name: requiredStringSchema('Tên khách', 100),
  side: guestSideEnum,
  group_id: uuidSchema.nullable().optional(),
  sub_tags: z.array(z.string().trim()).default([]),
  age_tier: ageTierEnum,
  phone: nullableVietnamesePhoneSchema,
  email: nullableEmailSchema,
  address: z.string().trim().max(255).nullable().optional(),
  private_notes: notesSchema,
  is_archived: z.boolean(),
  archived_at: dateTimeStringSchema.nullable().optional(),
  is_placeholder: z.boolean(),
  placeholder_for: z.string().trim().max(100).nullable().optional(),
  version: versionSchema,
  created_at: dateTimeStringSchema,
  updated_at: dateTimeStringSchema,
});
export type GuestOwnerDto = z.infer<typeof guestOwnerDtoSchema>;

/**
 * Hồ sơ khách (Guests) — DTO Người nhà (Family View-only)
 * Tuyệt đối che giấu SĐT, Email, Địa chỉ, Ghi chú riêng và trạng thái xóa mềm (AT03, AT57).
 */
export const guestFamilyDtoSchema = guestOwnerDtoSchema.omit({
  phone: true,
  email: true,
  address: true,
  private_notes: true,
  is_archived: true,
  archived_at: true,
});
export type GuestFamilyDto = z.infer<typeof guestFamilyDtoSchema>;

/**
 * Tạo & Sửa khách mời (Chỉ Owner)
 */
export const createGuestSchema = z.object({
  display_name: requiredStringSchema('Tên hiển thị của khách', 100),
  side: guestSideEnum.default('unassigned'),
  group_id: uuidSchema.nullable().optional(),
  sub_tags: z.array(z.string().trim()).default([]),
  age_tier: ageTierEnum.default('adult'),
  phone: nullableVietnamesePhoneSchema,
  email: nullableEmailSchema,
  address: z.string().trim().max(255).nullable().optional(),
  private_notes: notesSchema,
  is_placeholder: z.boolean().default(false),
  placeholder_for: z.string().trim().max(100).nullable().optional(),
});
export type CreateGuestInput = z.infer<typeof createGuestSchema>;

export const updateGuestSchema = createGuestSchema.extend({
  version: versionSchema,
});
export type UpdateGuestInput = z.infer<typeof updateGuestSchema>;

/**
 * Thiệp mời theo buổi (Invitations)
 */
export const invitationOwnerDtoSchema = z.object({
  id: uuidSchema,
  event_id: uuidSchema,
  card_name: requiredStringSchema('Tên trên thiệp', 150),
  representative_guest_id: uuidSchema,
  delivery_method: deliveryMethodEnum,
  in_charge_user_id: z.string().nullable().optional(),
  status: invitationStatusEnum,
  sent_date: dateStringSchema.nullable().optional(),
  notes: notesSchema,
  member_guest_ids: z.array(uuidSchema),
  version: versionSchema,
  created_at: dateTimeStringSchema,
  updated_at: dateTimeStringSchema,
});
export type InvitationOwnerDto = z.infer<typeof invitationOwnerDtoSchema>;

export const invitationFamilyDtoSchema = invitationOwnerDtoSchema.omit({
  in_charge_user_id: true,
  notes: true,
});
export type InvitationFamilyDto = z.infer<typeof invitationFamilyDtoSchema>;

export const createInvitationSchema = z.object({
  event_id: uuidSchema,
  card_name: requiredStringSchema('Tên trên thiệp', 150),
  representative_guest_id: uuidSchema,
  delivery_method: deliveryMethodEnum.default('paper'),
  in_charge_user_id: z.string().nullable().optional(),
  status: invitationStatusEnum.default('save_the_date'),
  sent_date: dateStringSchema.nullable().optional(),
  notes: notesSchema,
  member_guest_ids: z.array(uuidSchema).min(1, { message: 'Thiệp phải có ít nhất 1 khách nhận' }),
});
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

export const updateInvitationSchema = createInvitationSchema.extend({
  version: versionSchema,
});
export type UpdateInvitationInput = z.infer<typeof updateInvitationSchema>;

/**
 * Tham dự theo buổi (Attendance)
 */
export const attendanceOwnerDtoSchema = z.object({
  id: uuidSchema,
  guest_id: uuidSchema,
  event_id: uuidSchema,
  rsvp_status: rsvpStatusEnum,
  contact_count: z.number().int().min(0),
  contact_notes: notesSchema,
  next_followup_date: dateStringSchema.nullable().optional(),
  needs_seat: z.boolean(),
  needs_meal: z.boolean(),
  meal_dietary_tier: dietaryTierEnum,
  dietary_notes: notesSchema,
  accommodation_needed: z.boolean(),
  transport_needed: z.boolean(),
  is_origin_onsite: z.boolean(),
  version: versionSchema,
  created_at: dateTimeStringSchema,
  updated_at: dateTimeStringSchema,
});
export type AttendanceOwnerDto = z.infer<typeof attendanceOwnerDtoSchema>;

export const attendanceFamilyDtoSchema = attendanceOwnerDtoSchema.omit({
  contact_count: true,
  contact_notes: true,
  next_followup_date: true,
  is_origin_onsite: true,
});
export type AttendanceFamilyDto = z.infer<typeof attendanceFamilyDtoSchema>;

export const updateAttendanceSchema = z.object({
  rsvp_status: rsvpStatusEnum,
  contact_notes: notesSchema,
  next_followup_date: dateStringSchema.nullable().optional(),
  needs_seat: z.boolean(),
  needs_meal: z.boolean(),
  meal_dietary_tier: dietaryTierEnum,
  dietary_notes: notesSchema,
  accommodation_needed: z.boolean(),
  transport_needed: z.boolean(),
  version: versionSchema,
});
export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>;

/**
 * Thống kê tổng hợp sức chứa buổi lễ (Headcount & Seat & Meal Aggregation DTO)
 * Đáp ứng kiểm chứng Fixture FX01 (AT06, AT07).
 */
export const eventHeadcountSummaryDtoSchema = z.object({
  event_id: uuidSchema,
  total_invited: z.number().int().min(0),
  confirmed_guests: z.number().int().min(0),
  uncertain_guests: z.number().int().min(0),
  declined_guests: z.number().int().min(0),
  confirmed_seats: z.number().int().min(0),
  meals_total: z.number().int().min(0),
  meals_regular: z.number().int().min(0),
  meals_vegetarian: z.number().int().min(0),
  meals_child: z.number().int().min(0),
  babies_count: z.number().int().min(0),
});
export type EventHeadcountSummaryDto = z.infer<typeof eventHeadcountSummaryDtoSchema>;

/**
 * Gợi ý trùng lặp & Gộp khách (Duplicate Candidates & Merge Schema - AT08, AT09)
 */
export const duplicateCandidateDtoSchema = z.object({
  guest_a: guestOwnerDtoSchema,
  guest_b: guestOwnerDtoSchema,
  match_reasons: z.array(z.string()),
  similarity_score: z.number().min(0).max(1),
});
export type DuplicateCandidateDto = z.infer<typeof duplicateCandidateDtoSchema>;

export const mergeGuestsSchema = z.object({
  retained_guest_id: uuidSchema,
  merged_guest_id: uuidSchema,
  resolved_phone: nullableVietnamesePhoneSchema,
  resolved_email: nullableEmailSchema,
  resolved_address: z.string().trim().max(255).nullable().optional(),
  attendance_conflict_resolutions: z.array(
    z.object({
      event_id: uuidSchema,
      chosen_rsvp_status: rsvpStatusEnum,
      needs_seat: z.boolean(),
      needs_meal: z.boolean(),
      meal_dietary_tier: dietaryTierEnum,
    })
  ).default([]),
}).refine((data) => data.retained_guest_id.toLowerCase() !== data.merged_guest_id.toLowerCase(), {
  message: 'Bản ghi giữ lại và bản ghi gộp phải là hai người khác nhau',
  path: ['merged_guest_id'],
});
export type MergeGuestsInput = z.infer<typeof mergeGuestsSchema>;
