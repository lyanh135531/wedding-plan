import {
  pgTable,
  text,
  varchar,
  timestamp,
  boolean,
  uuid,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { events } from "./events";

export const PREPARATION_TYPES = ["idea", "item", "music", "photo"] as const;
export type PreparationType = (typeof PREPARATION_TYPES)[number];

export const IDEA_STATUSES = ["reference", "considering", "decided", "discarded"] as const;
export type IdeaStatus = (typeof IDEA_STATUSES)[number];

export const ITEM_STATUSES = ["not_prepared", "packed", "brought", "returned"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const PHOTO_PRIORITIES = ["must_have", "nice_to_have"] as const;
export type PhotoPriority = (typeof PHOTO_PRIORITIES)[number];

export const ITEM_PRIORITIES = ["low", "medium", "high"] as const;
export type ItemPriority = (typeof ITEM_PRIORITIES)[number];

/**
 * preparation_items: Polymorphic table for ideas, checklist items, music playlist, and photo shots (Gate G9 / Milestone R2)
 */
export const preparationItems = pgTable(
  "preparation_items",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    type: text("type", { enum: PREPARATION_TYPES }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    category: text("category"),
    status: text("status").notNull(),
    priority: text("priority"),
    metadata: jsonb("metadata").default(sql`'{}'::jsonb`).notNull(),
    isRental: boolean("is_rental").default(false).notNull(),
    returnDueDate: timestamp("return_due_date", { withTimezone: true, mode: "date" }),
    isBlacklisted: boolean("is_blacklisted").default(false).notNull(),
    isShared: boolean("is_shared").default(false).notNull(),
    version: integer("version").notNull().default(1),
    handedOverAt: timestamp("handed_over_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
  },
  (table) => ({
    eventIdIdx: index("preparation_items_event_id_idx").on(table.eventId),
    typeIdx: index("preparation_items_type_idx").on(table.type),
    statusIdx: index("preparation_items_status_idx").on(table.status),
    isSharedIdx: index("preparation_items_is_shared_idx").on(table.isShared),
  })
);
