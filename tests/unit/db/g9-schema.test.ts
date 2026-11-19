import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import {
  // Tables
  preparationItems,
  supportAssignments,
  // Enums / Const arrays
  PREPARATION_TYPES,
  IDEA_STATUSES,
  ITEM_STATUSES,
  PHOTO_PRIORITIES,
  ITEM_PRIORITIES,
  SUPPORT_ROLES,
  // Relations
  preparationItemsRelations,
  supportAssignmentsRelations,
  eventsRelations,
} from "@/db/schema";

describe("Gate G9 Database Schemas & RLS Migration (Milestone M9.1)", () => {
  describe("1. Constants & Enum Definitions", () => {
    it("should define PREPARATION_TYPES correctly", () => {
      expect(PREPARATION_TYPES).toEqual(["idea", "item", "music", "photo"]);
    });

    it("should define IDEA_STATUSES correctly", () => {
      expect(IDEA_STATUSES).toEqual(["reference", "considering", "decided", "discarded"]);
    });

    it("should define ITEM_STATUSES correctly", () => {
      expect(ITEM_STATUSES).toEqual(["not_prepared", "packed", "brought", "returned"]);
    });

    it("should define PHOTO_PRIORITIES correctly", () => {
      expect(PHOTO_PRIORITIES).toEqual(["must_have", "nice_to_have"]);
    });

    it("should define ITEM_PRIORITIES correctly", () => {
      expect(ITEM_PRIORITIES).toEqual(["low", "medium", "high"]);
    });

    it("should define SUPPORT_ROLES correctly", () => {
      expect(SUPPORT_ROLES).toEqual([
        "co_dau",
        "chu_re",
        "phu_dau",
        "phu_re",
        "mc",
        "dieu_phoi",
        "nguoi_than",
        "nha_cung_cap",
        "khac",
      ]);
    });
  });

  describe("2. preparation_items Table Definition", () => {
    const cols = getTableColumns(preparationItems);
    const config = getTableConfig(preparationItems);

    it("should have correct table name 'preparation_items'", () => {
      expect(config.name).toBe("preparation_items");
    });

    it("should have required primary key 'id' and foreign key 'eventId'", () => {
      expect(cols.id).toBeDefined();
      expect(cols.eventId).toBeDefined();
    });

    it("should have all required domain columns", () => {
      expect(cols.type).toBeDefined();
      expect(cols.title).toBeDefined();
      expect(cols.category).toBeDefined();
      expect(cols.status).toBeDefined();
      expect(cols.priority).toBeDefined();
      expect(cols.metadata).toBeDefined();
      expect(cols.isRental).toBeDefined();
      expect(cols.returnDueDate).toBeDefined();
      expect(cols.isBlacklisted).toBeDefined();
      expect(cols.isShared).toBeDefined();
      expect(cols.version).toBeDefined();
      expect(cols.handedOverAt).toBeDefined();
      expect(cols.createdAt).toBeDefined();
      expect(cols.updatedAt).toBeDefined();
    });

    it("should configure indexes on eventId, type, status, and isShared", () => {
      const indexNames = config.indexes.map((idx) => (idx as any).config.name);
      expect(indexNames).toContain("preparation_items_event_id_idx");
      expect(indexNames).toContain("preparation_items_type_idx");
      expect(indexNames).toContain("preparation_items_status_idx");
      expect(indexNames).toContain("preparation_items_is_shared_idx");
    });
  });

  describe("3. support_assignments Table Definition", () => {
    const cols = getTableColumns(supportAssignments);
    const config = getTableConfig(supportAssignments);

    it("should have correct table name 'support_assignments'", () => {
      expect(config.name).toBe("support_assignments");
    });

    it("should have required primary key 'id' and 'eventId'", () => {
      expect(cols.id).toBeDefined();
      expect(cols.eventId).toBeDefined();
      expect(cols.contactId).toBeDefined();
    });

    it("should have contact details and role metadata columns", () => {
      expect(cols.name).toBeDefined();
      expect(cols.phone).toBeDefined();
      expect(cols.roles).toBeDefined();
      expect(cols.arrivalTime).toBeDefined();
      expect(cols.backupName).toBeDefined();
      expect(cols.backupPhone).toBeDefined();
      expect(cols.attireNotes).toBeDefined();
      expect(cols.duties).toBeDefined();
      expect(cols.assignedTaskIds).toBeDefined();
      expect(cols.assignedItemIds).toBeDefined();
      expect(cols.isShared).toBeDefined();
      expect(cols.version).toBeDefined();
      expect(cols.createdAt).toBeDefined();
      expect(cols.updatedAt).toBeDefined();
    });

    it("should configure indexes on eventId, contactId, and isShared", () => {
      const indexNames = config.indexes.map((idx) => (idx as any).config.name);
      expect(indexNames).toContain("support_assignments_event_id_idx");
      expect(indexNames).toContain("support_assignments_contact_id_idx");
      expect(indexNames).toContain("support_assignments_is_shared_idx");
    });
  });

  describe("4. Drizzle Relations", () => {
    it("should export preparationItemsRelations and supportAssignmentsRelations", () => {
      expect(preparationItemsRelations).toBeDefined();
      expect(supportAssignmentsRelations).toBeDefined();
    });
  });

  describe("5. SQL Migration 0004 Verification", () => {
    const migrationPath = path.resolve(process.cwd(), "src/db/migrations/0004_preparation_support_g9.sql");
    const journalPath = path.resolve(process.cwd(), "src/db/migrations/meta/_journal.json");

    it("migration file 0004 should exist and contain table creation DDL", () => {
      expect(fs.existsSync(migrationPath)).toBe(true);
      const sqlContent = fs.readFileSync(migrationPath, "utf-8");
      expect(sqlContent).toContain('CREATE TABLE "preparation_items"');
      expect(sqlContent).toContain('CREATE TABLE "support_assignments"');
    });

    it("migration file 0004 should enforce RLS on both tables", () => {
      const sqlContent = fs.readFileSync(migrationPath, "utf-8");
      expect(sqlContent).toContain('ALTER TABLE "preparation_items" ENABLE ROW LEVEL SECURITY;');
      expect(sqlContent).toContain('ALTER TABLE "preparation_items" FORCE ROW LEVEL SECURITY;');
      expect(sqlContent).toContain('ALTER TABLE "support_assignments" ENABLE ROW LEVEL SECURITY;');
      expect(sqlContent).toContain('ALTER TABLE "support_assignments" FORCE ROW LEVEL SECURITY;');
    });

    it("migration file 0004 should have owner full access and family_view select-only policies", () => {
      const sqlContent = fs.readFileSync(migrationPath, "utf-8");
      expect(sqlContent).toContain("CREATE POLICY owner_all_preparation_items");
      expect(sqlContent).toContain("CREATE POLICY owner_all_support_assignments");
      expect(sqlContent).toContain("CREATE POLICY family_select_preparation_items");
      expect(sqlContent).toContain("CREATE POLICY family_select_support_assignments");
      expect(sqlContent).toContain("is_shared = true");
    });

    it("journal.json should have entry for 0004_preparation_support_g9", () => {
      const journalContent = JSON.parse(fs.readFileSync(journalPath, "utf-8"));
      const entry = journalContent.entries.find((e: any) => e.tag === "0004_preparation_support_g9");
      expect(entry).toBeDefined();
      expect(entry.idx).toBe(4);
    });
  });
});
