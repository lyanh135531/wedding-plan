import { z } from 'zod';
import {
  uuidSchema,
  versionSchema,
  dateTimeStringSchema,
  notesSchema,
} from './common';

export const tableShapeEnum = z.enum(['round', 'rectangular']);
export type TableShape = z.infer<typeof tableShapeEnum>;

export const createTableSchema = z.object({
  eventId: uuidSchema,
  tableNumber: z.string().max(50).optional().nullable(),
  name: z.string().trim().min(1, { message: 'Tên bàn không được để trống' }).max(255),
  shape: tableShapeEnum.default('round'),
  capacity: z.number().int().positive({ message: 'Sức chứa bàn phải lớn hơn 0' }),
  notes: notesSchema.optional().nullable(),
});
export type CreateTableInput = z.infer<typeof createTableSchema>;

export const updateTableSchema = z.object({
  tableNumber: z.string().max(50).optional().nullable(),
  name: z.string().trim().min(1, { message: 'Tên bàn không được để trống' }).max(255).optional(),
  shape: tableShapeEnum.optional(),
  capacity: z.number().int().positive({ message: 'Sức chứa bàn phải lớn hơn 0' }).optional(),
  notes: notesSchema.optional().nullable(),
  version: versionSchema.optional(),
});
export type UpdateTableInput = z.infer<typeof updateTableSchema>;

export const assignSeatSchema = z.object({
  eventId: uuidSchema,
  tableId: uuidSchema,
  guestId: uuidSchema,
  seatNumber: z.number().int().positive().optional().nullable(),
  notes: notesSchema.optional().nullable(),
});
export type AssignSeatInput = z.infer<typeof assignSeatSchema>;

export const tableDtoSchema = z.object({
  id: uuidSchema,
  eventId: uuidSchema,
  tableNumber: z.string().nullable(),
  name: z.string(),
  shape: tableShapeEnum,
  capacity: z.number().int(),
  notes: z.string().nullable(),
  version: z.number().int(),
  createdAt: dateTimeStringSchema,
  updatedAt: dateTimeStringSchema,
});
export type TableDto = z.infer<typeof tableDtoSchema>;

export const tableFamilyDtoSchema = z.object({
  id: uuidSchema,
  eventId: uuidSchema,
  tableNumber: z.string().nullable(),
  name: z.string(),
  shape: tableShapeEnum,
  capacity: z.number().int(),
  notes: z.null(), // Sanitized for family_view (AT26)
  version: z.number().int(),
  createdAt: dateTimeStringSchema,
  updatedAt: dateTimeStringSchema,
});
export type TableFamilyDto = z.infer<typeof tableFamilyDtoSchema>;

export const seatAssignmentDtoSchema = z.object({
  id: uuidSchema,
  eventId: uuidSchema,
  tableId: uuidSchema,
  guestId: uuidSchema,
  seatNumber: z.number().int().nullable(),
  notes: z.string().nullable(),
  version: z.number().int(),
  createdAt: dateTimeStringSchema,
  updatedAt: dateTimeStringSchema,
});
export type SeatAssignmentDto = z.infer<typeof seatAssignmentDtoSchema>;

export const seatAssignmentFamilyDtoSchema = z.object({
  id: uuidSchema,
  eventId: uuidSchema,
  tableId: uuidSchema,
  guestId: uuidSchema,
  seatNumber: z.number().int().nullable(),
  notes: z.null(), // Sanitized for family_view
  version: z.number().int(),
  createdAt: dateTimeStringSchema,
  updatedAt: dateTimeStringSchema,
});
export type SeatAssignmentFamilyDto = z.infer<typeof seatAssignmentFamilyDtoSchema>;
