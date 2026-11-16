import {
  pgTable,
  text,
  varchar,
  timestamp,
  boolean,
  uuid,
  integer,
  unique,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { events } from "./events";
import { guests } from "./guests";

export const TABLE_SHAPES = ["round", "rectangular"] as const;
export type TableShape = (typeof TABLE_SHAPES)[number];

/**
 * 15. tables: Seating tables per wedding event (Round, Rectangular)
 */
export const tables = pgTable(
  "tables",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    tableNumber: varchar("table_number", { length: 50 }),
    name: varchar("name", { length: 255 }).notNull(),
    shape: text("shape", { enum: TABLE_SHAPES }).notNull().default("round"),
    capacity: integer("capacity").notNull(),
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
    capacityPositiveCheck: check("tables_capacity_positive_check", sql`${table.capacity} > 0`),
    eventTableNameUnique: unique("tables_event_name_unique").on(table.eventId, table.name),
    eventIdIdx: index("tables_event_id_idx").on(table.eventId),
  })
);

/**
 * 16. seat_assignments: Guest seating assignments per table and event
 */
export const seatAssignments = pgTable(
  "seat_assignments",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    tableId: uuid("table_id")
      .notNull()
      .references(() => tables.id, { onDelete: "cascade" }),
    guestId: uuid("guest_id")
      .notNull()
      .references(() => guests.id, { onDelete: "cascade" }),
    seatNumber: integer("seat_number"),
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
    eventGuestUnique: unique("seat_assignments_event_guest_unique").on(table.eventId, table.guestId),
    eventIdIdx: index("seat_assignments_event_id_idx").on(table.eventId),
    tableIdIdx: index("seat_assignments_table_id_idx").on(table.tableId),
    guestIdIdx: index("seat_assignments_guest_id_idx").on(table.guestId),
  })
);
