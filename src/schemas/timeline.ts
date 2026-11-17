import { z } from 'zod';
import {
  uuidSchema,
  versionSchema,
  dateTimeStringSchema,
  nullableVietnamesePhoneSchema,
  notesSchema,
} from './common';

export const TIMELINE_CATEGORIES = [
  'makeup',
  'car_pickup',
  'ancestor_ceremony',
  'transfer',
  'hall_prep',
  'guest_welcome',
  'ceremony',
  'banquet',
  'photoshoot',
  'wrapup',
  'handover',
  'other',
] as const;
export const timelineCategoryEnum = z.enum(TIMELINE_CATEGORIES);
export type TimelineCategory = z.infer<typeof timelineCategoryEnum>;

export const TIMELINE_STATUSES = [
  'not_started',
  'in_progress',
  'completed',
  'skipped',
] as const;
export const timelineStatusEnum = z.enum(TIMELINE_STATUSES);
export type TimelineStatus = z.infer<typeof timelineStatusEnum>;

export const createTimelineItemSchema = z
  .object({
    eventId: uuidSchema,
    title: z.string().trim().min(1, { message: 'Tiêu đề lịch trình không được để trống' }).max(255),
    category: timelineCategoryEnum.default('other'),
    scheduledStartTime: dateTimeStringSchema,
    scheduledEndTime: dateTimeStringSchema,
    locationName: z.string().trim().max(255).optional().nullable(),
    personInCharge: z.string().trim().max(255).optional().nullable(),
    inChargePhone: nullableVietnamesePhoneSchema,
    backupPerson: z.string().trim().max(255).optional().nullable(),
    backupPhone: nullableVietnamesePhoneSchema,
    supportAssignmentId: uuidSchema.optional().nullable(),
    assignedItemIds: z.array(uuidSchema).default([]),
    assignedTaskIds: z.array(uuidSchema).default([]),
    operationalNotes: notesSchema.optional().nullable(),
    isShared: z.boolean().default(true),
    sortOrder: z.number().int().default(0),
  })
  .refine(
    (data) => new Date(data.scheduledEndTime).getTime() >= new Date(data.scheduledStartTime).getTime(),
    {
      message: 'Thời gian kết thúc dự kiến phải sau hoặc bằng thời gian bắt đầu dự kiến',
      path: ['scheduledEndTime'],
    }
  );

export type CreateTimelineItemInput = z.input<typeof createTimelineItemSchema>;

export const updateTimelineItemSchema = z
  .object({
    title: z.string().trim().min(1, { message: 'Tiêu đề lịch trình không được để trống' }).max(255).optional(),
    category: timelineCategoryEnum.optional(),
    scheduledStartTime: dateTimeStringSchema.optional(),
    scheduledEndTime: dateTimeStringSchema.optional(),
    actualStartTime: dateTimeStringSchema.optional().nullable(),
    actualEndTime: dateTimeStringSchema.optional().nullable(),
    locationName: z.string().trim().max(255).optional().nullable(),
    personInCharge: z.string().trim().max(255).optional().nullable(),
    inChargePhone: nullableVietnamesePhoneSchema,
    backupPerson: z.string().trim().max(255).optional().nullable(),
    backupPhone: nullableVietnamesePhoneSchema,
    supportAssignmentId: uuidSchema.optional().nullable(),
    assignedItemIds: z.array(uuidSchema).optional(),
    assignedTaskIds: z.array(uuidSchema).optional(),
    operationalNotes: notesSchema.optional().nullable(),
    isShared: z.boolean().optional(),
    status: timelineStatusEnum.optional(),
    sortOrder: z.number().int().optional(),
    version: versionSchema,
  })
  .refine(
    (data) => {
      if (data.scheduledStartTime && data.scheduledEndTime) {
        return new Date(data.scheduledEndTime).getTime() >= new Date(data.scheduledStartTime).getTime();
      }
      return true;
    },
    {
      message: 'Thời gian kết thúc dự kiến phải sau hoặc bằng thời gian bắt đầu dự kiến',
      path: ['scheduledEndTime'],
    }
  );

export type UpdateTimelineItemInput = z.infer<typeof updateTimelineItemSchema>;

export const markActualTimesSchema = z
  .object({
    actualStartTime: dateTimeStringSchema.optional().nullable(),
    actualEndTime: dateTimeStringSchema.optional().nullable(),
    status: timelineStatusEnum.optional(),
    version: versionSchema,
  })
  .refine(
    (data) => {
      if (data.actualStartTime && data.actualEndTime) {
        return new Date(data.actualEndTime).getTime() >= new Date(data.actualStartTime).getTime();
      }
      return true;
    },
    {
      message: 'Thời gian kết thúc thực tế phải sau hoặc bằng thời gian bắt đầu thực tế',
      path: ['actualEndTime'],
    }
  );

export type MarkActualTimesInput = z.infer<typeof markActualTimesSchema>;

export const previewShiftTimelineSchema = z.object({
  eventId: uuidSchema,
  delayMinutes: z.number().int().min(-720).max(720, { message: 'Thời gian dời tối đa là 12 tiếng' }),
  pivotTime: dateTimeStringSchema.optional().nullable(),
  pivotItemId: uuidSchema.optional().nullable(),
});

export type PreviewShiftTimelineInput = z.infer<typeof previewShiftTimelineSchema>;

export const applyShiftTimelineSchema = z.object({
  eventId: uuidSchema,
  delayMinutes: z.number().int().min(-720).max(720),
  pivotTime: dateTimeStringSchema.optional().nullable(),
  pivotItemId: uuidSchema.optional().nullable(),
  confirmed: z.literal(true, {
    errorMap: () => ({ message: 'Xác nhận dời lịch là bắt buộc' }),
  }),
});

export type ApplyShiftTimelineInput = z.infer<typeof applyShiftTimelineSchema>;

export const timelineItemDtoSchema = z.object({
  id: uuidSchema,
  eventId: uuidSchema,
  title: z.string(),
  category: timelineCategoryEnum,
  scheduledStartTime: z.string(),
  scheduledEndTime: z.string(),
  actualStartTime: z.string().nullable(),
  actualEndTime: z.string().nullable(),
  locationName: z.string().nullable(),
  personInCharge: z.string().nullable(),
  inChargePhone: z.string().nullable(),
  backupPerson: z.string().nullable(),
  backupPhone: z.string().nullable(),
  supportAssignmentId: z.string().nullable(),
  assignedItemIds: z.array(z.string()),
  assignedTaskIds: z.array(z.string()),
  operationalNotes: z.string().nullable(),
  isShared: z.boolean(),
  status: timelineStatusEnum,
  sortOrder: z.number(),
  version: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  delayMinutes: z.number().default(0),
});

export type TimelineItemDto = z.infer<typeof timelineItemDtoSchema>;

export const timelineItemFamilyDtoSchema = timelineItemDtoSchema.omit({
  operationalNotes: true,
});

export type TimelineItemFamilyDto = z.infer<typeof timelineItemFamilyDtoSchema>;
