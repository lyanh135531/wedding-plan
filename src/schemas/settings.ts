import { z } from 'zod';

export const setupSchema = z.object({
  groomName: z.string().trim().min(1).max(200),
  brideName: z.string().trim().min(1).max(200),
  weddingDate: z.iso.date().nullable(),
  isUnconfirmedDate: z.boolean(),
  estimatedDateNote: z.string().trim().max(1000),
  categories: z.array(z.object({ name: z.string().trim().min(1).max(200) })).max(30),
}).superRefine((data, ctx) => {
  if (!data.isUnconfirmedDate && !data.weddingDate) {
    ctx.addIssue({ code: 'custom', path: ['weddingDate'], message: 'Vui lòng chọn ngày cưới.' });
  }
  if (data.isUnconfirmedDate && !data.estimatedDateNote) {
    ctx.addIssue({ code: 'custom', path: ['estimatedDateNote'], message: 'Vui lòng nhập ghi chú ngày dự kiến.' });
  }
});

export const updateSettingsSchema = z.object({
  shortTitle: z.string().trim().min(1).max(200),
  version: z.number().int().positive(),
});

export type SetupInput = z.infer<typeof setupSchema>;
