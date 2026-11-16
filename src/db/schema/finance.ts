import {
  pgTable,
  text,
  timestamp,
  boolean,
  uuid,
  integer,
  bigint,
  date,
  pgEnum,
  unique,
  uniqueIndex,
  check,
  index,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";
import { events } from "./events";
import { vendors, vendorQuotes } from "./vendors";

export const costStatusEnum = pgEnum("cost_status", [
  "draft",
  "contracted",
  "completed",
  "cancelling",
  "cancelled",
]);

export const scheduleStatusEnum = pgEnum("schedule_status", ["estimated", "agreed", "cancelled"]);
export const paymentTypeEnum = pgEnum("payment_type", ["outflow", "refund"]);
export const paymentMethodEnum = pgEnum("payment_method", ["cash", "bank_transfer", "other"]);
export const fundingEntryTypeEnum = pgEnum("funding_entry_type", [
  "cash_fund",
  "direct_vendor_payment",
  "pledged_unreceived",
]);

/**
 * 15. budget_categories: High-level budget grouping (Venue, Attire, Photo/Video)
 */
export const budgetCategories = pgTable("budget_categories", {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  name: text("name").notNull().unique(),
  defaultOrder: integer("default_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .default(sql`clock_timestamp()`)
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .default(sql`clock_timestamp()`)
    .notNull(),
});

/**
 * 16. category_budgets: Allocated budget limit per category
 */
export const categoryBudgets = pgTable(
  "category_budgets",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    categoryId: uuid("category_id")
      .notNull()
      .unique()
      .references(() => budgetCategories.id, { onDelete: "cascade" }),
    allocatedAmount: bigint("allocated_amount", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
  },
  (table) => ({
    allocatedCheck: check("category_budgets_allocated_check", sql`allocated_amount >= 0`),
  })
);

/**
 * 17. cost_items: Individual vendor contract or expense item
 */
export const costItems = pgTable(
  "cost_items",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    name: text("name").notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => budgetCategories.id, { onDelete: "restrict" }),
    eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
    vendorName: text("vendor_name"),
    vendorPhone: text("vendor_phone"),
    vendorContact: text("vendor_contact"),
    vendorId: uuid("vendor_id").references(() => vendors.id, { onDelete: "set null" }),
    vendorQuoteId: uuid("vendor_quote_id").references(() => vendorQuotes.id, { onDelete: "set null" }),
    estimatedAmount: bigint("estimated_amount", { mode: "bigint" }),
    contractedAmount: bigint("contracted_amount", { mode: "bigint" }),
    finalSettlementAmount: bigint("final_settlement_amount", { mode: "bigint" }), // 0 is VALID!
    status: costStatusEnum("status").notNull().default("draft"),
    inChargeUserId: text("in_charge_user_id").references(() => users.id, { onDelete: "set null" }),
    cancellationFee: bigint("cancellation_fee", { mode: "bigint" }),
    cancellationNotes: text("cancellation_notes"),
    notes: text("notes"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
  },
  (table) => ({
    estimatedCheck: check("cost_items_estimated_check", sql`estimated_amount IS NULL OR estimated_amount >= 0`),
    contractedCheck: check("cost_items_contracted_check", sql`contracted_amount IS NULL OR contracted_amount >= 0`),
    settlementCheck: check("cost_items_settlement_check", sql`final_settlement_amount IS NULL OR final_settlement_amount >= 0`),
    cancellationFeeCheck: check("cost_items_cancellation_fee_check", sql`cancellation_fee IS NULL OR cancellation_fee >= 0`),
    categoryIdx: index("cost_items_category_id_idx").on(table.categoryId),
    vendorIdIdx: index("cost_items_vendor_id_idx").on(table.vendorId),
    vendorQuoteIdIdx: index("cost_items_vendor_quote_id_idx").on(table.vendorQuoteId),
    vendorQuoteIdUnique: uniqueIndex("cost_items_vendor_quote_id_unique")
      .on(table.vendorQuoteId)
      .where(sql`vendor_quote_id IS NOT NULL`),
  })
);

/**
 * 18. payment_schedules: Contract payment installments
 */
export const paymentSchedules = pgTable(
  "payment_schedules",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    costItemId: uuid("cost_item_id")
      .notNull()
      .references(() => costItems.id, { onDelete: "cascade" }),
    installmentNumber: integer("installment_number").notNull(),
    title: text("title").notNull(),
    amountDue: bigint("amount_due", { mode: "bigint" }).notNull(),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    status: scheduleStatusEnum("status").notNull().default("estimated"),
    notes: text("notes"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
  },
  (table) => ({
    uniqueItemInstallment: unique("payment_schedules_item_installment_unique").on(
      table.costItemId,
      table.installmentNumber
    ),
    installmentCheck: check("payment_schedules_installment_check", sql`installment_number >= 1`),
    amountCheck: check("payment_schedules_amount_check", sql`amount_due > 0`),
  })
);

/**
 * 19. fund_settings: Cash ledger anchor date (opening_as_of) and initial verified balance
 */
export const fundSettings = pgTable(
  "fund_settings",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    openingAsOf: timestamp("opening_as_of", { withTimezone: true, mode: "date" }),
    initialBalance: bigint("initial_balance", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    fundScopeConfirmed: boolean("fund_scope_confirmed").notNull().default(false),
    confirmedBy: text("confirmed_by").references(() => users.id, { onDelete: "set null" }),
    notes: text("notes"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
  },
  (table) => ({
    balanceCheck: check("fund_settings_initial_balance_check", sql`initial_balance >= 0`),
  })
);

/**
 * 20. funding_entries: Sources of funds (contributions, gifts, third-party direct vendor payments)
 */
export const fundingEntries = pgTable(
  "funding_entries",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    entryType: fundingEntryTypeEnum("entry_type").notNull(),
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    contributorName: text("contributor_name"),
    contributionDate: timestamp("contribution_date", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
    linkedCostItemId: uuid("linked_cost_item_id").references(() => costItems.id, { onDelete: "restrict" }),
    linkedPaymentId: uuid("linked_payment_id"),
    notes: text("notes"),
    isVoided: boolean("is_voided").notNull().default(false),
    voidedReason: text("voided_reason"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
  },
  (table) => ({
    amountCheck: check("funding_entries_amount_check", sql`amount > 0`),
  })
);

/**
 * 21. payments: Actual cash/bank disbursements and refunds
 */
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    costItemId: uuid("cost_item_id")
      .notNull()
      .references(() => costItems.id, { onDelete: "restrict" }),
    paymentType: paymentTypeEnum("payment_type").notNull().default("outflow"),
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    transactionTime: timestamp("transaction_time", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
    paymentMethod: paymentMethodEnum("payment_method").notNull().default("bank_transfer"),
    payerName: text("payer_name"),
    recipientName: text("recipient_name"),
    parentPaymentId: uuid("parent_payment_id").references((): AnyPgColumn => payments.id, {
      onDelete: "restrict",
    }),
    isDirectThirdParty: boolean("is_direct_third_party").notNull().default(false),
    linkedFundingEntryId: uuid("linked_funding_entry_id").references(() => fundingEntries.id, {
      onDelete: "restrict",
    }),
    notes: text("notes"),
    isVoided: boolean("is_voided").notNull().default(false),
    voidedReason: text("voided_reason"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
  },
  (table) => ({
    amountCheck: check("payments_amount_check", sql`amount > 0`),
    costItemIdx: index("payments_cost_item_id_idx").on(table.costItemId),
    transactionTimeIdx: index("payments_transaction_time_idx").on(table.transactionTime),
    parentPaymentIdx: index("payments_parent_payment_id_idx").on(table.parentPaymentId),
  })
);

/**
 * 22. payment_allocations: Ledger distributing paid amounts across installments
 */
export const paymentAllocations = pgTable(
  "payment_allocations",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "cascade" }),
    scheduleId: uuid("schedule_id").references(() => paymentSchedules.id, { onDelete: "restrict" }), // NULL = unassigned deposit
    allocatedAmount: bigint("allocated_amount", { mode: "bigint" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
  },
  (table) => ({
    allocatedAmountCheck: check("payment_allocations_amount_check", sql`allocated_amount > 0`),
  })
);
