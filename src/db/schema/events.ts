import { pgTable, text, timestamp, boolean, uuid, integer, bigint, pgEnum, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const eventTypeEnum = pgEnum("event_type", [
  "engagement",
  "ancestor_ceremony",
  "wedding_party",
  "other",
]);

export const eventStatusEnum = pgEnum("event_status", [
  "tentative",
  "confirmed",
  "cancelled",
  "completed",
]);

/**
 * 7. events: Wedding events/ceremonies (Engagement, Tea Ceremony, Reception)
 */
export const events = pgTable(
  "events",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    title: text("title").notNull(),
    eventType: eventTypeEnum("event_type").notNull(),
    status: eventStatusEnum("status").notNull().default("tentative"),
    startTime: timestamp("start_time", { withTimezone: true, mode: "date" }),
    endTime: timestamp("end_time", { withTimezone: true, mode: "date" }),
    locationName: text("location_name"),
    locationAddress: text("location_address"),
    mapUrl: text("map_url"),
    contactPerson: text("contact_person"),
    contactPhone: text("contact_phone"),
    publicNotes: text("public_notes"),
    privateNotes: text("private_notes"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
  },
  (table) => ({
    timeOrderCheck: check("events_time_order_check", sql`end_time IS NULL OR end_time >= start_time`),
  })
);

/**
 * 8. wedding_settings: Singleton configuration entity for bride, groom, target budget, and tentative date
 */
export const weddingSettings = pgTable(
  "wedding_settings",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    brideName: text("bride_name").notNull(),
    groomName: text("groom_name").notNull(),
    shortTitle: text("short_title"),
    tentativeDateNote: text("tentative_date_note")
      .notNull()
      .default("Dự kiến sau Tết âm lịch 2028"),
    isDateConfirmed: boolean("is_date_confirmed").notNull().default(false),
    representativeEventId: uuid("representative_event_id").references(() => events.id, {
      onDelete: "set null",
    }),
    budgetTarget: bigint("budget_target", { mode: "bigint" }),
    contingencyBudget: bigint("contingency_budget", { mode: "bigint" }),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
  },
  (table) => ({
    budgetTargetCheck: check("wedding_settings_budget_target_check", sql`budget_target IS NULL OR budget_target >= 0`),
    contingencyCheck: check("wedding_settings_contingency_check", sql`contingency_budget IS NULL OR contingency_budget >= 0`),
  })
);
