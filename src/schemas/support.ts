import { z } from 'zod';
import {
  uuidSchema,
  versionSchema,
  dateTimeStringSchema,
  vietnamesePhoneSchema,
  nullableVietnamesePhoneSchema,
  notesSchema,
} from './common';

export const SUPPORT_ROLES = [
  'co_dau',
  'chu_re',
  'phu_dau',
  'phu_re',
  'mc',
  'dieu_phoi',
  'nguoi_than',
  'nha_cung_cap',
  'khac',
] as const;
export const supportRoleEnum = z.enum(SUPPORT_ROLES);
export type SupportRole = z.infer<typeof supportRoleEnum>;

export const createSupportAssignmentSchema = z.object({
  eventId: uuidSchema,
  contactId: uuidSchema.optional().nullable(),
  name: z.string().trim().min(1, { message: 'Tên người hỗ trợ không được để trống' }).max(255),
  phone: vietnamesePhoneSchema,
  roles: z.array(supportRoleEnum).min(1, { message: 'Cần gán ít nhất một vai trò trong đội hỗ trợ' }),
  arrivalTime: z.string().trim().max(50).optional().nullable(),
  backupName: z.string().trim().max(255).optional().nullable(),
  backupPhone: nullableVietnamesePhoneSchema,
  attireNotes: notesSchema.optional().nullable(),
  duties: notesSchema.optional().nullable(),
  assignedTaskIds: z.array(uuidSchema).default([]),
  assignedItemIds: z.array(uuidSchema).default([]),
  isShared: z.boolean().default(false),
});
export interface CreateSupportAssignmentInput {
  eventId: string;
  contactId?: string | null;
  name: string;
  phone: string;
  roles: SupportRole[];
  arrivalTime?: string | null;
  backupName?: string | null;
  backupPhone?: string | null;
  attireNotes?: string | null;
  duties?: string | null;
  assignedTaskIds?: string[];
  assignedItemIds?: string[];
  isShared?: boolean;
}

export const updateSupportAssignmentSchema = z.object({
  contactId: uuidSchema.optional().nullable(),
  name: z.string().trim().min(1, { message: 'Tên người hỗ trợ không được để trống' }).max(255).optional(),
  phone: vietnamesePhoneSchema.optional(),
  roles: z.array(supportRoleEnum).min(1, { message: 'Cần gán ít nhất một vai trò' }).optional(),
  arrivalTime: z.string().trim().max(50).optional().nullable(),
  backupName: z.string().trim().max(255).optional().nullable(),
  backupPhone: nullableVietnamesePhoneSchema,
  attireNotes: notesSchema.optional().nullable(),
  duties: notesSchema.optional().nullable(),
  assignedTaskIds: z.array(uuidSchema).optional(),
  assignedItemIds: z.array(uuidSchema).optional(),
  isShared: z.boolean().optional(),
  version: versionSchema.optional(),
});

export interface UpdateSupportAssignmentInput {
  contactId?: string | null;
  name?: string;
  phone?: string;
  roles?: SupportRole[];
  arrivalTime?: string | null;
  backupName?: string | null;
  backupPhone?: string | null;
  attireNotes?: string | null;
  duties?: string | null;
  assignedTaskIds?: string[];
  assignedItemIds?: string[];
  isShared?: boolean;
  version?: number;
}

export const supportAssignmentDtoSchema = z.object({
  id: uuidSchema,
  eventId: uuidSchema,
  contactId: uuidSchema.nullable(),
  name: z.string(),
  phone: z.string(),
  roles: z.array(supportRoleEnum),
  arrivalTime: z.string().nullable(),
  backupName: z.string().nullable(),
  backupPhone: z.string().nullable(),
  attireNotes: z.string().nullable(),
  duties: z.string().nullable(),
  assignedTaskIds: z.array(z.string()),
  assignedItemIds: z.array(z.string()),
  isShared: z.boolean(),
  version: z.number().int(),
  createdAt: dateTimeStringSchema,
  updatedAt: dateTimeStringSchema,
});
export type SupportAssignmentDto = z.infer<typeof supportAssignmentDtoSchema>;

export const supportAssignmentFamilyDtoSchema = z.object({
  id: uuidSchema,
  eventId: uuidSchema,
  contactId: uuidSchema.nullable(),
  name: z.string(),
  phone: z.string(),
  roles: z.array(supportRoleEnum),
  arrivalTime: z.string().nullable(),
  backupName: z.string().nullable(),
  backupPhone: z.string().nullable(),
  attireNotes: z.null(), // Sanitized for family_view
  duties: z.string().nullable(),
  assignedTaskIds: z.array(z.string()),
  assignedItemIds: z.array(z.string()),
  isShared: z.literal(true),
  version: z.number().int(),
  createdAt: dateTimeStringSchema,
  updatedAt: dateTimeStringSchema,
});
export type SupportAssignmentFamilyDto = z.infer<typeof supportAssignmentFamilyDtoSchema>;
