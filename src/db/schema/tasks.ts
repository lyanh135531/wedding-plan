import {
  pgTable,
  text,
  timestamp,
  boolean,
  uuid,
  integer,
  date,
  pgEnum,
  unique,
  check,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";
import { events } from "./events";

export const taskPriorityEnum = pgEnum("task_priority", ["low", "normal", "high", "urgent"]);
export const taskStatusEnum = pgEnum("task_status", [
  "not_started",
  "in_progress",
  "blocked",
  "completed",
  "cancelled",
]);
export const deadlineTypeEnum = pgEnum("deadline_type", [
  "fixed_date",
  "fixed_datetime",
  "relative_to_event",
]);
export const relativeDirectionEnum = pgEnum("relative_direction", ["before", "after"]);

/**
 * 23. tasks: Core task item supporting relative/fixed deadlines and family sharing
 */
export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    title: text("title").notNull(),
    category: text("category"),
    eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
    inChargeUserId: text("in_charge_user_id").references(() => users.id, { onDelete: "set null" }),
    supportContacts: text("support_contacts")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    priority: taskPriorityEnum("priority").notNull().default("normal"),
    status: taskStatusEnum("status").notNull().default("not_started"),
    deadlineType: deadlineTypeEnum("deadline_type").notNull().default("fixed_date"),
    fixedDate: date("fixed_date", { mode: "string" }),
    fixedDatetime: timestamp("fixed_datetime", { withTimezone: true, mode: "date" }),
    relativeEventId: uuid("relative_event_id").references(() => events.id, { onDelete: "set null" }),
    relativeOffsetDays: integer("relative_offset_days"),
    relativeDirection: relativeDirectionEnum("relative_direction").notNull().default("before"),
    pinnedManual: boolean("pinned_manual").notNull().default(false),
    privateNotes: text("private_notes"),
    sharedWithFamily: boolean("shared_with_family").notNull().default(false),
    sharedPublicTitle: text("shared_public_title"),
    sharedPublicNotes: text("shared_public_notes"),
    reopenedAt: timestamp("reopened_at", { withTimezone: true, mode: "date" }),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
  },
  (table) => ({
    statusIdx: index("tasks_status_idx").on(table.status),
    priorityIdx: index("tasks_priority_idx").on(table.priority),
    eventIdx: index("tasks_event_id_idx").on(table.eventId),
  })
);

/**
 * 24. task_checklist_items: Subtasks checklist
 */
export const taskChecklistItems = pgTable("task_checklist_items", {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  isCompleted: boolean("is_completed").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .default(sql`clock_timestamp()`)
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .default(sql`clock_timestamp()`)
    .notNull(),
});

/**
 * 25. task_dependencies: Directed acyclic graph (DAG) task prerequisites
 */
export const taskDependencies = pgTable(
  "task_dependencies",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    dependentTaskId: uuid("dependent_task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    prerequisiteTaskId: uuid("prerequisite_task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
  },
  (table) => ({
    uniqueDependency: unique("task_dependencies_unique").on(
      table.dependentTaskId,
      table.prerequisiteTaskId
    ),
    noSelfReference: check("task_dependencies_no_self_ref", sql`dependent_task_id <> prerequisite_task_id`),
  })
);

/**
 * 26. appointments: Scheduled vendor/venue meetings
 */
export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    title: text("title").notNull(),
    startTime: timestamp("start_time", { withTimezone: true, mode: "date" }).notNull(),
    endTime: timestamp("end_time", { withTimezone: true, mode: "date" }).notNull(),
    eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
    location: text("location"),
    attendees: text("attendees"),
    inChargeUserId: text("in_charge_user_id").references(() => users.id, { onDelete: "set null" }),
    notes: text("notes"),
    sharedWithFamily: boolean("shared_with_family").notNull().default(false),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
  },
  (table) => ({
    timeOrderCheck: check("appointments_time_order_check", sql`end_time >= start_time`),
  })
);
