import { pgTable, text, timestamp, boolean, uuid, integer, bigint, pgEnum, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { events } from "./events";
import { guests } from "./guests";

export const giftTypeEnum = pgEnum("gift_type", [
  "cash",
  "physical",
]);

export const reconciliationStatusEnum = pgEnum("gift_reconciliation_status", [
  "reconciled",
  "needs_reconciliation",
]);

/**
 * gifts: Gift registry entries (cash vs physical)
 * Standards: PLAN.md §16, AT25, FL16
 */
export const gifts = pgTable(
  "gifts",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    giftType: giftTypeEnum("gift_type").notNull().default("cash"),
    amount: bigint("amount", { mode: "bigint" }),
    receivedAt: timestamp("received_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    description: text("description"),
    receivedByUserId: text("received_by_user_id"),
    receivedByProxy: text("received_by_proxy"),
    envelopeCode: text("envelope_code"),
    isSenderIdentified: boolean("is_sender_identified").notNull().default(true),
    unidentifiedNotes: text("unidentified_notes"),
    reconciliationStatus: reconciliationStatusEnum("reconciliation_status").notNull().default("reconciled"),
    isThanked: boolean("is_thanked").notNull().default(false),
    thankedAt: timestamp("thanked_at", { withTimezone: true, mode: "date" }),
    thankedByUserId: text("thanked_by_user_id"),
    thankYouChannel: text("thank_you_channel"),
    thankYouNotes: text("thank_you_notes"),
    isVoided: boolean("is_voided").notNull().default(false),
    voidedReason: text("voided_reason"),
    voidedAt: timestamp("voided_at", { withTimezone: true, mode: "date" }),
    voidedByUserId: text("voided_by_user_id"),
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
    amountCheck: check(
      "gifts_amount_check",
      sql`amount IS NULL OR amount >= 0`
    ),
    typeConsistencyCheck: check(
      "gifts_type_consistency_check",
      sql`(gift_type = 'physical' AND amount IS NULL) OR (gift_type = 'cash' AND amount IS NOT NULL)`
    ),
  })
);

/**
 * gift_contributors: Joint envelope mapping linking multiple guests to a single gift
 * Invariant (AT25): N contributors link to 1 gift without multiplying money.
 */
export const giftContributors = pgTable(
  "gift_contributors",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    giftId: uuid("gift_id")
      .notNull()
      .references(() => gifts.id, { onDelete: "cascade" }),
    guestId: uuid("guest_id")
      .references(() => guests.id, { onDelete: "set null" }),
    contributorName: text("contributor_name").notNull(),
    relationship: text("relationship"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
  }
);

/**
 * gift_returns: Log of cash returns against gifts
 * Invariant: Returned amount cannot exceed net held gift balance.
 */
export const giftReturns = pgTable(
  "gift_returns",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    giftId: uuid("gift_id")
      .notNull()
      .references(() => gifts.id, { onDelete: "cascade" }),
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    returnReason: text("return_reason").notNull(),
    returnedAt: timestamp("returned_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
    handledByUserId: text("handled_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
  },
  (table) => ({
    amountCheck: check(
      "gift_returns_amount_check",
      sql`amount > 0`
    ),
  })
);
