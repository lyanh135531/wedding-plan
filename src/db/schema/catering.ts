import {
  pgTable,
  text,
  varchar,
  timestamp,
  boolean,
  uuid,
  integer,
  jsonb,
  unique,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { events } from "./events";
import { guests } from "./guests";

export const MEAL_TYPES = ["banquet", "buffet", "cocktail"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const COURSE_TYPES = ["appetizer", "main", "dessert", "beverage"] as const;
export type CourseType = (typeof COURSE_TYPES)[number];

export const MEAL_TIERS = ["standard", "vegetarian", "child", "special"] as const;
export type MealTier = (typeof MEAL_TIERS)[number];

/**
 * 17. menus: Catering menus per event (Banquet, Buffet, Cocktail)
 */
export const menus = pgTable(
  "menus",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    mealType: text("meal_type", { enum: MEAL_TYPES }).notNull().default("banquet"),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
  },
  (table) => ({
    eventIdIdx: index("menus_event_id_idx").on(table.eventId),
  })
);

/**
 * 18. menu_items: Individual courses/dishes within a catering menu
 */
export const menuItems = pgTable(
  "menu_items",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    menuId: uuid("menu_id")
      .notNull()
      .references(() => menus.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    courseOrder: integer("course_order").notNull().default(1),
    courseType: text("course_type", { enum: COURSE_TYPES }).notNull().default("main"),
    name: varchar("name", { length: 255 }).notNull(),
    dietaryFlags: jsonb("dietary_flags").default(sql`'[]'::jsonb`),
    allergens: text("allergens"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
  },
  (table) => ({
    menuIdIdx: index("menu_items_menu_id_idx").on(table.menuId),
    eventIdIdx: index("menu_items_event_id_idx").on(table.eventId),
  })
);

/**
 * 19. guest_meal_selections: Individual guest meal tier selection and allergies
 */
export const guestMealSelections = pgTable(
  "guest_meal_selections",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    guestId: uuid("guest_id")
      .notNull()
      .references(() => guests.id, { onDelete: "cascade" }),
    mealTier: text("meal_tier", { enum: MEAL_TIERS }).notNull().default("standard"),
    dietaryNotes: text("dietary_notes"),
    allergyNotes: text("allergy_notes"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
  },
  (table) => ({
    eventGuestUnique: unique("guest_meal_selections_event_guest_unique").on(table.eventId, table.guestId),
    eventIdIdx: index("guest_meal_selections_event_id_idx").on(table.eventId),
    guestIdIdx: index("guest_meal_selections_guest_id_idx").on(table.guestId),
  })
);

/**
 * 20. catering_snapshots: Frozen handover snapshots with restaurants/caterers
 */
export const cateringSnapshots = pgTable(
  "catering_snapshots",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    menuId: uuid("menu_id").references(() => menus.id, { onDelete: "set null" }),
    snapshotVersion: integer("snapshot_version").notNull().default(1),
    adultMeals: integer("adult_meals").notNull().default(0),
    childMeals: integer("child_meals").notNull().default(0),
    vegetarianMeals: integer("vegetarian_meals").notNull().default(0),
    specialMeals: integer("special_meals").notNull().default(0),
    bufferMeals: integer("buffer_meals").notNull().default(0),
    totalMeals: integer("total_meals").notNull().default(0),
    notes: text("notes"),
    isLocked: boolean("is_locked").notNull().default(false),
    lockedAt: timestamp("locked_at", { withTimezone: true, mode: "date" }),
    lockedBy: uuid("locked_by"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
  },
  (table) => ({
    eventSnapshotVersionUnique: unique("catering_snapshots_event_version_unique").on(
      table.eventId,
      table.snapshotVersion
    ),
    eventIdIdx: index("catering_snapshots_event_id_idx").on(table.eventId),
    menuIdIdx: index("catering_snapshots_menu_id_idx").on(table.menuId),
  })
);
