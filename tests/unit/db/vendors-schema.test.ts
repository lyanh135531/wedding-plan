import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import {
  vendors,
  vendorQuotes,
  contacts,
  vendorServiceTypeEnum,
  vendorStatusEnum,
  costItems,
  vendorsRelations,
  vendorQuotesRelations,
  contactsRelations,
  costItemsRelations,
} from "@/db/schema";

describe("Vendors & Quotes Schema Definition (Milestone M8.1)", () => {
  describe("1. Enums validation", () => {
    it("should define all 12 required vendorServiceTypeEnum values", () => {
      const expectedTypes = [
        "venue",
        "catering",
        "photography",
        "videography",
        "decoration",
        "attire",
        "makeup",
        "invitation",
        "music_entertainment",
        "transportation",
        "accommodation",
        "other",
      ];
      expect(vendorServiceTypeEnum.enumValues).toEqual(expectedTypes);
    });

    it("should define all 7 required vendorStatusEnum values", () => {
      const expectedStatuses = [
        "researching",
        "contacted",
        "quoted",
        "shortlisted",
        "selected",
        "rejected",
        "cancelled",
      ];
      expect(vendorStatusEnum.enumValues).toEqual(expectedStatuses);
    });
  });

  describe("2. vendors table structure", () => {
    const columns = getTableColumns(vendors);

    it("should define all basic and contact columns", () => {
      expect(columns.id).toBeDefined();
      expect(columns.name).toBeDefined();
      expect(columns.serviceType).toBeDefined();
      expect(columns.status).toBeDefined();
      expect(columns.contactPerson).toBeDefined();
      expect(columns.phone).toBeDefined();
      expect(columns.email).toBeDefined();
      expect(columns.address).toBeDefined();
      expect(columns.mapUrl).toBeDefined();
      expect(columns.website).toBeDefined();
      expect(columns.notes).toBeDefined();
      expect(columns.rating).toBeDefined();
      expect(columns.version).toBeDefined();
      expect(columns.createdAt).toBeDefined();
      expect(columns.updatedAt).toBeDefined();
    });

    it("should define all venue-specific columns (P1 Venue Specification - PLAN §11.2)", () => {
      expect(columns.capacity).toBeDefined();
      expect(columns.minGuests).toBeDefined();
      expect(columns.tablePrice).toBeDefined();
      expect(columns.seatsPerTable).toBeDefined();
      expect(columns.rentalFee).toBeDefined();
      expect(columns.feesInclusive).toBeDefined();
      expect(columns.prepTime).toBeDefined();
      expect(columns.endTime).toBeDefined();
      expect(columns.parkingNotes).toBeDefined();
      expect(columns.rainPlan).toBeDefined();
      expect(columns.decorAudioRules).toBeDefined();
      expect(columns.extraFeesNotes).toBeDefined();
    });

    it("should enforce correct column defaults and constraints", () => {
      expect(columns.name.notNull).toBe(true);
      expect(columns.serviceType.notNull).toBe(true);
      expect(columns.serviceType.default).toBe("other");
      expect(columns.status.notNull).toBe(true);
      expect(columns.status.default).toBe("researching");
      expect(columns.feesInclusive.notNull).toBe(true);
      expect(columns.feesInclusive.default).toBe(false);
      expect(columns.version.notNull).toBe(true);
      expect(columns.version.default).toBe(1);
    });

    it("should configure table indexes including unaccent trigram index", () => {
      const config = getTableConfig(vendors);
      const indexNames = config.indexes.map((idx) => idx.config.name);
      expect(indexNames).toContain("vendors_service_type_idx");
      expect(indexNames).toContain("vendors_status_idx");
      expect(indexNames).toContain("vendors_name_trgm_idx");

      const trgmIdx = config.indexes.find((idx) => idx.config.name === "vendors_name_trgm_idx");
      expect(trgmIdx).toBeDefined();
      expect(trgmIdx?.config.method).toBe("gin");
    });
  });

  describe("3. vendor_quotes table structure & AT24 contract", () => {
    const columns = getTableColumns(vendorQuotes);

    it("should define all quote metadata, terms, and assumptions columns", () => {
      expect(columns.id).toBeDefined();
      expect(columns.vendorId).toBeDefined();
      expect(columns.packageGroupId).toBeDefined();
      expect(columns.versionNumber).toBeDefined();
      expect(columns.parentQuoteId).toBeDefined();
      expect(columns.quoteName).toBeDefined();
      expect(columns.receivedDate).toBeDefined();
      expect(columns.validUntil).toBeDefined();
      expect(columns.totalAmount).toBeDefined();
      expect(columns.isEstimate).toBeDefined();
      expect(columns.guestCountAssumption).toBeDefined();
      expect(columns.tableCountAssumption).toBeDefined();
      expect(columns.terms).toBeDefined();
      expect(columns.includes).toBeDefined();
      expect(columns.excludes).toBeDefined();
      expect(columns.depositConditions).toBeDefined();
      expect(columns.isSelected).toBeDefined();
      expect(columns.createdBy).toBeDefined();
      expect(columns.createdAt).toBeDefined();
      expect(columns.updatedAt).toBeDefined();
    });

    it("AT24: totalAmount must be nullable bigint without default 0n (null explicitly represents 'Chưa báo')", () => {
      expect(columns.totalAmount.notNull).toBe(false);
      expect(columns.totalAmount.hasDefault).toBe(false);
      expect(columns.totalAmount.default).toBeUndefined();
    });

    it("should configure versionNumber and defaults properly", () => {
      expect(columns.versionNumber.notNull).toBe(true);
      expect(columns.versionNumber.default).toBe(1);
      expect(columns.isEstimate.notNull).toBe(true);
      expect(columns.isEstimate.default).toBe(false);
      expect(columns.isSelected.notNull).toBe(true);
      expect(columns.isSelected.default).toBe(false);
    });

    it("should configure packageGroupId and parentQuoteId correctly for lineage", () => {
      expect(columns.packageGroupId.notNull).toBe(true);
      expect(columns.packageGroupId.hasDefault).toBe(true);
      expect(columns.parentQuoteId.notNull).toBe(false);
      expect(columns.receivedDate.notNull).toBe(true);
      expect(columns.validUntil.notNull).toBe(false);
    });
  });

  describe("4. contacts table structure", () => {
    const columns = getTableColumns(contacts);

    it("should define all contact entity columns", () => {
      expect(columns.id).toBeDefined();
      expect(columns.vendorId).toBeDefined();
      expect(columns.name).toBeDefined();
      expect(columns.role).toBeDefined();
      expect(columns.phone).toBeDefined();
      expect(columns.email).toBeDefined();
      expect(columns.isPrimary).toBeDefined();
      expect(columns.notes).toBeDefined();
      expect(columns.createdAt).toBeDefined();
      expect(columns.updatedAt).toBeDefined();
    });

    it("should enforce notNull on name and vendorId, and default false on isPrimary", () => {
      expect(columns.vendorId.notNull).toBe(true);
      expect(columns.name.notNull).toBe(true);
      expect(columns.isPrimary.notNull).toBe(true);
      expect(columns.isPrimary.default).toBe(false);
    });
  });

  describe("5. cost_items table linkage (R1 & AT23)", () => {
    const columns = getTableColumns(costItems);

    it("should contain vendorId and vendorQuoteId foreign key columns", () => {
      expect(columns.vendorId).toBeDefined();
      expect(columns.vendorQuoteId).toBeDefined();
      expect(columns.vendorId.notNull).toBe(false);
      expect(columns.vendorQuoteId.notNull).toBe(false);
    });

    it("AT23: cost_items table config must include cost_items_vendor_quote_id_unique partial unique index", () => {
      const config = getTableConfig(costItems);
      const quoteUniqueIdx = config.indexes.find(
        (idx) => idx.config.name === "cost_items_vendor_quote_id_unique"
      );

      expect(quoteUniqueIdx).toBeDefined();
      expect(quoteUniqueIdx?.config.unique).toBe(true);
      expect(quoteUniqueIdx?.config.where).toBeDefined();

      const isUnique = quoteUniqueIdx?.config.unique ?? (quoteUniqueIdx as any)?.isUnique;
      expect(isUnique).toBe(true);
    });
  });

  describe("6. Drizzle Relations", () => {
    it("should export vendorsRelations, vendorQuotesRelations, contactsRelations, and costItemsRelations", () => {
      expect(vendorsRelations).toBeDefined();
      expect(vendorsRelations.table).toBe(vendors);

      expect(vendorQuotesRelations).toBeDefined();
      expect(vendorQuotesRelations.table).toBe(vendorQuotes);

      expect(contactsRelations).toBeDefined();
      expect(contactsRelations.table).toBe(contacts);

      expect(costItemsRelations).toBeDefined();
      expect(costItemsRelations.table).toBe(costItems);
    });
  });

  describe("7. Migration 0002 & RLS Contract Verification (AT03, AT23, AT41)", () => {
    const migrationPath = path.resolve(
      process.cwd(),
      "src/db/migrations/0002_vendors_and_quotes.sql"
    );
    const sqlContent = fs.readFileSync(migrationPath, "utf-8");

    it("AT23: migration must enforce partial unique index on cost_items.vendor_quote_id", () => {
      expect(sqlContent).toContain(
        'CREATE UNIQUE INDEX "cost_items_vendor_quote_id_unique" ON "cost_items" ("vendor_quote_id")'
      );
      expect(sqlContent).toContain('WHERE "vendor_quote_id" IS NOT NULL');
    });

    it("migration must alter cost_items to add vendor_id and vendor_quote_id columns", () => {
      expect(sqlContent).toContain('ALTER TABLE "cost_items" ADD COLUMN "vendor_id" uuid');
      expect(sqlContent).toContain('ALTER TABLE "cost_items" ADD COLUMN "vendor_quote_id" uuid');
    });

    it("AT03 & AT41: migration must enable and FORCE RLS on vendors, vendor_quotes, and contacts", () => {
      expect(sqlContent).toContain('ALTER TABLE "vendors" ENABLE ROW LEVEL SECURITY;');
      expect(sqlContent).toContain('ALTER TABLE "vendors" FORCE ROW LEVEL SECURITY;');
      expect(sqlContent).toContain('ALTER TABLE "vendor_quotes" ENABLE ROW LEVEL SECURITY;');
      expect(sqlContent).toContain('ALTER TABLE "vendor_quotes" FORCE ROW LEVEL SECURITY;');
      expect(sqlContent).toContain('ALTER TABLE "contacts" ENABLE ROW LEVEL SECURITY;');
      expect(sqlContent).toContain('ALTER TABLE "contacts" FORCE ROW LEVEL SECURITY;');
    });

    it("AT03 & AT41: migration must define owner policies and STRICT DENY for family_view (zero SELECT policies)", () => {
      expect(sqlContent).toContain("CREATE POLICY owner_all_vendors ON \"vendors\"");
      expect(sqlContent).toContain("CREATE POLICY owner_all_vendor_quotes ON \"vendor_quotes\"");
      expect(sqlContent).toContain("CREATE POLICY owner_all_contacts ON \"contacts\"");

      // Verify that NO family_view SELECT policy exists for vendor_quotes
      expect(sqlContent).not.toContain("family_select_vendor_quotes");
      expect(sqlContent).not.toContain("family_view");
    });

    it("migration journal meta must be updated with 0002 entry", () => {
      const journalPath = path.resolve(
        process.cwd(),
        "src/db/migrations/meta/_journal.json"
      );
      const journalContent = fs.readFileSync(journalPath, "utf-8");
      const journal = JSON.parse(journalContent);
      const entry = journal.entries.find(
        (e: { tag: string }) => e.tag === "0002_vendors_and_quotes"
      );
      expect(entry).toBeDefined();
      expect(entry.idx).toBe(1);
    });
  });
});
