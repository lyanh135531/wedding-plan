import { pgTable, text, timestamp, boolean, uuid, integer, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { events } from "./events";

export const handoverStatusEnum = pgEnum("handover_status", [
  "draft",
  "handed_over",
]);

/**
 * handover_packets: Immutable operational snapshots for wedding day delivery
 * Standards: PLAN.md §14.4, UXT22, FL13
 */
export const handoverPackets = pgTable(
  "handover_packets",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    version: integer("version").notNull().default(1),
    title: text("title").notNull(),
    scope: jsonb("scope").$type<{
      includeTimeline: boolean;
      includeSeating: boolean;
      includeCatering: boolean;
      includeSupport: boolean;
      includeChecklist: boolean;
      includeFinancials?: boolean;
    }>().notNull(),
    snapshotData: jsonb("snapshot_data").notNull(),
    handoverStatus: handoverStatusEnum("handover_status").notNull().default("draft"),
    handedOverTo: text("handed_over_to"),
    handedOverAt: timestamp("handed_over_at", { withTimezone: true, mode: "date" }),
    handedOverChannel: text("handed_over_channel"),
    isSharedWithFamily: boolean("is_shared_with_family").notNull().default(false),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
  }
);

/**
 * post_wedding_tasks: Persistent tracker for post-wedding obligations
 * Standards: PLAN.md §16, S35
 */
export const postWeddingTasks = pgTable(
  "post_wedding_tasks",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    weddingId: uuid("wedding_id"),
    taskKey: text("task_key").notNull(),
    title: text("title").notNull(),
    isCompleted: boolean("is_completed").notNull().default(false),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    completedByUserId: text("completed_by_user_id"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
  }
);
