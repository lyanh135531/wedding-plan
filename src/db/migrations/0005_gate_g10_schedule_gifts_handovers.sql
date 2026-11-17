-- ==============================================================================
-- Migration: 0005_gate_g10_schedule_gifts_handovers.sql
-- Description: Create tables for Wedding Day Schedule / Timeline, Gifts Registry & Returns,
--              Handover Packets, and Post-Wedding Tasks (Milestone R3 Gate G10);
--              Extend attendance with check-in fields;
--              Extend events with check-in toggle;
--              Extend wedding_settings with archival freeze fields;
--              Enable and force RLS; define owner/planner full access policies;
--              Define family_view read-only policies for shared timeline & handovers;
--              Enforce STRICT DENY for family_view on all gift tables (AT03, AT25, AT26).
-- Standards: PLAN.md §14, §16, §24, §25: AT25, AT26, AT34, AT35, FL13, FL15, FL16, FL20
-- ==============================================================================

-- -------------------------------------------------------------
-- 1. ENUMS
-- -------------------------------------------------------------

CREATE TYPE "public"."timeline_status" AS ENUM('not_started', 'in_progress', 'completed', 'skipped');
--> statement-breakpoint
CREATE TYPE "public"."gift_type" AS ENUM('cash', 'physical');
--> statement-breakpoint
CREATE TYPE "public"."gift_reconciliation_status" AS ENUM('reconciled', 'needs_reconciliation');
--> statement-breakpoint
CREATE TYPE "public"."handover_status" AS ENUM('draft', 'handed_over');
--> statement-breakpoint

-- -------------------------------------------------------------
-- 2. CREATE NEW TABLES
-- -------------------------------------------------------------

CREATE TABLE "timeline_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"title" text NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"scheduled_start_time" timestamp with time zone NOT NULL,
	"scheduled_end_time" timestamp with time zone NOT NULL,
	"actual_start_time" timestamp with time zone,
	"actual_end_time" timestamp with time zone,
	"location_name" text,
	"person_in_charge" text,
	"in_charge_phone" text,
	"backup_person" text,
	"backup_phone" text,
	"support_assignment_id" uuid,
	"assigned_item_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"assigned_task_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"operational_notes" text,
	"is_shared" boolean DEFAULT true NOT NULL,
	"status" "timeline_status" DEFAULT 'not_started' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "timeline_items_time_order_check" CHECK (scheduled_end_time >= scheduled_start_time)
);
--> statement-breakpoint

CREATE TABLE "gifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"gift_type" "gift_type" DEFAULT 'cash' NOT NULL,
	"amount" bigint,
	"description" text,
	"received_by_user_id" text,
	"received_by_proxy" text,
	"envelope_code" text,
	"is_sender_identified" boolean DEFAULT true NOT NULL,
	"unidentified_notes" text,
	"reconciliation_status" "gift_reconciliation_status" DEFAULT 'reconciled' NOT NULL,
	"is_thanked" boolean DEFAULT false NOT NULL,
	"thanked_at" timestamp with time zone,
	"thanked_by_user_id" text,
	"thank_you_channel" text,
	"thank_you_notes" text,
	"is_voided" boolean DEFAULT false NOT NULL,
	"voided_reason" text,
	"voided_at" timestamp with time zone,
	"voided_by_user_id" text,
	"notes" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "gifts_amount_check" CHECK (amount IS NULL OR amount >= 0),
	CONSTRAINT "gifts_type_consistency_check" CHECK ((gift_type = 'physical' AND amount IS NULL) OR (gift_type = 'cash' AND amount IS NOT NULL))
);
--> statement-breakpoint

CREATE TABLE "gift_contributors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gift_id" uuid NOT NULL,
	"guest_id" uuid,
	"contributor_name" text NOT NULL,
	"relationship" text,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "gift_returns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gift_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"return_reason" text NOT NULL,
	"returned_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"handled_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "gift_returns_amount_check" CHECK (amount > 0)
);
--> statement-breakpoint

CREATE TABLE "handover_packets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"title" text NOT NULL,
	"scope" jsonb NOT NULL,
	"snapshot_data" jsonb NOT NULL,
	"handover_status" "handover_status" DEFAULT 'draft' NOT NULL,
	"handed_over_to" text,
	"handed_over_at" timestamp with time zone,
	"handed_over_channel" text,
	"is_shared_with_family" boolean DEFAULT false NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "post_wedding_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid,
	"task_key" text NOT NULL,
	"title" text NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"completed_by_user_id" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);
--> statement-breakpoint

-- -------------------------------------------------------------
-- 3. ALTER EXISTING TABLES
-- -------------------------------------------------------------

ALTER TABLE "attendance" ADD COLUMN "is_checked_in" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "check_in_time" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "checked_in_by_user_id" text;
--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "check_in_notes" text;
--> statement-breakpoint

ALTER TABLE "events" ADD COLUMN "is_check_in_enabled" boolean DEFAULT true NOT NULL;
--> statement-breakpoint

ALTER TABLE "wedding_settings" ADD COLUMN "is_archived" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "wedding_settings" ADD COLUMN "archived_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "wedding_settings" ADD COLUMN "archived_by_user_id" text;
--> statement-breakpoint
ALTER TABLE "wedding_settings" ADD COLUMN "archived_reason" text;
--> statement-breakpoint
ALTER TABLE "wedding_settings" ADD COLUMN "reopened_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "wedding_settings" ADD COLUMN "reopened_by_user_id" text;
--> statement-breakpoint

-- -------------------------------------------------------------
-- 4. FOREIGN KEYS & CONSTRAINTS
-- -------------------------------------------------------------

ALTER TABLE "timeline_items" ADD CONSTRAINT "timeline_items_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "timeline_items" ADD CONSTRAINT "timeline_items_support_assignment_id_support_assignments_id_fk" FOREIGN KEY ("support_assignment_id") REFERENCES "public"."support_assignments"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "gifts" ADD CONSTRAINT "gifts_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "gift_contributors" ADD CONSTRAINT "gift_contributors_gift_id_gifts_id_fk" FOREIGN KEY ("gift_id") REFERENCES "public"."gifts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "gift_contributors" ADD CONSTRAINT "gift_contributors_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "gift_returns" ADD CONSTRAINT "gift_returns_gift_id_gifts_id_fk" FOREIGN KEY ("gift_id") REFERENCES "public"."gifts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "handover_packets" ADD CONSTRAINT "handover_packets_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "post_wedding_tasks" ADD CONSTRAINT "post_wedding_tasks_wedding_id_wedding_settings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."wedding_settings"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- -------------------------------------------------------------
-- 5. PERFORMANCE INDEXES
-- -------------------------------------------------------------

CREATE INDEX "timeline_items_event_id_idx" ON "timeline_items" USING btree ("event_id");
--> statement-breakpoint
CREATE INDEX "timeline_items_status_idx" ON "timeline_items" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "timeline_items_scheduled_start_idx" ON "timeline_items" USING btree ("scheduled_start_time");
--> statement-breakpoint
CREATE INDEX "timeline_items_is_shared_idx" ON "timeline_items" USING btree ("is_shared");
--> statement-breakpoint

CREATE INDEX "gifts_event_id_idx" ON "gifts" USING btree ("event_id");
--> statement-breakpoint
CREATE INDEX "gifts_gift_type_idx" ON "gifts" USING btree ("gift_type");
--> statement-breakpoint
CREATE INDEX "gifts_is_thanked_idx" ON "gifts" USING btree ("is_thanked");
--> statement-breakpoint
CREATE INDEX "gifts_is_voided_idx" ON "gifts" USING btree ("is_voided");
--> statement-breakpoint
CREATE INDEX "gifts_is_sender_identified_idx" ON "gifts" USING btree ("is_sender_identified");
--> statement-breakpoint

CREATE INDEX "gift_contributors_gift_id_idx" ON "gift_contributors" USING btree ("gift_id");
--> statement-breakpoint
CREATE INDEX "gift_contributors_guest_id_idx" ON "gift_contributors" USING btree ("guest_id");
--> statement-breakpoint

CREATE INDEX "gift_returns_gift_id_idx" ON "gift_returns" USING btree ("gift_id");
--> statement-breakpoint

CREATE INDEX "handover_packets_event_id_idx" ON "handover_packets" USING btree ("event_id");
--> statement-breakpoint
CREATE INDEX "handover_packets_version_idx" ON "handover_packets" USING btree ("version");
--> statement-breakpoint

CREATE INDEX "attendance_is_checked_in_idx" ON "attendance" USING btree ("is_checked_in");
--> statement-breakpoint

-- -------------------------------------------------------------
-- 6. ENABLE AND FORCE ROW LEVEL SECURITY (RLS)
-- -------------------------------------------------------------

ALTER TABLE "timeline_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "timeline_items" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE "gifts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "gifts" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE "gift_contributors" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "gift_contributors" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE "gift_returns" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "gift_returns" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE "handover_packets" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "handover_packets" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE "post_wedding_tasks" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "post_wedding_tasks" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

-- -------------------------------------------------------------
-- 7. OWNER/PLANNER FULL ACCESS POLICIES
-- -------------------------------------------------------------

CREATE POLICY owner_all_timeline_items ON "timeline_items"
  FOR ALL TO PUBLIC
  USING (current_setting('app.current_role', true) IN ('owner', 'planner'));
--> statement-breakpoint

CREATE POLICY owner_all_gifts ON "gifts"
  FOR ALL TO PUBLIC
  USING (current_setting('app.current_role', true) IN ('owner', 'planner'));
--> statement-breakpoint

CREATE POLICY owner_all_gift_contributors ON "gift_contributors"
  FOR ALL TO PUBLIC
  USING (current_setting('app.current_role', true) IN ('owner', 'planner'));
--> statement-breakpoint

CREATE POLICY owner_all_gift_returns ON "gift_returns"
  FOR ALL TO PUBLIC
  USING (current_setting('app.current_role', true) IN ('owner', 'planner'));
--> statement-breakpoint

CREATE POLICY owner_all_handover_packets ON "handover_packets"
  FOR ALL TO PUBLIC
  USING (current_setting('app.current_role', true) IN ('owner', 'planner'));
--> statement-breakpoint

CREATE POLICY owner_all_post_wedding_tasks ON "post_wedding_tasks"
  FOR ALL TO PUBLIC
  USING (current_setting('app.current_role', true) IN ('owner', 'planner'));
--> statement-breakpoint

-- -------------------------------------------------------------
-- 8. FAMILY_VIEW POLICIES (READ-ONLY ON SHARED ITEMS OF PERMITTED EVENTS)
-- Invariants:
-- AT26: Family view gets only shared timeline and handover items
-- AT03, AT25: Strict DENY on all gift tables (zero policies exist for family_view)
-- -------------------------------------------------------------

CREATE POLICY family_select_timeline_items ON "timeline_items"
  FOR SELECT TO PUBLIC
  USING (
    current_setting('app.current_role', true) = 'family_view'
    AND is_shared = true
    AND event_id IN (SELECT public.get_current_user_allowed_event_ids())
  );
--> statement-breakpoint

CREATE POLICY family_select_handover_packets ON "handover_packets"
  FOR SELECT TO PUBLIC
  USING (
    current_setting('app.current_role', true) = 'family_view'
    AND is_shared_with_family = true
    AND event_id IN (SELECT public.get_current_user_allowed_event_ids())
  );
--> statement-breakpoint
