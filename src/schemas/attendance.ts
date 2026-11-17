import { z } from 'zod';
import {
  uuidSchema,
  nullableVietnamesePhoneSchema,
  notesSchema,
} from './common';

export const checkInGuestSchema = z.object({
  eventId: uuidSchema,
  guestId: uuidSchema,
  checkInNotes: notesSchema.optional().nullable(),
  confirmDeclinedOverride: z.boolean().default(false),
});
export type CheckInGuestInput = z.input<typeof checkInGuestSchema>;

export const undoCheckInSchema = z.object({
  eventId: uuidSchema,
  guestId: uuidSchema,
  undoReason: notesSchema.optional().nullable(),
});
export type UndoCheckInInput = z.infer<typeof undoCheckInSchema>;

export const walkInGuestSchema = z.object({
  eventId: uuidSchema,
  groupId: uuidSchema.optional().nullable(),
  fullName: z.string().trim().min(1, { message: 'Tên khách phát sinh không được để trống' }).max(255),
  phone: nullableVietnamesePhoneSchema,
  relationship: z.string().trim().max(100).optional().nullable(),
  tableId: uuidSchema.optional().nullable(),
  needsSeat: z.boolean().default(true),
  needsMeal: z.boolean().default(true),
  dietaryTier: z.enum(['regular', 'vegetarian', 'halal', 'child', 'special']).default('regular'),
  checkInNotes: notesSchema.optional().nullable(),
});
export type WalkInGuestInput = z.input<typeof walkInGuestSchema>;

export const toggleCheckInSchema = z.object({
  eventId: uuidSchema,
  isEnabled: z.boolean(),
});
export type ToggleCheckInInput = z.infer<typeof toggleCheckInSchema>;

export const attendanceCheckInDtoSchema = z.object({
  guestId: uuidSchema,
  eventId: uuidSchema,
  fullName: z.string(),
  phone: z.string().nullable(),
  rsvpStatus: z.string(),
  isCheckedIn: z.boolean(),
  checkInTime: z.string().nullable(),
  checkedInByUserId: z.string().nullable(),
  checkInNotes: z.string().nullable(),
  isOriginOnsite: z.boolean(),
  tableName: z.string().nullable(),
  tableNumber: z.number().nullable(),
  seatNumber: z.number().nullable(),
});
export type AttendanceCheckInDto = z.infer<typeof attendanceCheckInDtoSchema>;
