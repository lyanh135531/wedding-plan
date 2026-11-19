import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import {
  // Tables
  tables,
  seatAssignments,
  menus,
  menuItems,
  guestMealSelections,
  cateringSnapshots,
  accommodations,
  roomAssignments,
  transportTrips,
  tripPassengers,
  // Enums / Const arrays
  TABLE_SHAPES,
  MEAL_TYPES,
  COURSE_TYPES,
  MEAL_TIERS,
  VEHICLE_TYPES,
  // Relations
  tablesRelations,
  seatAssignmentsRelations,
  menusRelations,
  menuItemsRelations,
  guestMealSelectionsRelations,
  cateringSnapshotsRelations,
  accommodationsRelations,
  roomAssignmentsRelations,
  transportTripsRelations,
  tripPassengersRelations,
  eventsRelations,
  guestsRelations,
} from "@/db/schema";

describe("Gate G8 Database Schemas & RLS Migration (Milestone M8.1)", () => {
  describe("1. Constants & Enum Definitions", () => {
    it("should define TABLE_SHAPES with 'round' and 'rectangular'", () => {
      expect(TABLE_SHAPES).toEqual(["round", "rectangular"]);
    });

    it("should define MEAL_TYPES with 'banquet', 'buffet', and 'cocktail'", () => {
      expect(MEAL_TYPES).toEqual(["banquet", "buffet", "cocktail"]);
    });

    it("should define COURSE_TYPES with 'appetizer', 'main', 'dessert', and 'beverage'", () => {
      expect(COURSE_TYPES).toEqual(["appetizer", "main", "dessert", "beverage"]);
    });

    it("should define MEAL_TIERS with 'standard', 'vegetarian', 'child', and 'special'", () => {
      expect(MEAL_TIERS).toEqual(["standard", "vegetarian", "child", "special"]);
    });

    it("should define VEHICLE_TYPES with 'shuttle_bus', 'van', and 'car'", () => {
      expect(VEHICLE_TYPES).toEqual(["shuttle_bus", "van", "car"]);
    });
  });

  describe("2. Seating Schema (src/db/schema/seating.ts)", () => {
    describe("tables table structure", () => {
      const columns = getTableColumns(tables);

      it("should define all required columns", () => {
        expect(columns.id).toBeDefined();
        expect(columns.eventId).toBeDefined();
        expect(columns.tableNumber).toBeDefined();
        expect(columns.name).toBeDefined();
        expect(columns.shape).toBeDefined();
        expect(columns.capacity).toBeDefined();
        expect(columns.notes).toBeDefined();
        expect(columns.version).toBeDefined();
        expect(columns.createdAt).toBeDefined();
        expect(columns.updatedAt).toBeDefined();
      });

      it("should enforce correct column defaults and constraints", () => {
        expect(columns.eventId.notNull).toBe(true);
        expect(columns.name.notNull).toBe(true);
        expect(columns.shape.notNull).toBe(true);
        expect(columns.shape.default).toBe("round");
        expect(columns.capacity.notNull).toBe(true);
        expect(columns.version.notNull).toBe(true);
        expect(columns.version.default).toBe(1);
      });

      it("should configure unique constraint on (eventId, name) and positive capacity check", () => {
        const config = getTableConfig(tables);
        const uniqueNames = config.uniqueConstraints.map((u) => u.name);
        expect(uniqueNames).toContain("tables_event_name_unique");

        const checkNames = config.checks.map((c) => c.name);
        expect(checkNames).toContain("tables_capacity_positive_check");
      });
    });

    describe("seat_assignments table structure", () => {
      const columns = getTableColumns(seatAssignments);

      it("should define all required columns", () => {
        expect(columns.id).toBeDefined();
        expect(columns.eventId).toBeDefined();
        expect(columns.tableId).toBeDefined();
        expect(columns.guestId).toBeDefined();
        expect(columns.seatNumber).toBeDefined();
        expect(columns.notes).toBeDefined();
        expect(columns.version).toBeDefined();
        expect(columns.createdAt).toBeDefined();
        expect(columns.updatedAt).toBeDefined();
      });

      it("should enforce not-null references and default version", () => {
        expect(columns.eventId.notNull).toBe(true);
        expect(columns.tableId.notNull).toBe(true);
        expect(columns.guestId.notNull).toBe(true);
        expect(columns.version.notNull).toBe(true);
        expect(columns.version.default).toBe(1);
      });

      it("should configure unique constraint on (eventId, guestId)", () => {
        const config = getTableConfig(seatAssignments);
        const uniqueNames = config.uniqueConstraints.map((u) => u.name);
        expect(uniqueNames).toContain("seat_assignments_event_guest_unique");
      });
    });
  });

  describe("3. Catering Schema (src/db/schema/catering.ts)", () => {
    describe("menus table structure", () => {
      const columns = getTableColumns(menus);

      it("should define all required columns", () => {
        expect(columns.id).toBeDefined();
        expect(columns.eventId).toBeDefined();
        expect(columns.name).toBeDefined();
        expect(columns.mealType).toBeDefined();
        expect(columns.description).toBeDefined();
        expect(columns.isActive).toBeDefined();
        expect(columns.version).toBeDefined();
        expect(columns.createdAt).toBeDefined();
        expect(columns.updatedAt).toBeDefined();
      });

      it("should enforce defaults for mealType, isActive, and version", () => {
        expect(columns.name.notNull).toBe(true);
        expect(columns.mealType.default).toBe("banquet");
        expect(columns.isActive.default).toBe(true);
        expect(columns.version.default).toBe(1);
      });
    });

    describe("menu_items table structure", () => {
      const columns = getTableColumns(menuItems);

      it("should define all required columns", () => {
        expect(columns.id).toBeDefined();
        expect(columns.menuId).toBeDefined();
        expect(columns.eventId).toBeDefined();
        expect(columns.courseOrder).toBeDefined();
        expect(columns.courseType).toBeDefined();
        expect(columns.name).toBeDefined();
        expect(columns.dietaryFlags).toBeDefined();
        expect(columns.allergens).toBeDefined();
        expect(columns.notes).toBeDefined();
        expect(columns.createdAt).toBeDefined();
        expect(columns.updatedAt).toBeDefined();
      });

      it("should enforce courseOrder and courseType defaults", () => {
        expect(columns.courseOrder.default).toBe(1);
        expect(columns.courseType.default).toBe("main");
        expect(columns.name.notNull).toBe(true);
      });
    });

    describe("guest_meal_selections table structure", () => {
      const columns = getTableColumns(guestMealSelections);

      it("should define all required columns", () => {
        expect(columns.id).toBeDefined();
        expect(columns.eventId).toBeDefined();
        expect(columns.guestId).toBeDefined();
        expect(columns.mealTier).toBeDefined();
        expect(columns.dietaryNotes).toBeDefined();
        expect(columns.allergyNotes).toBeDefined();
        expect(columns.version).toBeDefined();
        expect(columns.createdAt).toBeDefined();
        expect(columns.updatedAt).toBeDefined();
      });

      it("should configure unique constraint on (eventId, guestId)", () => {
        const config = getTableConfig(guestMealSelections);
        const uniqueNames = config.uniqueConstraints.map((u) => u.name);
        expect(uniqueNames).toContain("guest_meal_selections_event_guest_unique");
      });
    });

    describe("catering_snapshots table structure", () => {
      const columns = getTableColumns(cateringSnapshots);

      it("should define all snapshot meal aggregation and locking columns", () => {
        expect(columns.id).toBeDefined();
        expect(columns.eventId).toBeDefined();
        expect(columns.menuId).toBeDefined();
        expect(columns.snapshotVersion).toBeDefined();
        expect(columns.adultMeals).toBeDefined();
        expect(columns.childMeals).toBeDefined();
        expect(columns.vegetarianMeals).toBeDefined();
        expect(columns.specialMeals).toBeDefined();
        expect(columns.bufferMeals).toBeDefined();
        expect(columns.totalMeals).toBeDefined();
        expect(columns.notes).toBeDefined();
        expect(columns.isLocked).toBeDefined();
        expect(columns.lockedAt).toBeDefined();
        expect(columns.lockedBy).toBeDefined();
        expect(columns.createdAt).toBeDefined();
      });

      it("should enforce default values for all meal count integers and locking flag", () => {
        expect(columns.snapshotVersion.default).toBe(1);
        expect(columns.adultMeals.default).toBe(0);
        expect(columns.childMeals.default).toBe(0);
        expect(columns.vegetarianMeals.default).toBe(0);
        expect(columns.specialMeals.default).toBe(0);
        expect(columns.bufferMeals.default).toBe(0);
        expect(columns.totalMeals.default).toBe(0);
        expect(columns.isLocked.default).toBe(false);
      });

      it("should configure unique constraint on (eventId, snapshotVersion)", () => {
        const config = getTableConfig(cateringSnapshots);
        const uniqueNames = config.uniqueConstraints.map((u) => u.name);
        expect(uniqueNames).toContain("catering_snapshots_event_version_unique");
      });
    });
  });

  describe("4. Logistics Schema (src/db/schema/logistics.ts)", () => {
    describe("accommodations table structure", () => {
      const columns = getTableColumns(accommodations);

      it("should define all required columns", () => {
        expect(columns.id).toBeDefined();
        expect(columns.eventId).toBeDefined();
        expect(columns.name).toBeDefined();
        expect(columns.locationAddress).toBeDefined();
        expect(columns.checkInTime).toBeDefined();
        expect(columns.checkOutTime).toBeDefined();
        expect(columns.totalRooms).toBeDefined();
        expect(columns.contactPhone).toBeDefined();
        expect(columns.notes).toBeDefined();
        expect(columns.version).toBeDefined();
        expect(columns.createdAt).toBeDefined();
        expect(columns.updatedAt).toBeDefined();
      });

      it("should enforce positive totalRooms check constraint", () => {
        const config = getTableConfig(accommodations);
        const checkNames = config.checks.map((c) => c.name);
        expect(checkNames).toContain("accommodations_total_rooms_check");
        expect(columns.totalRooms.default).toBe(1);
      });
    });

    describe("room_assignments table structure", () => {
      const columns = getTableColumns(roomAssignments);

      it("should define all required columns", () => {
        expect(columns.id).toBeDefined();
        expect(columns.accommodationId).toBeDefined();
        expect(columns.eventId).toBeDefined();
        expect(columns.roomNumber).toBeDefined();
        expect(columns.guestId).toBeDefined();
        expect(columns.checkInDate).toBeDefined();
        expect(columns.checkOutDate).toBeDefined();
        expect(columns.notes).toBeDefined();
        expect(columns.version).toBeDefined();
        expect(columns.createdAt).toBeDefined();
        expect(columns.updatedAt).toBeDefined();
      });

      it("should enforce not-null on foreign keys and roomNumber", () => {
        expect(columns.accommodationId.notNull).toBe(true);
        expect(columns.eventId.notNull).toBe(true);
        expect(columns.guestId.notNull).toBe(true);
        expect(columns.roomNumber.notNull).toBe(true);
      });
    });

    describe("transport_trips table structure", () => {
      const columns = getTableColumns(transportTrips);

      it("should define all required columns", () => {
        expect(columns.id).toBeDefined();
        expect(columns.eventId).toBeDefined();
        expect(columns.name).toBeDefined();
        expect(columns.vehicleType).toBeDefined();
        expect(columns.departureTime).toBeDefined();
        expect(columns.departureLocation).toBeDefined();
        expect(columns.arrivalLocation).toBeDefined();
        expect(columns.capacity).toBeDefined();
        expect(columns.driverContact).toBeDefined();
        expect(columns.notes).toBeDefined();
        expect(columns.version).toBeDefined();
        expect(columns.createdAt).toBeDefined();
        expect(columns.updatedAt).toBeDefined();
      });

      it("should enforce vehicleType default and positive capacity check", () => {
        expect(columns.vehicleType.default).toBe("shuttle_bus");
        const config = getTableConfig(transportTrips);
        const checkNames = config.checks.map((c) => c.name);
        expect(checkNames).toContain("transport_trips_capacity_check");
      });
    });

    describe("trip_passengers table structure", () => {
      const columns = getTableColumns(tripPassengers);

      it("should define all required columns", () => {
        expect(columns.id).toBeDefined();
        expect(columns.tripId).toBeDefined();
        expect(columns.eventId).toBeDefined();
        expect(columns.guestId).toBeDefined();
        expect(columns.pickupPoint).toBeDefined();
        expect(columns.notes).toBeDefined();
        expect(columns.version).toBeDefined();
        expect(columns.createdAt).toBeDefined();
        expect(columns.updatedAt).toBeDefined();
      });

      it("should configure unique constraint on (tripId, guestId)", () => {
        const config = getTableConfig(tripPassengers);
        const uniqueNames = config.uniqueConstraints.map((u) => u.name);
        expect(uniqueNames).toContain("trip_passengers_trip_guest_unique");
      });
    });
  });

  describe("5. Drizzle Relations Re-exports and Interconnections", () => {
    it("should export all Gate G8 relations objects", () => {
      expect(tablesRelations).toBeDefined();
      expect(tablesRelations.table).toBe(tables);

      expect(seatAssignmentsRelations).toBeDefined();
      expect(seatAssignmentsRelations.table).toBe(seatAssignments);

      expect(menusRelations).toBeDefined();
      expect(menusRelations.table).toBe(menus);

      expect(menuItemsRelations).toBeDefined();
      expect(menuItemsRelations.table).toBe(menuItems);

      expect(guestMealSelectionsRelations).toBeDefined();
      expect(guestMealSelectionsRelations.table).toBe(guestMealSelections);

      expect(cateringSnapshotsRelations).toBeDefined();
      expect(cateringSnapshotsRelations.table).toBe(cateringSnapshots);

      expect(accommodationsRelations).toBeDefined();
      expect(accommodationsRelations.table).toBe(accommodations);

      expect(roomAssignmentsRelations).toBeDefined();
      expect(roomAssignmentsRelations.table).toBe(roomAssignments);

      expect(transportTripsRelations).toBeDefined();
      expect(transportTripsRelations.table).toBe(transportTrips);

      expect(tripPassengersRelations).toBeDefined();
      expect(tripPassengersRelations.table).toBe(tripPassengers);
    });

    it("should connect events and guests relations with Gate G8 tables", () => {
      expect(eventsRelations).toBeDefined();
      expect(guestsRelations).toBeDefined();
    });
  });

  describe("6. Migration 0003 & RLS Enforcement Verification (AT03, AT26)", () => {
    const migrationPath = path.resolve(
      process.cwd(),
      "src/db/migrations/0003_seating_catering_logistics.sql"
    );
    const sqlContent = fs.readFileSync(migrationPath, "utf-8");

    it("migration must create all 10 tables", () => {
      expect(sqlContent).toContain('CREATE TABLE "tables"');
      expect(sqlContent).toContain('CREATE TABLE "seat_assignments"');
      expect(sqlContent).toContain('CREATE TABLE "menus"');
      expect(sqlContent).toContain('CREATE TABLE "menu_items"');
      expect(sqlContent).toContain('CREATE TABLE "guest_meal_selections"');
      expect(sqlContent).toContain('CREATE TABLE "catering_snapshots"');
      expect(sqlContent).toContain('CREATE TABLE "accommodations"');
      expect(sqlContent).toContain('CREATE TABLE "room_assignments"');
      expect(sqlContent).toContain('CREATE TABLE "transport_trips"');
      expect(sqlContent).toContain('CREATE TABLE "trip_passengers"');
    });

    it("AT03 & AT26: migration must ENABLE and FORCE RLS on all 10 tables", () => {
      const g8Tables = [
        "tables",
        "seat_assignments",
        "menus",
        "menu_items",
        "guest_meal_selections",
        "catering_snapshots",
        "accommodations",
        "room_assignments",
        "transport_trips",
        "trip_passengers",
      ];

      for (const table of g8Tables) {
        expect(sqlContent).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
        expect(sqlContent).toContain(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;`);
      }
    });

    it("migration must define full-access policies for owner/planner roles", () => {
      const g8Tables = [
        "tables",
        "seat_assignments",
        "menus",
        "menu_items",
        "guest_meal_selections",
        "catering_snapshots",
        "accommodations",
        "room_assignments",
        "transport_trips",
        "trip_passengers",
      ];

      for (const table of g8Tables) {
        expect(sqlContent).toContain(`CREATE POLICY owner_all_${table} ON "${table}"`);
        expect(sqlContent).toContain(`current_setting('app.current_role', true) IN ('owner', 'planner')`);
      }
    });

    it("AT03 & AT26: migration must define SELECT-only policies for family_view on permitted events", () => {
      const g8Tables = [
        "tables",
        "seat_assignments",
        "menus",
        "menu_items",
        "guest_meal_selections",
        "catering_snapshots",
        "accommodations",
        "room_assignments",
        "transport_trips",
        "trip_passengers",
      ];

      for (const table of g8Tables) {
        expect(sqlContent).toContain(`CREATE POLICY family_select_${table} ON "${table}"`);
        expect(sqlContent).toContain("FOR SELECT TO PUBLIC");
        expect(sqlContent).toContain("current_setting('app.current_role', true) = 'family_view'");
        expect(sqlContent).toContain("event_id IN (SELECT public.get_current_user_allowed_event_ids())");
      }
    });

    it("AT03 & AT26: migration must NOT define any INSERT, UPDATE, or DELETE policies for family_view", () => {
      expect(sqlContent).not.toContain("family_insert");
      expect(sqlContent).not.toContain("family_update");
      expect(sqlContent).not.toContain("family_delete");
      expect(sqlContent).not.toContain("family_all");
    });

    it("migration journal meta must be updated with 0003 entry", () => {
      const journalPath = path.resolve(
        process.cwd(),
        "src/db/migrations/meta/_journal.json"
      );
      const journalContent = fs.readFileSync(journalPath, "utf-8");
      const journal = JSON.parse(journalContent);
      const entry = journal.entries.find(
        (e: { tag: string }) => e.tag === "0003_seating_catering_logistics"
      );
      expect(entry).toBeDefined();
      expect(entry.idx).toBe(3);
      expect(entry.version).toBe("7");
    });
  });
});
