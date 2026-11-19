import { z } from 'zod';
import { dateTimeStringSchema, notesSchema, nullableVietnamesePhoneSchema } from './common';
export const eventInputSchema = z.object({
  title: z.string().trim().min(1).max(255), eventType: z.enum(['engagement','ancestor_ceremony','wedding_party','other']),
  status: z.enum(['tentative','confirmed','cancelled','completed']).default('tentative'),
  startTime: dateTimeStringSchema.nullable().optional(), endTime: dateTimeStringSchema.nullable().optional(),
  locationName: z.string().max(255).nullable().optional(), locationAddress: notesSchema.optional(), mapUrl: z.string().url().regex(/^https?:\/\//).nullable().optional(),
  contactPerson: z.string().max(255).nullable().optional(), contactPhone: nullableVietnamesePhoneSchema,
  publicNotes: notesSchema.optional(), privateNotes: notesSchema.optional(), isCheckInEnabled: z.boolean().default(true),
});
