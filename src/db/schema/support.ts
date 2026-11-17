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
import { contacts } from "./vendors";

export const SUPPORT_ROLES = [
  "co_dau",
  "chu_re",
  "phu_dau",
  "phu_re",
  "mc",
  "dieu_phoi",
  "nguoi_than",
  "nha_cung_cap",
  "khac",
] as const;
export type SupportRole = (typeof SUPPORT_ROLES)[number];

/**
 * support_assignments: Wedding party assignments, roles, duties, and contacts (Gate G9 / Milestone R2)
 * Invariant: Support party roles do NOT automatically create user accounts or grant DB write permissions (PLAN §14.2).
 */
export const supportAssignments = pgTable(
  "support_assignments",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    name: varchar("name", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 50 }).notNull(),
    roles: jsonb("roles").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
    arrivalTime: varchar("arrival_time", { length: 50 }),
    backupName: varchar("backup_name", { length: 255 }),
    backupPhone: varchar("backup_phone", { length: 50 }),
    attireNotes: text("attire_notes"),
    duties: text("duties"),
    assignedTaskIds: jsonb("assigned_task_ids").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
    assignedItemIds: jsonb("assigned_item_ids").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
    isShared: boolean("is_shared").default(false).notNull(),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
  },
  (table) => ({
    eventIdIdx: index("support_assignments_event_id_idx").on(table.eventId),
    contactIdIdx: index("support_assignments_contact_id_idx").on(table.contactId),
    isSharedIdx: index("support_assignments_is_shared_idx").on(table.isShared),
  })
);
