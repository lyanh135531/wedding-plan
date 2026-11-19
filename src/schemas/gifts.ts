import { z } from 'zod';
import {
  uuidSchema,
  versionSchema,
  vndCurrencyStringSchema,
  notesSchema,
  dateTimeStringSchema,
} from './common';

export const GIFT_TYPES = ['cash', 'physical'] as const;
export const giftTypeEnum = z.enum(GIFT_TYPES);
export type GiftType = z.infer<typeof giftTypeEnum>;

export const RECONCILIATION_STATUSES = ['reconciled', 'needs_reconciliation'] as const;
export const reconciliationStatusEnum = z.enum(RECONCILIATION_STATUSES);
export type ReconciliationStatus = z.infer<typeof reconciliationStatusEnum>;

export const THANK_YOU_CHANNELS = [
  'in_person',
  'call',
  'sms',
  'zalo',
  'card',
  'other',
] as const;
export const thankYouChannelEnum = z.enum(THANK_YOU_CHANNELS);
export type ThankYouChannel = z.infer<typeof thankYouChannelEnum>;

export const contributorInputSchema = z.object({
  guestId: uuidSchema.optional().nullable(),
  contributorName: z.string().trim().min(1, { message: 'Tên người gửi không được để trống' }).max(255),
  relationship: z.string().trim().max(100).optional().nullable(),
});
export type ContributorInput = z.infer<typeof contributorInputSchema>;

export const createGiftSchema = z
  .object({
    eventId: uuidSchema,
    giftType: giftTypeEnum.default('cash'),
    amount: vndCurrencyStringSchema.optional().nullable(),
    receivedAt: dateTimeStringSchema.optional(),
    description: z.string().trim().max(1000).optional().nullable(),
    receivedByUserId: z.string().trim().optional().nullable(),
    receivedByProxy: z.string().trim().max(255).optional().nullable(),
    envelopeCode: z.string().trim().max(50).optional().nullable(),
    isSenderIdentified: z.boolean().default(true),
    unidentifiedNotes: z.string().trim().max(500).optional().nullable(),
    reconciliationStatus: reconciliationStatusEnum.default('reconciled'),
    notes: notesSchema.optional().nullable(),
    contributors: z.array(contributorInputSchema).default([]),
  })
  .superRefine((data, ctx) => {
    if (data.giftType === 'cash') {
      if (!data.amount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Số tiền mừng là bắt buộc đối với quà tiền',
          path: ['amount'],
        });
      }
    } else if (data.giftType === 'physical') {
      if (data.amount !== null && data.amount !== undefined && data.amount !== '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Quà hiện vật không được ghi nhận số tiền mặt',
          path: ['amount'],
        });
      }
      if (!data.description || data.description.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Mô tả quà tặng là bắt buộc đối với quà hiện vật',
          path: ['description'],
        });
      }
    }

    if (data.isSenderIdentified && data.contributors.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Cần ít nhất một người gửi khi quà đã xác định người gửi',
        path: ['contributors'],
      });
    }
  });

export type CreateGiftInput = z.input<typeof createGiftSchema>;

export const createGiftReturnSchema = z.object({
  amount: vndCurrencyStringSchema,
  returnReason: z.string().trim().min(1, { message: 'Lý do trả lại quà là bắt buộc' }).max(500),
});
export type CreateGiftReturnInput = z.infer<typeof createGiftReturnSchema>;

export const markThankedSchema = z.object({
  isThanked: z.boolean().default(true),
  channel: thankYouChannelEnum.default('in_person'),
  notes: notesSchema.optional().nullable(),
});
export type MarkThankedInput = z.infer<typeof markThankedSchema>;

export const voidGiftSchema = z.object({
  voidedReason: z.string().trim().min(1, { message: 'Lý do hủy quà mừng là bắt buộc' }).max(500),
  version: versionSchema,
});
export type VoidGiftInput = z.infer<typeof voidGiftSchema>;

export const reconcileSafeCashSchema = z.object({
  eventId: uuidSchema,
  countedCashAmount: vndCurrencyStringSchema,
  notes: notesSchema.optional().nullable(),
});
export type ReconcileSafeCashInput = z.infer<typeof reconcileSafeCashSchema>;

export const giftDtoSchema = z.object({
  id: uuidSchema,
  eventId: uuidSchema,
  giftType: giftTypeEnum,
  receivedAt: dateTimeStringSchema.optional(),
  amount: z.string().nullable(),
  description: z.string().nullable(),
  receivedByUserId: z.string().nullable(),
  receivedByProxy: z.string().nullable(),
  envelopeCode: z.string().nullable(),
  isSenderIdentified: z.boolean(),
  unidentifiedNotes: z.string().nullable(),
  reconciliationStatus: reconciliationStatusEnum,
  isThanked: z.boolean(),
  thankedAt: z.string().nullable(),
  thankedByUserId: z.string().nullable(),
  thankYouChannel: z.string().nullable(),
  thankYouNotes: z.string().nullable(),
  isVoided: z.boolean(),
  voidedReason: z.string().nullable(),
  voidedAt: z.string().nullable(),
  voidedByUserId: z.string().nullable(),
  notes: z.string().nullable(),
  version: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  contributors: z.array(
    z.object({
      id: uuidSchema,
      giftId: uuidSchema,
      guestId: z.string().nullable(),
      contributorName: z.string(),
      relationship: z.string().nullable(),
      createdAt: z.string(),
    })
  ),
  returns: z.array(
    z.object({
      id: uuidSchema,
      giftId: uuidSchema,
      amount: z.string(),
      returnReason: z.string(),
      returnedAt: z.string(),
      handledByUserId: z.string().nullable(),
      createdAt: z.string(),
    })
  ),
  netAmount: z.string(),
});
export type GiftDto = z.infer<typeof giftDtoSchema>;

export const giftSummaryDtoSchema = z.object({
  totalReceivedCash: z.string(),
  totalReturnedCash: z.string(),
  netReceivedCash: z.string(),
  totalGiftsCount: z.number(),
  cashGiftsCount: z.number(),
  physicalGiftsCount: z.number(),
  unthankedCount: z.number(),
  unidentifiedCount: z.number(),
  needsReconciliationCount: z.number(),
});
export type GiftSummaryDto = z.infer<typeof giftSummaryDtoSchema>;
