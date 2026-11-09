import {
  pgTable,
  text,
  timestamp,
  boolean,
  uuid,
  integer,
  bigint,
  pgEnum,
  unique,
  check,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";

export const attachmentEntityTypeEnum = pgEnum("attachment_entity_type", [
  "cost_item",
  "vendor",
  "wedding",
  "task",
]);

export const processingStatusEnum = pgEnum("processing_status", ["pending", "ready", "failed"]);
export const imageVariantTypeEnum = pgEnum("image_variant_type", ["thumbnail_320", "preview_1600"]);

/**
 * 27. attachments: Metadata for files stored on persistent filesystem outside web root (/data/uploads)
 */
export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    storageKey: text("storage_key").notNull().unique(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    fileSizeBytes: bigint("file_size_bytes", { mode: "bigint" }).notNull(),
    width: integer("width"),
    height: integer("height"),
    checksumSha256: text("checksum_sha256").notNull(),
    isPrivate: boolean("is_private").notNull().default(true),
    ownerOnly: boolean("owner_only").notNull().default(true),
    entityType: attachmentEntityTypeEnum("entity_type").notNull(),
    entityId: uuid("entity_id"),
    processingStatus: processingStatusEnum("processing_status").notNull().default("pending"),
    errorMessage: text("error_message"),
    uploaderUserId: text("uploader_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true, mode: "date" }),
    isArchived: boolean("is_archived").notNull().default(false),
    archivedAt: timestamp("archived_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
  },
  (table) => ({
    fileSizeCheck: check("attachments_size_check", sql`file_size_bytes > 0`),
    entityIdx: index("attachments_entity_idx").on(table.entityType, table.entityId),
  })
);

/**
 * 28. attachment_variants: Sharp-processed WebP thumbnails and preview renditions
 */
export const attachmentVariants = pgTable(
  "attachment_variants",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    attachmentId: uuid("attachment_id")
      .notNull()
      .references(() => attachments.id, { onDelete: "cascade" }),
    variantType: imageVariantTypeEnum("variant_type").notNull(),
    storageKey: text("storage_key").notNull().unique(),
    mimeType: text("mime_type").notNull().default("image/webp"),
    fileSizeBytes: bigint("file_size_bytes", { mode: "bigint" }).notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
  },
  (table) => ({
    uniqueVariant: unique("attachment_variants_type_unique").on(table.attachmentId, table.variantType),
  })
);
