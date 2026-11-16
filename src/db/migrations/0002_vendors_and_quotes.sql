-- ==============================================================================
-- Migration: 0002_vendors_and_quotes.sql
-- Description: Create vendors, vendor_quotes, contacts tables;
--              Add vendor_id and vendor_quote_id FK to cost_items;
--              Enforce AT23 idempotency guard via partial unique index;
--              Enable and force RLS with strict non-owner DENY (AT03, AT41).
-- Standards: PLAN.md §11, §17.1, §25: AT03, AT23, AT24, AT41
-- ==============================================================================

-- 1. ENUMS
CREATE TYPE "public"."vendor_service_type" AS ENUM(
  'venue',
  'catering',
  'photography',
  'videography',
  'decoration',
  'attire',
  'makeup',
  'invitation',
  'music_entertainment',
  'transportation',
  'accommodation',
  'other'
);--> statement-breakpoint

CREATE TYPE "public"."vendor_status" AS ENUM(
  'researching',
  'contacted',
  'quoted',
  'shortlisted',
  'selected',
  'rejected',
  'cancelled'
);--> statement-breakpoint

-- 2. TABLES
CREATE TABLE "vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"service_type" "vendor_service_type" DEFAULT 'other' NOT NULL,
	"status" "vendor_status" DEFAULT 'researching' NOT NULL,
	"contact_person" text,
	"phone" text,
	"email" text,
	"address" text,
	"map_url" text,
	"website" text,
	"notes" text,
	"rating" integer,
	"capacity" integer,
	"min_guests" integer,
	"table_price" bigint,
	"seats_per_table" integer,
	"rental_fee" bigint,
	"fees_inclusive" boolean DEFAULT false NOT NULL,
	"prep_time" text,
	"end_time" text,
	"parking_notes" text,
	"rain_plan" text,
	"decor_audio_rules" text,
	"extra_fees_notes" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "vendors_capacity_check" CHECK (capacity IS NULL OR capacity > 0),
	CONSTRAINT "vendors_min_guests_check" CHECK (min_guests IS NULL OR min_guests >= 0),
	CONSTRAINT "vendors_seats_per_table_check" CHECK (seats_per_table IS NULL OR seats_per_table > 0),
	CONSTRAINT "vendors_table_price_check" CHECK (table_price IS NULL OR table_price >= 0),
	CONSTRAINT "vendors_rental_fee_check" CHECK (rental_fee IS NULL OR rental_fee >= 0),
	CONSTRAINT "vendors_rating_check" CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5))
);
--> statement-breakpoint

CREATE TABLE "vendor_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"package_group_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"version_number" integer DEFAULT 1 NOT NULL,
	"parent_quote_id" uuid,
	"quote_name" text NOT NULL,
	"received_date" date NOT NULL,
	"valid_until" date,
	"total_amount" bigint,
	"is_estimate" boolean DEFAULT false NOT NULL,
	"guest_count_assumption" integer,
	"table_count_assumption" integer,
	"terms" text,
	"includes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"excludes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"deposit_conditions" text,
	"is_selected" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "vendor_quotes_vendor_version_unique" UNIQUE("vendor_id","version_number"),
	CONSTRAINT "vendor_quotes_version_number_check" CHECK (version_number >= 1),
	CONSTRAINT "vendor_quotes_total_amount_check" CHECK (total_amount IS NULL OR total_amount >= 0),
	CONSTRAINT "vendor_quotes_validity_order_check" CHECK (valid_until IS NULL OR valid_until >= received_date)
);
--> statement-breakpoint

CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"name" text NOT NULL,
	"role" text,
	"phone" text,
	"email" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);
--> statement-breakpoint

-- 3. ALTER COST_ITEMS (LINKAGE)
ALTER TABLE "cost_items" ADD COLUMN "vendor_id" uuid;--> statement-breakpoint
ALTER TABLE "cost_items" ADD COLUMN "vendor_quote_id" uuid;--> statement-breakpoint

-- 4. FOREIGN KEY CONSTRAINTS
ALTER TABLE "vendor_quotes" ADD CONSTRAINT "vendor_quotes_vendor_id_vendors_id_fk" 
  FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "vendor_quotes" ADD CONSTRAINT "vendor_quotes_parent_quote_id_vendor_quotes_id_fk" 
  FOREIGN KEY ("parent_quote_id") REFERENCES "public"."vendor_quotes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "vendor_quotes" ADD CONSTRAINT "vendor_quotes_created_by_users_id_fk" 
  FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "contacts" ADD CONSTRAINT "contacts_vendor_id_vendors_id_fk" 
  FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "cost_items" ADD CONSTRAINT "cost_items_vendor_id_vendors_id_fk" 
  FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "cost_items" ADD CONSTRAINT "cost_items_vendor_quote_id_vendor_quotes_id_fk" 
  FOREIGN KEY ("vendor_quote_id") REFERENCES "public"."vendor_quotes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- 5. INDEXES & AT23 IDEMPOTENCY GUARD
CREATE INDEX "vendors_service_type_idx" ON "vendors" USING btree ("service_type");--> statement-breakpoint
CREATE INDEX "vendors_status_idx" ON "vendors" USING btree ("status");--> statement-breakpoint
CREATE INDEX "vendors_name_trgm_idx" ON "vendors" USING gin (immutable_unaccent(lower("name")) gin_trgm_ops);--> statement-breakpoint

CREATE INDEX "vendor_quotes_vendor_id_idx" ON "vendor_quotes" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "vendor_quotes_package_group_id_idx" ON "vendor_quotes" USING btree ("package_group_id");--> statement-breakpoint
CREATE INDEX "vendor_quotes_is_selected_idx" ON "vendor_quotes" USING btree ("vendor_id", "is_selected");--> statement-breakpoint

CREATE INDEX "contacts_vendor_id_idx" ON "contacts" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "contacts_phone_idx" ON "contacts" USING btree ("phone");--> statement-breakpoint

CREATE INDEX "cost_items_vendor_id_idx" ON "cost_items" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "cost_items_vendor_quote_id_idx" ON "cost_items" USING btree ("vendor_quote_id");--> statement-breakpoint

-- AT23: Partial unique index prevents duplicate cost item creation from the same vendor quote!
CREATE UNIQUE INDEX "cost_items_vendor_quote_id_unique" ON "cost_items" ("vendor_quote_id") 
  WHERE "vendor_quote_id" IS NOT NULL;--> statement-breakpoint

-- 6. ROW-LEVEL SECURITY (RLS) POLICIES (AT03, AT41)
ALTER TABLE "vendors" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "vendors" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

ALTER TABLE "vendor_quotes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "vendor_quotes" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

ALTER TABLE "contacts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "contacts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

-- Full access policy for Owner role on vendors
CREATE POLICY owner_all_vendors ON "vendors"
  FOR ALL TO PUBLIC
  USING (current_setting('app.current_role', true) = 'owner')
  WITH CHECK (current_setting('app.current_role', true) = 'owner');--> statement-breakpoint

-- Full access policy for Owner role on vendor_quotes (Strict DENY for non-owner - AT03, AT41)
CREATE POLICY owner_all_vendor_quotes ON "vendor_quotes"
  FOR ALL TO PUBLIC
  USING (current_setting('app.current_role', true) = 'owner')
  WITH CHECK (current_setting('app.current_role', true) = 'owner');--> statement-breakpoint

-- Full access policy for Owner role on contacts
CREATE POLICY owner_all_contacts ON "contacts"
  FOR ALL TO PUBLIC
  USING (current_setting('app.current_role', true) = 'owner')
  WITH CHECK (current_setting('app.current_role', true) = 'owner');
