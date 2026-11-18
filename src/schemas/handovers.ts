import { z } from 'zod';
import {
  uuidSchema,
  versionSchema,
} from './common';

export const HANDOVER_STATUSES = ['draft', 'handed_over'] as const;
export const handoverStatusEnum = z.enum(HANDOVER_STATUSES);
export type HandoverStatus = z.infer<typeof handoverStatusEnum>;

export const handoverScopeSchema = z.object({
  includeTimeline: z.boolean().default(true),
  includeSeating: z.boolean().default(true),
  includeCatering: z.boolean().default(true),
  includeSupport: z.boolean().default(true),
  includeChecklist: z.boolean().default(true),
  includeFinancials: z.boolean().default(false),
});
export type HandoverScope = z.infer<typeof handoverScopeSchema>;

export const createHandoverPacketSchema = z.object({
  eventId: uuidSchema,
  title: z.string().trim().min(1, { message: 'Tiêu đề bộ bàn giao không được để trống' }).max(255),
  scope: handoverScopeSchema.default({
    includeTimeline: true,
    includeSeating: true,
    includeCatering: true,
    includeSupport: true,
    includeChecklist: true,
    includeFinancials: false,
  }),
  isSharedWithFamily: z.boolean().default(false),
});
export type CreateHandoverPacketInput = z.input<typeof createHandoverPacketSchema>;

export const deliverHandoverPacketSchema = z.object({
  handedOverTo: z.string().trim().min(1, { message: 'Tên người nhận bàn giao không được để trống' }).max(255),
  handedOverChannel: z.string().trim().max(100).optional().nullable(),
});
export type DeliverHandoverPacketInput = z.infer<typeof deliverHandoverPacketSchema>;

export const handoverPacketDtoSchema = z.object({
  id: uuidSchema,
  eventId: uuidSchema,
  version: z.number(),
  title: z.string(),
  scope: handoverScopeSchema,
  snapshotData: z.record(z.string(), z.any()),
  handoverStatus: handoverStatusEnum,
  handedOverTo: z.string().nullable(),
  handedOverAt: z.string().nullable(),
  handedOverChannel: z.string().nullable(),
  isSharedWithFamily: z.boolean(),
  createdByUserId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type HandoverPacketDto = z.infer<typeof handoverPacketDtoSchema>;

export const handoverPacketFamilyDtoSchema = handoverPacketDtoSchema.extend({
  snapshotData: z.record(z.string(), z.any()),
});
export type HandoverPacketFamilyDto = z.infer<typeof handoverPacketFamilyDtoSchema>;
