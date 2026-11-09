import { pgTable, text, timestamp, boolean, uuid, pgEnum, unique } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { events } from "./events";

export const userRoleEnum = pgEnum("user_role", ["owner", "family_view"]);
export const inviteStatusEnum = pgEnum("invite_status", ["pending", "accepted", "revoked"]);

/**
 * 1. users: Core Better Auth user table with role extension
 */
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: userRoleEnum("role").notNull().default("family_view"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .default(sql`clock_timestamp()`)
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .default(sql`clock_timestamp()`)
    .notNull(),
});

/**
 * 2. sessions: Active authentication sessions (Better Auth)
 */
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .default(sql`clock_timestamp()`)
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .default(sql`clock_timestamp()`)
    .notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

/**
 * 3. accounts: OAuth linked accounts (Google OAuth)
 */
export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true, mode: "date" }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true, mode: "date" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .default(sql`clock_timestamp()`)
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .default(sql`clock_timestamp()`)
    .notNull(),
});

/**
 * 4. verifications: Email verification and single-use tokens
 */
export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .default(sql`clock_timestamp()`)
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .default(sql`clock_timestamp()`)
    .notNull(),
});

/**
 * 5. member_invites: Family invite links with SHA-256 token hash and 7-day expiration
 */
export const memberInvites = pgTable("member_invites", {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  email: text("email").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  role: userRoleEnum("role").notNull().default("family_view"),
  allowedEventIds: uuid("allowed_event_ids")
    .array()
    .notNull()
    .default(sql`'{}'::uuid[]`),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  invitedByUserId: text("invited_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  status: inviteStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .default(sql`clock_timestamp()`)
    .notNull(),
});

/**
 * 6. member_event_access: RLS junction table granting Family View-only users access to specific wedding events
 */
export const memberEventAccess = pgTable(
  "member_event_access",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .default(sql`clock_timestamp()`)
      .notNull(),
  },
  (table) => ({
    uniqueUserEvent: unique("member_event_access_user_event_unique").on(table.userId, table.eventId),
  })
);
