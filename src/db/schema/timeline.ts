import { pgTable, text, timestamp, boolean, uuid, integer, pgEnum, check, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { events } from "./events";
import { supportAssignments } from "./support";

export const timelineStatusEnum = pgEnum("timeline_status", [
  "not_started",
  "in_progress",
  "completed",
  "skipped",
]);

/**
 * timeline_items: Wedding day milestone timeline per event (buổi)
 * Standards: PLAN.md §14.1, AT34, FL15
 */
export const timelineItems = pgTable(
  "timeline_items",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    category: text("category").notNull().default("other"),
    scheduledStartTime: timestamp("scheduled_start_time", { withTimezone: true, mode: "date" }).notNull(),
    scheduledEndTime: timestamp("scheduled_end_time", { withTimezone: true, mode: "date" }).notNull(),
    actualStartTime: timestamp("actual_start_time", { withTimezone: true, mode: "date" }),
    actualEndTime: timestamp("actual_end_time", { withTimezone: true, mode: "date" }),
    locationName: text("location_name"),
    personInCharge: text("person_in_charge"),
    inChargePhone: text("in_charge_phone"),
    backupPerson: text("backup_person"),
    backupPhone: text("backup_phone"),
    supportAssignmentId: uuid("support_assignment_id").references(() => supportAssignments.id, {
      onDelete: "set null",
    }),
    assignedItemIds: jsonb("assigned_item_ids").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
    assignedTaskIds: jsonb("assigned_task_ids").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
    operationalNotes: text("operational_notes"),
    isShared: boolean("is_shared").notNull().default(true),
    status: timelineStatusEnum("status").notNull().default("not_started"),
    sortOrder: integer("sort_order").notNull().default(0),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
  },
  (table) => ({
    timeOrderCheck: check(
      "timeline_items_time_order_check",
      sql`scheduled_end_time >= scheduled_start_time`
    ),
  })
);
