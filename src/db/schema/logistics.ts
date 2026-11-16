import {
  pgTable,
  text,
  varchar,
  timestamp,
  date,
  uuid,
  integer,
  unique,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { events } from "./events";
import { guests } from "./guests";

export const VEHICLE_TYPES = ["shuttle_bus", "van", "car"] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

/**
 * 21. accommodations: Lodging and hotel blocks for out-of-town guests
 */
export const accommodations = pgTable(
  "accommodations",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    locationAddress: text("location_address"),
    checkInTime: timestamp("check_in_time", { withTimezone: true, mode: "date" }),
    checkOutTime: timestamp("check_out_time", { withTimezone: true, mode: "date" }),
    totalRooms: integer("total_rooms").notNull().default(1),
    contactPhone: varchar("contact_phone", { length: 50 }),
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
    totalRoomsPositiveCheck: check("accommodations_total_rooms_check", sql`${table.totalRooms} > 0`),
    eventIdIdx: index("accommodations_event_id_idx").on(table.eventId),
  })
);

/**
 * 22. room_assignments: Guest room reservations and assignment tracking
 */
export const roomAssignments = pgTable(
  "room_assignments",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    accommodationId: uuid("accommodation_id")
      .notNull()
      .references(() => accommodations.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    roomNumber: varchar("room_number", { length: 50 }).notNull(),
    guestId: uuid("guest_id")
      .notNull()
      .references(() => guests.id, { onDelete: "cascade" }),
    checkInDate: date("check_in_date", { mode: "string" }),
    checkOutDate: date("check_out_date", { mode: "string" }),
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
    accommodationIdIdx: index("room_assignments_accommodation_id_idx").on(table.accommodationId),
    guestIdIdx: index("room_assignments_guest_id_idx").on(table.guestId),
    eventIdIdx: index("room_assignments_event_id_idx").on(table.eventId),
  })
);

/**
 * 23. transport_trips: Scheduled shuttles, vans, and car transfers
 */
export const transportTrips = pgTable(
  "transport_trips",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    vehicleType: text("vehicle_type", { enum: VEHICLE_TYPES }).notNull().default("shuttle_bus"),
    departureTime: timestamp("departure_time", { withTimezone: true, mode: "date" }),
    departureLocation: text("departure_location"),
    arrivalLocation: text("arrival_location"),
    capacity: integer("capacity").notNull(),
    driverContact: varchar("driver_contact", { length: 100 }),
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
    capacityPositiveCheck: check("transport_trips_capacity_check", sql`${table.capacity} > 0`),
    eventIdIdx: index("transport_trips_event_id_idx").on(table.eventId),
  })
);

/**
 * 24. trip_passengers: Guest passenger allocation per transport trip
 */
export const tripPassengers = pgTable(
  "trip_passengers",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => transportTrips.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    guestId: uuid("guest_id")
      .notNull()
      .references(() => guests.id, { onDelete: "cascade" }),
    pickupPoint: text("pickup_point"),
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
    tripGuestUnique: unique("trip_passengers_trip_guest_unique").on(table.tripId, table.guestId),
    tripIdIdx: index("trip_passengers_trip_id_idx").on(table.tripId),
    guestIdIdx: index("trip_passengers_guest_id_idx").on(table.guestId),
    eventIdIdx: index("trip_passengers_event_id_idx").on(table.eventId),
  })
);
