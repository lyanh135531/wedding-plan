import { z } from 'zod';
import {
  uuidSchema,
  versionSchema,
  dateStringSchema,
  dateTimeStringSchema,
  vndCurrencyStringSchema,
  nullableVndCurrencyStringSchema,
  nullableVietnamesePhoneSchema,
  nullableEmailSchema,
  requiredStringSchema,
  notesSchema,
} from './common';
import { costStatusEnum } from './finance';

// -----------------------------------------------------------------------------
// 1. ENUMS
// -----------------------------------------------------------------------------

export const vendorServiceTypeEnum = z.enum([
  'venue',
  'catering',
  'photography',
  'videography',
  'decoration',
  'attire',
  'makeup',
  'invitation',
  'music_entertainment',
  'transportation',
  'accommodation',
  'other',
]);
export type VendorServiceType = z.infer<typeof vendorServiceTypeEnum>;

export const vendorStatusEnum = z.enum([
  'researching',
  'contacted',
  'quoted',
  'shortlisted',
  'selected',
  'rejected',
  'cancelled',
]);
export type VendorStatus = z.infer<typeof vendorStatusEnum>;

export const capacityFitEnum = z.enum([
  'below_min',
  'optimal',
  'exceeds_max',
  'unspecified',
]);
export type CapacityFit = z.infer<typeof capacityFitEnum>;

// -----------------------------------------------------------------------------
// 2. VENDOR SCHEMAS
// -----------------------------------------------------------------------------

export const vendorDtoSchema = z.object({
  id: uuidSchema,
  name: requiredStringSchema('Tên nhà cung cấp', 150),
  service_type: vendorServiceTypeEnum,
  status: vendorStatusEnum,
  contact_person: z.string().trim().max(100).nullable().optional(),
  phone: nullableVietnamesePhoneSchema,
  email: nullableEmailSchema,
  address: z.string().trim().max(255).nullable().optional(),
  map_url: z.string().trim().max(500).nullable().optional(),
  website: z.string().trim().max(500).nullable().optional(),
  notes: notesSchema,
  rating: z.number().int().min(1).max(5).nullable().optional(),

  // Venue specific parameters (PLAN §11.2)
  capacity: z.number().int().positive().nullable().optional(),
  min_guests: z.number().int().nonnegative().nullable().optional(),
  table_price: nullableVndCurrencyStringSchema,
  seats_per_table: z.number().int().positive().nullable().optional(),
  rental_fee: nullableVndCurrencyStringSchema,
  fees_inclusive: z.boolean(),
  prep_time: z.string().trim().max(50).nullable().optional(),
  end_time: z.string().trim().max(50).nullable().optional(),
  parking_notes: notesSchema,
  rain_plan: notesSchema,
  decor_audio_rules: notesSchema,
  extra_fees_notes: notesSchema,

  version: versionSchema,
  created_at: dateTimeStringSchema,
  updated_at: dateTimeStringSchema,
});
export type VendorDto = z.infer<typeof vendorDtoSchema>;

export const vendorSummaryDtoSchema = z.object({
  id: uuidSchema,
  name: requiredStringSchema('Tên nhà cung cấp', 150),
  service_type: vendorServiceTypeEnum,
  status: vendorStatusEnum,
  contact_person: z.string().trim().max(100).nullable().optional(),
  phone: nullableVietnamesePhoneSchema,
  email: nullableEmailSchema,
  address: z.string().trim().max(255).nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  capacity: z.number().int().positive().nullable().optional(),
  rental_fee: nullableVndCurrencyStringSchema,
  table_price: nullableVndCurrencyStringSchema,
  fees_inclusive: z.boolean(),
  version: versionSchema,
  quotes_count: z.number().int().nonnegative().optional(),
  selected_quote_name: z.string().nullable().optional(),
  created_at: dateTimeStringSchema,
  updated_at: dateTimeStringSchema,
});
export type VendorSummaryDto = z.infer<typeof vendorSummaryDtoSchema>;

export const createVendorSchema = z.object({
  name: requiredStringSchema('Tên nhà cung cấp', 150),
  service_type: vendorServiceTypeEnum.default('other'),
  status: vendorStatusEnum.default('researching'),
  contact_person: z.string().trim().max(100).nullable().optional(),
  phone: nullableVietnamesePhoneSchema,
  email: nullableEmailSchema,
  address: z.string().trim().max(255).nullable().optional(),
  map_url: z.string().trim().max(500).nullable().optional(),
  website: z.string().trim().max(500).nullable().optional(),
  notes: notesSchema,
  rating: z.number().int().min(1).max(5).nullable().optional(),

  // Venue parameters
  capacity: z.number().int().positive().nullable().optional(),
  min_guests: z.number().int().nonnegative().nullable().optional(),
  table_price: nullableVndCurrencyStringSchema,
  seats_per_table: z.number().int().positive().nullable().optional(),
  rental_fee: nullableVndCurrencyStringSchema,
  fees_inclusive: z.boolean().default(false),
  prep_time: z.string().trim().max(50).nullable().optional(),
  end_time: z.string().trim().max(50).nullable().optional(),
  parking_notes: notesSchema,
  rain_plan: notesSchema,
  decor_audio_rules: notesSchema,
  extra_fees_notes: notesSchema,
});
export type CreateVendorInput = z.infer<typeof createVendorSchema>;

export const updateVendorSchema = createVendorSchema.partial().extend({
  version: versionSchema,
});
export type UpdateVendorInput = z.infer<typeof updateVendorSchema>;

export const listVendorsQuerySchema = z.object({
  service_type: vendorServiceTypeEnum.optional(),
  status: vendorStatusEnum.optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  role: z.enum(['owner', 'family_view']).default('owner'),
});
export type ListVendorsQuery = z.infer<typeof listVendorsQuerySchema>;

// -----------------------------------------------------------------------------
// 3. CONTACT SCHEMAS
// -----------------------------------------------------------------------------

export const contactDtoSchema = z.object({
  id: uuidSchema,
  vendor_id: uuidSchema,
  name: requiredStringSchema('Tên người liên hệ', 100),
  role: z.string().trim().max(100).nullable().optional(),
  phone: nullableVietnamesePhoneSchema,
  email: nullableEmailSchema,
  is_primary: z.boolean(),
  notes: notesSchema,
  created_at: dateTimeStringSchema,
  updated_at: dateTimeStringSchema,
});
export type ContactDto = z.infer<typeof contactDtoSchema>;

export const createContactSchema = z.object({
  name: requiredStringSchema('Tên người liên hệ', 100),
  role: z.string().trim().max(100).nullable().optional(),
  phone: nullableVietnamesePhoneSchema,
  email: nullableEmailSchema,
  is_primary: z.boolean().default(false),
  notes: notesSchema,
});
export type CreateContactInput = z.infer<typeof createContactSchema>;

// -----------------------------------------------------------------------------
// 4. QUOTE SCHEMAS
// -----------------------------------------------------------------------------

export const quoteDtoSchema = z.object({
  id: uuidSchema,
  vendor_id: uuidSchema,
  package_group_id: uuidSchema,
  version_number: z.number().int().min(1),
  parent_quote_id: uuidSchema.nullable().optional(),
  quote_name: requiredStringSchema('Tên báo giá', 150),
  received_date: dateStringSchema,
  valid_until: dateStringSchema.nullable().optional(),

  // AT24: total_amount là nullable VND string. Null = "Chưa báo", KHÔNG thay thế bằng "0"
  total_amount: nullableVndCurrencyStringSchema,
  is_estimate: z.boolean(),

  guest_count_assumption: z.number().int().positive().nullable().optional(),
  table_count_assumption: z.number().int().positive().nullable().optional(),

  terms: notesSchema,
  includes: z.array(z.string()).default([]),
  excludes: z.array(z.string()).default([]),
  deposit_conditions: notesSchema,
  is_selected: z.boolean(),
  created_by: z.string().nullable().optional(),
  created_at: dateTimeStringSchema,
  updated_at: dateTimeStringSchema,
});
export type QuoteDto = z.infer<typeof quoteDtoSchema>;

export const createQuoteSchema = z.object({
  quote_name: requiredStringSchema('Tên báo giá', 150),
  received_date: dateStringSchema,
  valid_until: dateStringSchema.nullable().optional(),
  total_amount: nullableVndCurrencyStringSchema,
  is_estimate: z.boolean().default(false),
  guest_count_assumption: z.number().int().positive().nullable().optional(),
  table_count_assumption: z.number().int().positive().nullable().optional(),
  terms: notesSchema,
  includes: z.array(z.string()).default([]),
  excludes: z.array(z.string()).default([]),
  deposit_conditions: notesSchema,
}).refine(
  (data) => {
    if (data.valid_until && data.received_date) {
      return data.valid_until >= data.received_date;
    }
    return true;
  },
  {
    message: 'Ngày hết hạn báo giá phải sau hoặc bằng ngày nhận báo giá',
    path: ['valid_until'],
  }
);
export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;

export const reviseQuoteSchema = z.object({
  quote_name: requiredStringSchema('Tên báo giá', 150).optional(),
  received_date: dateStringSchema.optional(),
  valid_until: dateStringSchema.nullable().optional(),
  total_amount: nullableVndCurrencyStringSchema,
  is_estimate: z.boolean().optional(),
  guest_count_assumption: z.number().int().positive().nullable().optional(),
  table_count_assumption: z.number().int().positive().nullable().optional(),
  terms: notesSchema,
  includes: z.array(z.string()).optional(),
  excludes: z.array(z.string()).optional(),
  deposit_conditions: notesSchema,
  revision_reason: z.string().trim().max(255).optional(),
}).refine(
  (data) => {
    if (data.valid_until && data.received_date) {
      return data.valid_until >= data.received_date;
    }
    return true;
  },
  {
    message: 'Ngày hết hạn báo giá phải sau hoặc bằng ngày nhận báo giá',
    path: ['valid_until'],
  }
);
export type ReviseQuoteInput = z.infer<typeof reviseQuoteSchema>;

// -----------------------------------------------------------------------------
// 5. COMPARISON SCHEMAS
// -----------------------------------------------------------------------------

export const comparePackagesRequestSchema = z.object({
  quote_ids: z
    .array(uuidSchema)
    .min(2, { message: 'Cần tối thiểu 2 báo giá để so sánh' })
    .max(4, { message: 'Tối đa so sánh 4 báo giá cùng lúc' }),
  table_count: z.number().int().positive({ message: 'Số bàn mô phỏng phải là số nguyên dương' }).default(20),
  guest_count: z.number().int().positive({ message: 'Số khách mô phỏng phải là số nguyên dương' }).optional(),
  include_vat_and_service_fee: z.boolean().default(true),
});
export type ComparePackagesRequest = z.infer<typeof comparePackagesRequestSchema>;

export const comparePackageSimulationDtoSchema = z.object({
  table_count: z.number().int(),
  guest_count: z.number().int(),
  base_amount: nullableVndCurrencyStringSchema,
  table_costs: nullableVndCurrencyStringSchema,
  rental_fee: nullableVndCurrencyStringSchema,
  subtotal: nullableVndCurrencyStringSchema,
  estimated_vat: nullableVndCurrencyStringSchema,
  estimated_service_charge: nullableVndCurrencyStringSchema,
  total_estimated: nullableVndCurrencyStringSchema,
  is_missing_price: z.boolean(),
  missing_price_label: z.string(), // "Chưa báo" nếu thiếu giá
});
export type ComparePackageSimulationDto = z.infer<typeof comparePackageSimulationDtoSchema>;

export const comparePackageItemDtoSchema = z.object({
  quote_id: uuidSchema,
  vendor_id: uuidSchema,
  vendor_name: z.string(),
  package_name: z.string(),
  version_number: z.number().int(),
  received_date: dateStringSchema,
  rental_fee: nullableVndCurrencyStringSchema,
  table_price: nullableVndCurrencyStringSchema,
  total_amount: nullableVndCurrencyStringSchema,
  capacity_fit: capacityFitEnum,
  capacity_warning: z.string().nullable(),
  simulation: comparePackageSimulationDtoSchema,
  fees_inclusive: z.boolean(),
  includes: z.array(z.string()),
  excludes: z.array(z.string()),
  deposit_conditions: z.string().nullable(),
  terms: z.string().nullable(),
});
export type ComparePackageItemDto = z.infer<typeof comparePackageItemDtoSchema>;

export const comparePackagesResponseSchema = z.object({
  simulation_params: z.object({
    table_count: z.number().int(),
    guest_count: z.number().int(),
    include_vat_and_service_fee: z.boolean(),
  }),
  packages: z.array(comparePackageItemDtoSchema),
});
export type ComparePackagesResponse = z.infer<typeof comparePackagesResponseSchema>;

// -----------------------------------------------------------------------------
// 6. QUOTE TO COST SCHEMAS
// -----------------------------------------------------------------------------

export const quoteToCostPreviewResponseSchema = z.object({
  quote_id: uuidSchema,
  vendor_id: uuidSchema,
  vendor_name: z.string(),
  quote_name: z.string(),
  version_number: z.number().int(),
  suggested_cost_item_name: z.string(),
  suggested_amount: nullableVndCurrencyStringSchema,
  is_price_missing: z.boolean(),
  is_already_converted: z.boolean(),
  existing_cost_item: z
    .object({
      id: uuidSchema,
      name: z.string(),
      status: costStatusEnum,
      contracted_amount: nullableVndCurrencyStringSchema,
    })
    .nullable()
    .optional(),
  available_categories: z.array(
    z.object({
      id: uuidSchema,
      name: z.string(),
    })
  ),
  available_events: z.array(
    z.object({
      id: uuidSchema,
      title: z.string(),
    })
  ),
});
export type QuoteToCostPreviewResponse = z.infer<typeof quoteToCostPreviewResponseSchema>;

export const convertQuoteToCostRequestSchema = z.object({
  category_id: uuidSchema,
  name: z.string().trim().max(150).optional(),
  event_id: uuidSchema.nullable().optional(),
  in_charge_user_id: z.string().nullable().optional(),
  status: costStatusEnum.default('contracted'),
  notes: notesSchema,
});
export type ConvertQuoteToCostInput = z.input<typeof convertQuoteToCostRequestSchema>;

export const convertQuoteToCostResponseSchema = z.object({
  is_already_converted: z.boolean(),
  cost_item_id: uuidSchema,
  cost_item_name: z.string(),
  action: z.enum(['created_new', 'already_existed']),
});
export type ConvertQuoteToCostResponse = z.infer<typeof convertQuoteToCostResponseSchema>;
