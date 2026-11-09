import { z } from 'zod';
import {
  uuidSchema,
  versionSchema,
  requiredStringSchema,
  notesSchema,
  vndCurrencyStringSchema,
  nullableVndCurrencyStringSchema,
  dateStringSchema,
  dateTimeStringSchema,
  nullableVietnamesePhoneSchema,
} from './common';

/**
 * Enums Tài Chính
 */
export const costStatusEnum = z.enum(['draft', 'contracted', 'completed', 'cancelling', 'cancelled']);
export type CostStatus = z.infer<typeof costStatusEnum>;

export const scheduleStatusEnum = z.enum(['estimated', 'agreed', 'cancelled']);
export type ScheduleStatus = z.infer<typeof scheduleStatusEnum>;

export const paymentTypeEnum = z.enum(['outflow', 'refund']);
export type PaymentType = z.infer<typeof paymentTypeEnum>;

export const paymentMethodEnum = z.enum(['cash', 'bank_transfer', 'other']);
export type PaymentMethod = z.infer<typeof paymentMethodEnum>;

export const fundingEntryTypeEnum = z.enum(['cash_fund', 'direct_vendor_payment', 'pledged_unreceived']);
export type FundingEntryType = z.infer<typeof fundingEntryTypeEnum>;

export const idempotencyStatusEnum = z.enum(['processing', 'completed', 'failed']);
export type IdempotencyStatus = z.infer<typeof idempotencyStatusEnum>;

/**
 * Danh mục chi phí (Budget Categories)
 */
export const budgetCategoryDtoSchema = z.object({
  id: uuidSchema,
  name: requiredStringSchema('Tên danh mục', 100),
  default_order: z.number().int().default(0),
  allocated_budget: vndCurrencyStringSchema.default('0'),
  created_at: dateTimeStringSchema,
  updated_at: dateTimeStringSchema,
});
export type BudgetCategoryDto = z.infer<typeof budgetCategoryDtoSchema>;

export const createBudgetCategorySchema = z.object({
  name: requiredStringSchema('Tên danh mục', 100),
  default_order: z.number().int().default(0),
  allocated_budget: vndCurrencyStringSchema.default('0'),
  notes: notesSchema,
});
export type CreateBudgetCategoryInput = z.infer<typeof createBudgetCategorySchema>;

/**
 * Khoản chi cụ thể (Cost Items)
 */
export const costItemDtoSchema = z.object({
  id: uuidSchema,
  name: requiredStringSchema('Tên khoản chi', 150),
  category_id: uuidSchema,
  event_id: uuidSchema.nullable().optional(),
  vendor_name: z.string().trim().max(100).nullable().optional(),
  vendor_phone: nullableVietnamesePhoneSchema,
  vendor_contact: z.string().trim().max(100).nullable().optional(),
  estimated_amount: nullableVndCurrencyStringSchema,
  contracted_amount: nullableVndCurrencyStringSchema,
  final_settlement_amount: nullableVndCurrencyStringSchema,
  status: costStatusEnum,
  in_charge_user_id: z.string().nullable().optional(),
  cancellation_fee: nullableVndCurrencyStringSchema,
  cancellation_notes: notesSchema,
  notes: notesSchema,
  version: versionSchema,
  created_at: dateTimeStringSchema,
  updated_at: dateTimeStringSchema,
});
export type CostItemDto = z.infer<typeof costItemDtoSchema>;

/**
 * Tạo & Cập nhật Khoản chi
 * Chú ý:
 * - AT48: final_settlement_amount = "0" là giá trị hợp lệ.
 * - AT11: Cả 3 mức giá đều null vẫn được chấp nhận (is_price_missing).
 */
export const createCostItemSchema = z.object({
  name: requiredStringSchema('Tên khoản chi', 150),
  category_id: uuidSchema,
  event_id: uuidSchema.nullable().optional(),
  vendor_name: z.string().trim().max(100).nullable().optional(),
  vendor_phone: nullableVietnamesePhoneSchema,
  vendor_contact: z.string().trim().max(100).nullable().optional(),
  estimated_amount: nullableVndCurrencyStringSchema,
  contracted_amount: nullableVndCurrencyStringSchema,
  final_settlement_amount: nullableVndCurrencyStringSchema,
  status: costStatusEnum.default('draft'),
  in_charge_user_id: z.string().nullable().optional(),
  cancellation_fee: nullableVndCurrencyStringSchema,
  cancellation_notes: notesSchema,
  notes: notesSchema,
}).refine(
  (data) => {
    // Nếu status là cancelling hoặc cancelled, nếu có cancellation_fee thì final_settlement_amount phải xác định
    if ((data.status === 'cancelling' || data.status === 'cancelled') && data.cancellation_fee !== null && data.cancellation_fee !== undefined) {
      return data.final_settlement_amount !== null && data.final_settlement_amount !== undefined;
    }
    return true;
  },
  {
    message: 'Khoản chi hủy có phí phạt thì phải có giá trị quyết toán cuối cùng',
    path: ['final_settlement_amount'],
  }
);
export type CreateCostItemInput = z.infer<typeof createCostItemSchema>;

export const updateCostItemSchema = createCostItemSchema.extend({
  version: versionSchema,
});
export type UpdateCostItemInput = z.infer<typeof updateCostItemSchema>;

/**
 * Lịch các đợt thanh toán (Payment Schedules)
 */
export const paymentScheduleDtoSchema = z.object({
  id: uuidSchema,
  cost_item_id: uuidSchema,
  installment_number: z.number().int().min(1),
  title: requiredStringSchema('Tên đợt thanh toán', 100),
  amount_due: vndCurrencyStringSchema,
  due_date: dateStringSchema,
  status: scheduleStatusEnum,
  notes: notesSchema,
  version: versionSchema,
  created_at: dateTimeStringSchema,
  updated_at: dateTimeStringSchema,
});
export type PaymentScheduleDto = z.infer<typeof paymentScheduleDtoSchema>;

export const createPaymentScheduleSchema = z.object({
  cost_item_id: uuidSchema,
  installment_number: z.number().int().min(1, { message: 'Đợt thanh toán tối thiểu là 1' }),
  title: requiredStringSchema('Tên đợt thanh toán', 100),
  amount_due: vndCurrencyStringSchema.refine((val) => BigInt(val) > 0n, {
    message: 'Số tiền phải trả của đợt phải lớn hơn 0',
  }),
  due_date: dateStringSchema,
  status: scheduleStatusEnum.default('estimated'),
  notes: notesSchema,
});
export type CreatePaymentScheduleInput = z.infer<typeof createPaymentScheduleSchema>;

/**
 * Mốc mở sổ quỹ (Fund Settings - AT37, AT45)
 */
export const fundSettingsDtoSchema = z.object({
  id: uuidSchema,
  opening_as_of: dateTimeStringSchema.nullable().optional(),
  initial_balance: vndCurrencyStringSchema.default('0'),
  fund_scope_confirmed: z.boolean(),
  confirmed_by: z.string().nullable().optional(),
  notes: notesSchema,
  version: versionSchema,
  created_at: dateTimeStringSchema,
  updated_at: dateTimeStringSchema,
});
export type FundSettingsDto = z.infer<typeof fundSettingsDtoSchema>;

export const updateFundSettingsSchema = z.object({
  opening_as_of: dateTimeStringSchema.nullable().optional(),
  initial_balance: vndCurrencyStringSchema,
  fund_scope_confirmed: z.boolean(),
  notes: notesSchema,
  version: versionSchema,
});
export type UpdateFundSettingsInput = z.infer<typeof updateFundSettingsSchema>;

/**
 * Nguồn tiền đóng góp & Trả hộ trực tiếp (Funding Entries - AT38)
 */
export const fundingEntryDtoSchema = z.object({
  id: uuidSchema,
  entry_type: fundingEntryTypeEnum,
  amount: vndCurrencyStringSchema,
  contributor_name: z.string().trim().max(100).nullable().optional(),
  contribution_date: dateTimeStringSchema,
  linked_cost_item_id: uuidSchema.nullable().optional(),
  linked_payment_id: uuidSchema.nullable().optional(),
  notes: notesSchema,
  is_voided: z.boolean(),
  voided_reason: notesSchema,
  version: versionSchema,
  created_at: dateTimeStringSchema,
  updated_at: dateTimeStringSchema,
});
export type FundingEntryDto = z.infer<typeof fundingEntryDtoSchema>;

export const createFundingEntrySchema = z.object({
  entry_type: fundingEntryTypeEnum,
  amount: vndCurrencyStringSchema.refine((val) => BigInt(val) > 0n, {
    message: 'Số tiền đóng góp phải lớn hơn 0',
  }),
  contributor_name: z.string().trim().max(100).nullable().optional(),
  contribution_date: dateTimeStringSchema.default(() => new Date().toISOString()),
  linked_cost_item_id: uuidSchema.nullable().optional(),
  notes: notesSchema,
}).refine(
  (data) => {
    // Nếu là người thân trả hộ trực tiếp nhà cung cấp (AT38), bắt buộc phải có linked_cost_item_id
    if (data.entry_type === 'direct_vendor_payment') {
      return Boolean(data.linked_cost_item_id);
    }
    return true;
  },
  {
    message: 'Giao dịch trả hộ trực tiếp bắt buộc phải gắn với một khoản chi cụ thể',
    path: ['linked_cost_item_id'],
  }
);
export type CreateFundingEntryInput = z.infer<typeof createFundingEntrySchema>;

/**
 * Giao dịch chi / nhận hoàn tiền (Payments - AT12, AT14, AT47)
 */
export const paymentDtoSchema = z.object({
  id: uuidSchema,
  cost_item_id: uuidSchema,
  payment_type: paymentTypeEnum,
  amount: vndCurrencyStringSchema,
  transaction_time: dateTimeStringSchema,
  payment_method: paymentMethodEnum,
  payer_name: z.string().trim().max(100).nullable().optional(),
  recipient_name: z.string().trim().max(100).nullable().optional(),
  parent_payment_id: uuidSchema.nullable().optional(),
  is_direct_third_party: z.boolean(),
  linked_funding_entry_id: uuidSchema.nullable().optional(),
  notes: notesSchema,
  is_voided: z.boolean(),
  voided_reason: notesSchema,
  version: versionSchema,
  created_at: dateTimeStringSchema,
  updated_at: dateTimeStringSchema,
});
export type PaymentDto = z.infer<typeof paymentDtoSchema>;

export const createPaymentSchema = z.object({
  cost_item_id: uuidSchema,
  payment_type: paymentTypeEnum.default('outflow'),
  amount: vndCurrencyStringSchema.refine((val) => BigInt(val) > 0n, {
    message: 'Số tiền thanh toán phải lớn hơn 0',
  }),
  transaction_time: dateTimeStringSchema.default(() => new Date().toISOString()),
  payment_method: paymentMethodEnum.default('bank_transfer'),
  payer_name: z.string().trim().max(100).nullable().optional(),
  recipient_name: z.string().trim().max(100).nullable().optional(),
  parent_payment_id: uuidSchema.nullable().optional(),
  is_direct_third_party: z.boolean().default(false),
  schedule_allocations: z.array(
    z.object({
      schedule_id: uuidSchema.nullable().optional(), // null = trả trước/chưa phân đợt (AT46)
      amount: vndCurrencyStringSchema,
    })
  ).default([]),
  notes: notesSchema,
}).refine(
  (data) => {
    // Nếu là hoàn tiền (refund), bắt buộc phải có parent_payment_id
    if (data.payment_type === 'refund') {
      return Boolean(data.parent_payment_id);
    }
    return true;
  },
  {
    message: 'Giao dịch hoàn tiền bắt buộc phải tham chiếu đến giao dịch chi gốc (parent_payment_id)',
    path: ['parent_payment_id'],
  }
);
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

/**
 * Hủy ghi nhận giao dịch (Void Payment)
 */
export const voidPaymentSchema = z.object({
  payment_id: uuidSchema,
  voided_reason: requiredStringSchema('Lý do hủy giao dịch', 255),
  version: versionSchema,
});
export type VoidPaymentInput = z.infer<typeof voidPaymentSchema>;

/**
 * Tổng hợp tài chính của từng khoản chi (Cost Item Financial Calculation DTO)
 * Đáp ứng AT11, AT15, FX02
 */
export const costItemFinancialSummaryDtoSchema = z.object({
  cost_item_id: uuidSchema,
  forecast_amount: vndCurrencyStringSchema.nullable(),
  is_price_missing: z.boolean(),
  total_outflow: vndCurrencyStringSchema,
  total_refund: vndCurrencyStringSchema,
  net_paid: vndCurrencyStringSchema,
  balance_due: vndCurrencyStringSchema.nullable(), // null = UNDEFINED khi chưa có giá (AT11)
  surplus: vndCurrencyStringSchema, // Dư thanh toán nếu trả thừa (AT15)
});
export type CostItemFinancialSummaryDto = z.infer<typeof costItemFinancialSummaryDtoSchema>;

/**
 * Tổng hợp ngân sách toàn đám cưới (Overall Budget & Cashflow DTO)
 * Đáp ứng AT15, AT17, AT45, FX03
 */
export const overallBudgetSummaryDtoSchema = z.object({
  target_budget: vndCurrencyStringSchema.nullable(),
  total_forecast_cost: vndCurrencyStringSchema,
  has_missing_prices: z.boolean(),
  missing_prices_count: z.number().int().min(0),
  total_net_paid: vndCurrencyStringSchema,
  total_confirmed_balance_due: vndCurrencyStringSchema,
  total_surplus: vndCurrencyStringSchema, // Tách biệt độc lập, không cấn trừ sang nợ (AT15)
  available_cash: vndCurrencyStringSchema, // Tính theo mốc opening_as_of (AT45, FX03)
});
export type OverallBudgetSummaryDto = z.infer<typeof overallBudgetSummaryDtoSchema>;
