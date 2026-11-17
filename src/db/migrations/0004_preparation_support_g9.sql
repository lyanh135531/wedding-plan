-- ==============================================================================
-- Migration: 0004_preparation_support_g9.sql
-- Description: Create tables for Preparation Items (Ideas, Items, Music, Shots)
--              and Support Assignments (Wedding Party) (Gate G9 Milestone M9.1);
--              Add foreign keys, indexes, and constraints;
--              Enable and force Row Level Security (RLS) on both tables;
--              Define full access policies for owner/planner roles;
--              Define SELECT-only policies for family_view on permitted events where is_shared = true;
--              Strictly block all write operations for family_view (AT03, AT26).
-- Standards: PLAN.md §14, §15, §20.1, §24, §25: AT03, AT26
-- ==============================================================================

-- -------------------------------------------------------------
-- 1. PREPARATION ITEMS TABLE
-- -------------------------------------------------------------

CREATE TABLE "preparation_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" varchar(255) NOT NULL,
	"category" text,
	"status" text NOT NULL,
	"priority" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_rental" boolean DEFAULT false NOT NULL,
	"return_due_date" timestamp with time zone,
	"is_blacklisted" boolean DEFAULT false NOT NULL,
	"is_shared" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"handed_over_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);
--> statement-breakpoint

-- -------------------------------------------------------------
-- 2. SUPPORT ASSIGNMENTS TABLE
-- -------------------------------------------------------------

CREATE TABLE "support_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"contact_id" uuid,
	"name" varchar(255) NOT NULL,
	"phone" varchar(50) NOT NULL,
	"roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"arrival_time" varchar(50),
	"backup_name" varchar(255),
	"backup_phone" varchar(50),
	"attire_notes" text,
	"duties" text,
	"assigned_task_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"assigned_item_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_shared" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);
--> statement-breakpoint

-- -------------------------------------------------------------
-- 3. FOREIGN KEYS & CONSTRAINTS
-- -------------------------------------------------------------

ALTER TABLE "preparation_items" ADD CONSTRAINT "preparation_items_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "support_assignments" ADD CONSTRAINT "support_assignments_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "support_assignments" ADD CONSTRAINT "support_assignments_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

-- -------------------------------------------------------------
-- 4. PERFORMANCE INDEXES
-- -------------------------------------------------------------

CREATE INDEX "preparation_items_event_id_idx" ON "preparation_items" USING btree ("event_id");
--> statement-breakpoint
CREATE INDEX "preparation_items_type_idx" ON "preparation_items" USING btree ("type");
--> statement-breakpoint
CREATE INDEX "preparation_items_status_idx" ON "preparation_items" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "preparation_items_is_shared_idx" ON "preparation_items" USING btree ("is_shared");
--> statement-breakpoint

CREATE INDEX "support_assignments_event_id_idx" ON "support_assignments" USING btree ("event_id");
--> statement-breakpoint
CREATE INDEX "support_assignments_contact_id_idx" ON "support_assignments" USING btree ("contact_id");
--> statement-breakpoint
CREATE INDEX "support_assignments_is_shared_idx" ON "support_assignments" USING btree ("is_shared");
--> statement-breakpoint

-- -------------------------------------------------------------
-- 5. ENABLE AND FORCE ROW LEVEL SECURITY (RLS)
-- -------------------------------------------------------------

ALTER TABLE "preparation_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "preparation_items" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE "support_assignments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "support_assignments" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

-- -------------------------------------------------------------
-- 6. OWNER/PLANNER FULL ACCESS POLICIES
-- -------------------------------------------------------------

CREATE POLICY owner_all_preparation_items ON "preparation_items"
  FOR ALL TO PUBLIC
  USING (current_setting('app.current_role', true) IN ('owner', 'planner'));
--> statement-breakpoint

CREATE POLICY owner_all_support_assignments ON "support_assignments"
  FOR ALL TO PUBLIC
  USING (current_setting('app.current_role', true) IN ('owner', 'planner'));
--> statement-breakpoint

-- -------------------------------------------------------------
-- 7. FAMILY_VIEW POLICIES (READ-ONLY ON SHARED ITEMS OF PERMITTED EVENTS)
-- Strict DENY on write operations: no INSERT, UPDATE, DELETE policies exist for family_view
-- -------------------------------------------------------------

CREATE POLICY family_select_preparation_items ON "preparation_items"
  FOR SELECT TO PUBLIC
  USING (
    current_setting('app.current_role', true) = 'family_view'
    AND is_shared = true
    AND event_id IN (SELECT public.get_current_user_allowed_event_ids())
  );
--> statement-breakpoint

CREATE POLICY family_select_support_assignments ON "support_assignments"
  FOR SELECT TO PUBLIC
  USING (
    current_setting('app.current_role', true) = 'family_view'
    AND is_shared = true
    AND event_id IN (SELECT public.get_current_user_allowed_event_ids())
  );
--> statement-breakpoint
