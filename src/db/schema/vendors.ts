import {
  pgTable,
  text,
  timestamp,
  boolean,
  uuid,
  integer,
  bigint,
  date,
  jsonb,
  pgEnum,
  unique,
  check,
  index,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";

// -----------------------------------------------------------------------------
// ENUMS
// -----------------------------------------------------------------------------

export const vendorServiceTypeEnum = pgEnum("vendor_service_type", [
  "venue",
  "catering",
  "photography",
  "videography",
  "decoration",
  "attire",
  "makeup",
  "invitation",
  "music_entertainment",
  "transportation",
  "accommodation",
  "other",
]);

export const vendorStatusEnum = pgEnum("vendor_status", [
  "researching", // Đang tìm
  "contacted",   // Đã liên hệ
  "quoted",      // Đã có báo giá
  "shortlisted", // Danh sách rút gọn
  "selected",    // Đã chọn
  "rejected",    // Không chọn
  "cancelled",   // Hủy
]);

// -----------------------------------------------------------------------------
// 1. VENDORS TABLE
// -----------------------------------------------------------------------------

export const vendors = pgTable(
  "vendors",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    name: text("name").notNull(),
    serviceType: vendorServiceTypeEnum("service_type").notNull().default("other"),
    status: vendorStatusEnum("status").notNull().default("researching"),
    contactPerson: text("contact_person"),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    mapUrl: text("map_url"),
    website: text("website"),
    notes: text("notes"),
    rating: integer("rating"), // Đánh giá cảm quan 1-5 sao

    // Các trường đặc thù Địa điểm (P1 Venue Specification - PLAN §11.2)
    capacity: integer("capacity"),                          // Sức chứa tối đa (khách)
    minGuests: integer("min_guests"),                      // Số khách tối thiểu
    tablePrice: bigint("table_price", { mode: "bigint" }),  // Giá bàn tham khảo (VND nullable)
    seatsPerTable: integer("seats_per_table"),              // Số ghế mỗi bàn
    rentalFee: bigint("rental_fee", { mode: "bigint" }),    // Phí thuê sảnh/địa điểm (VND nullable)
    feesInclusive: boolean("fees_inclusive").notNull().default(false), // Đã gồm thuế/phí dịch vụ
    prepTime: text("prep_time"),                            // Giờ được vào chuẩn bị (vd: "08:00")
    endTime: text("end_time"),                              // Giờ kết thúc tiệc (vd: "22:00")
    parkingNotes: text("parking_notes"),                    // Bãi đỗ xe
    rainPlan: text("rain_plan"),                            // Phương án dự phòng mưa
    decorAudioRules: text("decor_audio_rules"),              // Quy định âm thanh & trang trí
    extraFeesNotes: text("extra_fees_notes"),                // Chi phí phát sinh tiềm ẩn

    // Quản lý phiên bản & thời gian
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
  },
  (table) => ({
    capacityCheck: check("vendors_capacity_check", sql`capacity IS NULL OR capacity > 0`),
    minGuestsCheck: check("vendors_min_guests_check", sql`min_guests IS NULL OR min_guests >= 0`),
    seatsCheck: check("vendors_seats_per_table_check", sql`seats_per_table IS NULL OR seats_per_table > 0`),
    tablePriceCheck: check("vendors_table_price_check", sql`table_price IS NULL OR table_price >= 0`),
    rentalFeeCheck: check("vendors_rental_fee_check", sql`rental_fee IS NULL OR rental_fee >= 0`),
    ratingCheck: check("vendors_rating_check", sql`rating IS NULL OR (rating >= 1 AND rating <= 5)`),
    serviceTypeIdx: index("vendors_service_type_idx").on(table.serviceType),
    statusIdx: index("vendors_status_idx").on(table.status),
    nameTrgmIdx: index("vendors_name_trgm_idx").using(
      "gin",
      sql`immutable_unaccent(lower(${table.name})) gin_trgm_ops`
    ),
  })
);

// -----------------------------------------------------------------------------
// 2. VENDOR QUOTES TABLE
// -----------------------------------------------------------------------------

export const vendorQuotes = pgTable(
  "vendor_quotes",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),
    packageGroupId: uuid("package_group_id")
      .default(sql`gen_random_uuid()`)
      .notNull(),
    versionNumber: integer("version_number").notNull().default(1),
    parentQuoteId: uuid("parent_quote_id").references((): AnyPgColumn => vendorQuotes.id, {
      onDelete: "set null",
    }),
    quoteName: text("quote_name").notNull(),
    receivedDate: date("received_date", { mode: "string" }).notNull(),
    validUntil: date("valid_until", { mode: "string" }),

    // AT24: total_amount là nullable bigint. KHÔNG gán default 0n. Null biểu thị "Chưa báo".
    totalAmount: bigint("total_amount", { mode: "bigint" }),
    isEstimate: boolean("is_estimate").notNull().default(false),

    // Tham số giả định mô phỏng so sánh (PLAN §11.2)
    guestCountAssumption: integer("guest_count_assumption"),
    tableCountAssumption: integer("table_count_assumption"),

    // Nội dung gói & Điều khoản
    terms: text("terms"),
    includes: jsonb("includes")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    excludes: jsonb("excludes")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    depositConditions: text("deposit_conditions"), // Điều kiện cọc/hủy/hoàn

    isSelected: boolean("is_selected").notNull().default(false),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
  },
  (table) => ({
    // AT24: Đảm bảo tính bất biến của phiên bản báo giá trong cùng 1 vendor
    vendorVersionUnique: unique("vendor_quotes_vendor_version_unique").on(
      table.vendorId,
      table.versionNumber
    ),
    versionNumberCheck: check("vendor_quotes_version_number_check", sql`version_number >= 1`),
    totalAmountCheck: check(
      "vendor_quotes_total_amount_check",
      sql`total_amount IS NULL OR total_amount >= 0`
    ),
    validityOrderCheck: check(
      "vendor_quotes_validity_order_check",
      sql`valid_until IS NULL OR valid_until >= received_date`
    ),
    vendorIdIdx: index("vendor_quotes_vendor_id_idx").on(table.vendorId),
    packageGroupIdIdx: index("vendor_quotes_package_group_id_idx").on(table.packageGroupId),
    isSelectedIdx: index("vendor_quotes_is_selected_idx").on(table.vendorId, table.isSelected),
  })
);

// -----------------------------------------------------------------------------
// 3. CONTACTS TABLE
// -----------------------------------------------------------------------------

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    role: text("role"),
    phone: text("phone"),
    email: text("email"),
    isPrimary: boolean("is_primary").notNull().default(false),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
  },
  (table) => ({
    vendorIdIdx: index("contacts_vendor_id_idx").on(table.vendorId),
    phoneIdx: index("contacts_phone_idx").on(table.phone),
  })
);
