import {
  pgTable,
  text,
  timestamp,
  boolean,
  uuid,
  integer,
  jsonb,
  pgEnum,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";

export const idempotencyStatusEnum = pgEnum("idempotency_status", ["processing", "completed", "failed"]);
export const importTypeEnum = pgEnum("import_type", ["guests", "cost_items"]);
export const batchStatusEnum = pgEnum("batch_status", ["staged", "committed", "rolled_back"]);

/**
 * 29. audit_logs: Append-only audit trail capturing state before and after mutation
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    userId: text("user_id").notNull(),
    action: text("action").notNull(), // CREATE, UPDATE, DELETE, VOID, MERGE, RESCHEDULE
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    beforeState: jsonb("before_state"),
    afterState: jsonb("after_state"),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
  },
  (table) => ({
    entityIdx: index("audit_logs_entity_idx").on(table.entityType, table.entityId),
    userIdIdx: index("audit_logs_user_idx").on(table.userId),
  })
);

/**
 * 30. notifications: In-app notification center alerts, snooze state, and deduplication
 */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deduplicationKey: text("deduplication_key").notNull().unique(),
    isRead: boolean("is_read").notNull().default(false),
    snoozedUntil: timestamp("snoozed_until", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
  },
  (table) => ({
    userUnreadIdx: index("notifications_user_unread_idx").on(table.userId, table.isRead),
  })
);

/**
 * 31. idempotency_records: Replay attack and double-submit prevention for financial mutations
 */
export const idempotencyRecords = pgTable(
  "idempotency_records",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    operationType: text("operation_type").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestHash: text("request_hash").notNull(),
    status: idempotencyStatusEnum("status").notNull().default("processing"),
    responseStatus: integer("response_status"),
    responseBody: jsonb("response_body"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => ({
    uniqueUserOpKey: unique("idempotency_records_unique").on(
      table.userId,
      table.operationType,
      table.idempotencyKey
    ),
  })
);

/**
 * 32. import_batches: Header tracking atomic batch imports (CSV/XLSX)
 */
export const importBatches = pgTable("import_batches", {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  importType: importTypeEnum("import_type").notNull(),
  fileName: text("file_name").notNull(),
  totalRows: integer("total_rows").notNull(),
  validRows: integer("valid_rows").notNull().default(0),
  skippedRows: integer("skipped_rows").notNull().default(0),
  errorRows: integer("error_rows").notNull().default(0),
  status: batchStatusEnum("status").notNull().default("staged"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .default(sql`clock_timestamp()`)
    .notNull(),
  committedAt: timestamp("committed_at", { withTimezone: true, mode: "date" }),
  rolledBackAt: timestamp("rolled_back_at", { withTimezone: true, mode: "date" }),
});

/**
 * 33. import_rows: Staged rows with validation status, row error arrays, and rollback pointers
 */
export const importRows = pgTable(
  "import_rows",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => importBatches.id, { onDelete: "cascade" }),
    rowIndex: integer("row_index").notNull(),
    rawData: jsonb("raw_data").notNull(),
    errorMessages: text("error_messages")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    isValid: boolean("is_valid").notNull().default(false),
    isSkipped: boolean("is_skipped").notNull().default(false),
    targetEntityId: uuid("target_entity_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
  },
  (table) => ({
    batchRowIdx: index("import_rows_batch_idx").on(table.batchId, table.rowIndex),
  })
);
