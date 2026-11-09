import { z } from 'zod';
import {
  uuidSchema,
  versionSchema,
  requiredStringSchema,
  notesSchema,
  dateStringSchema,
  dateTimeStringSchema,
} from './common';

/**
 * Enums Công Việc & Lịch
 */
export const taskPriorityEnum = z.enum(['low', 'normal', 'high', 'urgent']);
export type TaskPriority = z.infer<typeof taskPriorityEnum>;

export const taskStatusEnum = z.enum(['not_started', 'in_progress', 'blocked', 'completed', 'cancelled']);
export type TaskStatus = z.infer<typeof taskStatusEnum>;

export const deadlineTypeEnum = z.enum(['fixed_date', 'fixed_datetime', 'relative_to_event']);
export type DeadlineType = z.infer<typeof deadlineTypeEnum>;

export const relativeDirectionEnum = z.enum(['before', 'after']);
export type RelativeDirection = z.infer<typeof relativeDirectionEnum>;

/**
 * Công việc (Tasks) — DTO Chủ sở hữu (Owner)
 */
export const taskOwnerDtoSchema = z.object({
  id: uuidSchema,
  title: requiredStringSchema('Tiêu đề công việc nội bộ', 200),
  category: z.string().trim().max(100).nullable().optional(),
  event_id: uuidSchema.nullable().optional(),
  in_charge_user_id: z.string().nullable().optional(),
  support_contacts: z.array(z.string().trim()).default([]),
  priority: taskPriorityEnum,
  status: taskStatusEnum,
  deadline_type: deadlineTypeEnum,
  fixed_date: dateStringSchema.nullable().optional(),
  fixed_datetime: dateTimeStringSchema.nullable().optional(),
  relative_event_id: uuidSchema.nullable().optional(),
  relative_offset_days: z.number().int().min(0).nullable().optional(),
  relative_direction: relativeDirectionEnum.default('before'),
  pinned_manual: z.boolean(),
  private_notes: notesSchema,
  shared_with_family: z.boolean(),
  shared_public_title: z.string().trim().max(200).nullable().optional(),
  shared_public_notes: notesSchema,
  computed_due_date: dateTimeStringSchema.nullable().optional(),
  is_waiting_official_date: z.boolean().default(false), // true nếu buổi lễ chưa chốt (AT18)
  reopened_at: dateTimeStringSchema.nullable().optional(),
  version: versionSchema,
  created_at: dateTimeStringSchema,
  updated_at: dateTimeStringSchema,
});
export type TaskOwnerDto = z.infer<typeof taskOwnerDtoSchema>;

/**
 * Schema cơ sở cho DTO Công việc Người nhà (Family View-only).
 */
export const rawTaskFamilyDtoSchema = z.object({
  id: uuidSchema,
  title: requiredStringSchema('Tiêu đề công việc', 200),
  category: z.string().trim().max(100).nullable().optional(),
  event_id: uuidSchema.nullable().optional(),
  priority: taskPriorityEnum,
  status: taskStatusEnum,
  deadline_type: deadlineTypeEnum,
  computed_due_date: dateTimeStringSchema.nullable().optional(),
  is_waiting_official_date: z.boolean(),
  notes: notesSchema,
});

/**
 * Công việc (Tasks) — DTO Người nhà (Family View-only)
 * Tự động ánh xạ shared_public_title -> title và shared_public_notes -> notes nếu đầu vào là bản ghi DB thô.
 * Từ chối công việc nếu shared_with_family === false.
 * Che hoàn toàn tiêu đề nội bộ (title), ghi chú riêng tư (private_notes) và người phụ trách (in_charge_user_id) (AT59).
 */
export const taskFamilyDtoSchema = z.preprocess((val) => {
  if (val && typeof val === 'object') {
    const raw = val as Record<string, unknown>;
    if ('shared_with_family' in raw && raw.shared_with_family === false) {
      throw new Error('Công việc này không được chia sẻ cho người nhà');
    }
    if ('shared_public_title' in raw) {
      return {
        ...raw,
        title: (typeof raw.shared_public_title === 'string' && raw.shared_public_title.trim()) || 'Công việc chung',
        notes: ('shared_public_notes' in raw ? raw.shared_public_notes : raw.notes) ?? null,
      };
    }
  }
  return val;
}, rawTaskFamilyDtoSchema);
export type TaskFamilyDto = z.infer<typeof taskFamilyDtoSchema>;

/**
 * Chuyển đổi an toàn từ bản ghi Task (Database row hoặc entity) sang TaskFamilyDto (AT59).
 * Đảm bảo:
 * - Từ chối nếu task không được chia sẻ cho người nhà (shared_with_family === false).
 * - Tiêu đề người nhà nhận được là shared_public_title (hoặc fallback 'Công việc chung' nếu rỗng).
 * - Tuyệt đối không để lộ tiêu đề nội bộ (title), ghi chú riêng tư (private_notes), hoặc người phụ trách (in_charge_user_id).
 * - Ghi chú là shared_public_notes.
 */
export function toTaskFamilyDto(task: {
  id: string;
  shared_public_title?: string | null;
  title?: string;
  category?: string | null;
  event_id?: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  deadline_type: DeadlineType;
  computed_due_date?: string | null;
  is_waiting_official_date?: boolean;
  shared_public_notes?: string | null;
  notes?: string | null;
  shared_with_family?: boolean;
}): TaskFamilyDto {
  if (task.shared_with_family === false) {
    throw new Error('Công việc này không được chia sẻ cho người nhà');
  }
  return taskFamilyDtoSchema.parse({
    id: task.id,
    title: (task.shared_public_title && task.shared_public_title.trim()) || 'Công việc chung',
    category: task.category,
    event_id: task.event_id,
    priority: task.priority,
    status: task.status,
    deadline_type: task.deadline_type,
    computed_due_date: task.computed_due_date,
    is_waiting_official_date: Boolean(task.is_waiting_official_date),
    notes: task.shared_public_notes !== undefined ? task.shared_public_notes : task.notes,
  });
}

/**
 * Tạo & Sửa Công việc (Chỉ Chủ sở hữu)
 */
export const createTaskSchema = z.object({
  title: requiredStringSchema('Tiêu đề công việc', 200),
  category: z.string().trim().max(100).nullable().optional(),
  event_id: uuidSchema.nullable().optional(),
  in_charge_user_id: z.string().nullable().optional(),
  support_contacts: z.array(z.string().trim()).default([]),
  priority: taskPriorityEnum.default('normal'),
  status: taskStatusEnum.default('not_started'),
  deadline_type: deadlineTypeEnum.default('fixed_date'),
  fixed_date: dateStringSchema.nullable().optional(),
  fixed_datetime: dateTimeStringSchema.nullable().optional(),
  relative_event_id: uuidSchema.nullable().optional(),
  relative_offset_days: z.number().int().min(0).nullable().optional(),
  relative_direction: relativeDirectionEnum.default('before'),
  pinned_manual: z.boolean().default(false),
  private_notes: notesSchema,
  shared_with_family: z.boolean().default(false),
  shared_public_title: z.string().trim().max(200).nullable().optional(),
  shared_public_notes: notesSchema,
}).superRefine((data, ctx) => {
  if (data.deadline_type === 'fixed_date' && !data.fixed_date) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Hạn ngày cố định bắt buộc phải chọn ngày (fixed_date)',
      path: ['fixed_date'],
    });
  }
  if (data.deadline_type === 'fixed_datetime' && !data.fixed_datetime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Hạn giờ cố định bắt buộc phải chọn thời điểm (fixed_datetime)',
      path: ['fixed_datetime'],
    });
  }
  if (data.deadline_type === 'relative_to_event') {
    if (!data.relative_event_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Hạn tương đối bắt buộc phải chọn buổi lễ làm mốc (relative_event_id)',
        path: ['relative_event_id'],
      });
    }
    if (data.relative_offset_days === null || data.relative_offset_days === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Hạn tương đối bắt buộc phải nhập số ngày dịch chuyển (relative_offset_days)',
        path: ['relative_offset_days'],
      });
    }
  }
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = createTaskSchema.extend({
  version: versionSchema,
});
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

/**
 * Quan hệ phụ thuộc công việc (Task Dependencies - AT19)
 * So sánh không phân biệt hoa thường để ngăn chặn chu trình tự phụ thuộc (self-loop).
 */
export const createTaskDependencySchema = z.object({
  dependent_task_id: uuidSchema,
  prerequisite_task_id: uuidSchema,
}).refine((data) => data.dependent_task_id.toLowerCase() !== data.prerequisite_task_id.toLowerCase(), {
  message: 'Một công việc không thể phụ thuộc vào chính nó',
  path: ['prerequisite_task_id'],
});
export type CreateTaskDependencyInput = z.infer<typeof createTaskDependencySchema>;

/**
 * Checklist công việc con (Task Checklist Items)
 */
export const taskChecklistItemDtoSchema = z.object({
  id: uuidSchema,
  task_id: uuidSchema,
  title: requiredStringSchema('Nội dung mục kiểm tra', 150),
  is_completed: z.boolean(),
  sort_order: z.number().int().default(0),
  created_at: dateTimeStringSchema,
  updated_at: dateTimeStringSchema,
});
export type TaskChecklistItemDto = z.infer<typeof taskChecklistItemDtoSchema>;

export const createChecklistItemSchema = z.object({
  task_id: uuidSchema,
  title: requiredStringSchema('Nội dung mục kiểm tra', 150),
  sort_order: z.number().int().default(0),
});
export type CreateChecklistItemInput = z.infer<typeof createChecklistItemSchema>;

/**
 * Xem trước ảnh hưởng khi dời ngày cưới (Impact Preview Diff DTO - AT18, AT62)
 */
export const reschedulePreviewRequestSchema = z.object({
  event_id: uuidSchema,
  new_date: dateStringSchema,
  new_start_time: dateTimeStringSchema.nullable().optional(),
});
export type ReschedulePreviewRequest = z.infer<typeof reschedulePreviewRequestSchema>;

export const rescheduleImpactPreviewDtoSchema = z.object({
  event_id: uuidSchema,
  new_date: dateStringSchema,
  affected_relative_tasks: z.array(
    z.object({
      task_id: uuidSchema,
      title: z.string(),
      old_due_date: dateTimeStringSchema.nullable(),
      new_due_date: dateTimeStringSchema,
      offset_days: z.number().int(),
      direction: relativeDirectionEnum,
    })
  ),
  pinned_tasks_skipped: z.array(
    z.object({
      task_id: uuidSchema,
      title: z.string(),
      reason: z.string(), // "Đã ghim thủ công" hoặc "Đã hoàn thành"
    })
  ),
  fixed_payment_schedules_requiring_manual_review: z.array(
    z.object({
      schedule_id: uuidSchema,
      cost_item_name: z.string(),
      title: z.string(),
      amount_due: z.string(),
      due_date: dateStringSchema,
    })
  ),
});
export type RescheduleImpactPreviewDto = z.infer<typeof rescheduleImpactPreviewDtoSchema>;
