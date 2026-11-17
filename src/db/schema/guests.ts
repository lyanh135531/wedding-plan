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
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";
import { events } from "./events";

export const guestSideEnum = pgEnum("guest_side", ["groom", "bride", "mutual", "unassigned"]);
export const ageTierEnum = pgEnum("age_tier", ["adult", "child", "baby"]);
export const deliveryMethodEnum = pgEnum("delivery_method", ["paper", "electronic", "in_person"]);
export const invitationStatusEnum = pgEnum("invitation_status", ["save_the_date", "preparing", "sent"]);
export const rsvpStatusEnum = pgEnum("rsvp_status", [
  "not_contacted",
  "pending_reply",
  "tentative",
  "accepted",
  "declined",
]);
export const dietaryTierEnum = pgEnum("dietary_tier", ["regular", "vegetarian", "child_portion", "special"]);

/**
 * 9. guest_groups: Organizational categories (Family, Colleagues, High School Friends)
 */
export const guestGroups = pgTable("guest_groups", {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  name: text("name").notNull(),
  side: guestSideEnum("side").notNull().default("unassigned"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .default(sql`clock_timestamp()`)
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .default(sql`clock_timestamp()`)
    .notNull(),
});

/**
 * 10. guests: Individual guest entity with unaccent trigram index
 */
export const guests = pgTable(
  "guests",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    displayName: text("display_name").notNull(),
    side: guestSideEnum("side").notNull().default("unassigned"),
    groupId: uuid("group_id").references(() => guestGroups.id, { onDelete: "set null" }),
    subTags: text("sub_tags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    ageTier: ageTierEnum("age_tier").notNull().default("adult"),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    privateNotes: text("private_notes"),
    isArchived: boolean("is_archived").notNull().default(false),
    archivedAt: timestamp("archived_at", { withTimezone: true, mode: "date" }),
    isPlaceholder: boolean("is_placeholder").notNull().default(false),
    placeholderFor: text("placeholder_for"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
  },
  (table) => ({
    displayNameTrgmIdx: index("guests_display_name_trgm_idx").using(
      "gin",
      sql`immutable_unaccent(lower(${table.displayName})) gin_trgm_ops`
    ),
    phoneIdx: index("guests_phone_idx").on(table.phone),
    groupIdIdx: index("guests_group_id_idx").on(table.groupId),
  })
);

/**
 * 11. invitations: Invitation card grouping per event (e.g. "An Family", "Nam & Girlfriend")
 */
export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    cardName: text("card_name").notNull(),
    representativeGuestId: uuid("representative_guest_id")
      .notNull()
      .references(() => guests.id, { onDelete: "restrict" }),
    deliveryMethod: deliveryMethodEnum("delivery_method").notNull().default("paper"),
    inChargeUserId: text("in_charge_user_id").references(() => users.id, { onDelete: "set null" }),
    status: invitationStatusEnum("status").notNull().default("save_the_date"),
    sentDate: date("sent_date", { mode: "string" }),
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
    eventIdIdx: index("invitations_event_id_idx").on(table.eventId),
  })
);

/**
 * 12. invitation_members: Mapping guests to an invitation card
 */
export const invitationMembers = pgTable(
  "invitation_members",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    invitationId: uuid("invitation_id")
      .notNull()
      .references(() => invitations.id, { onDelete: "cascade" }),
    guestId: uuid("guest_id")
      .notNull()
      .references(() => guests.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
  },
  (table) => ({
    uniqueCardGuest: unique("invitation_members_unique").on(table.invitationId, table.guestId),
  })
);

/**
 * 13. attendance: Guest attendance status per event (RSVP, seats, dietary)
 */
export const attendance = pgTable(
  "attendance",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    guestId: uuid("guest_id")
      .notNull()
      .references(() => guests.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    rsvpStatus: rsvpStatusEnum("rsvp_status").notNull().default("not_contacted"),
    contactCount: integer("contact_count").notNull().default(0),
    contactNotes: text("contact_notes"),
    nextFollowupDate: date("next_followup_date", { mode: "string" }),
    needsSeat: boolean("needs_seat").notNull().default(true),
    needsMeal: boolean("needs_meal").notNull().default(true),
    mealDietaryTier: dietaryTierEnum("meal_dietary_tier").notNull().default("regular"),
    dietaryNotes: text("dietary_notes"),
    accommodationNeeded: boolean("accommodation_needed").notNull().default(false),
    transportNeeded: boolean("transport_needed").notNull().default(false),
    isOriginOnsite: boolean("is_origin_onsite").notNull().default(false),
    isCheckedIn: boolean("is_checked_in").notNull().default(false),
    checkInTime: timestamp("check_in_time", { withTimezone: true, mode: "date" }),
    checkedInByUserId: text("checked_in_by_user_id"),
    checkInNotes: text("check_in_notes"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
  },
  (table) => ({
    uniqueGuestEvent: unique("attendance_guest_event_unique").on(table.guestId, table.eventId),
    contactCountCheck: check("attendance_contact_count_check", sql`contact_count >= 0`),
  })
);

/**
 * 14. contact_followups: Communication history log with guests
 */
export const contactFollowups = pgTable("contact_followups", {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  guestId: uuid("guest_id")
    .notNull()
    .references(() => guests.id, { onDelete: "cascade" }),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
  updatedByUserId: text("updated_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  contactTime: timestamp("contact_time", { withTimezone: true, mode: "date" })
    .default(sql`clock_timestamp()`)
    .notNull(),
  outcome: text("outcome").notNull(),
  nextFollowupDate: date("next_followup_date", { mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .default(sql`clock_timestamp()`)
    .notNull(),
});
