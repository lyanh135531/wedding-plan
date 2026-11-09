CREATE EXTENSION IF NOT EXISTS "unaccent";--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "pg_trgm";--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.immutable_unaccent(text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS
$$ SELECT public.unaccent($1) $$;--> statement-breakpoint
CREATE TYPE "public"."invite_status" AS ENUM('pending', 'accepted', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'family_view');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('tentative', 'confirmed', 'cancelled', 'completed');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('engagement', 'ancestor_ceremony', 'wedding_party', 'other');--> statement-breakpoint
CREATE TYPE "public"."age_tier" AS ENUM('adult', 'child', 'baby');--> statement-breakpoint
CREATE TYPE "public"."delivery_method" AS ENUM('paper', 'electronic', 'in_person');--> statement-breakpoint
CREATE TYPE "public"."dietary_tier" AS ENUM('regular', 'vegetarian', 'child_portion', 'special');--> statement-breakpoint
CREATE TYPE "public"."guest_side" AS ENUM('groom', 'bride', 'mutual', 'unassigned');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('save_the_date', 'preparing', 'sent');--> statement-breakpoint
CREATE TYPE "public"."rsvp_status" AS ENUM('not_contacted', 'pending_reply', 'tentative', 'accepted', 'declined');--> statement-breakpoint
CREATE TYPE "public"."cost_status" AS ENUM('draft', 'contracted', 'completed', 'cancelling', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."funding_entry_type" AS ENUM('cash_fund', 'direct_vendor_payment', 'pledged_unreceived');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'bank_transfer', 'other');--> statement-breakpoint
CREATE TYPE "public"."payment_type" AS ENUM('outflow', 'refund');--> statement-breakpoint
CREATE TYPE "public"."schedule_status" AS ENUM('estimated', 'agreed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."deadline_type" AS ENUM('fixed_date', 'fixed_datetime', 'relative_to_event');--> statement-breakpoint
CREATE TYPE "public"."relative_direction" AS ENUM('before', 'after');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('not_started', 'in_progress', 'blocked', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."attachment_entity_type" AS ENUM('cost_item', 'vendor', 'wedding', 'task');--> statement-breakpoint
CREATE TYPE "public"."image_variant_type" AS ENUM('thumbnail_320', 'preview_1600');--> statement-breakpoint
CREATE TYPE "public"."processing_status" AS ENUM('pending', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."batch_status" AS ENUM('staged', 'committed', 'rolled_back');--> statement-breakpoint
CREATE TYPE "public"."idempotency_status" AS ENUM('processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."import_type" AS ENUM('guests', 'cost_items');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_event_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"event_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "member_event_access_user_event_unique" UNIQUE("user_id","event_id")
);
--> statement-breakpoint
CREATE TABLE "member_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'family_view' NOT NULL,
	"allowed_event_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"invited_by_user_id" text NOT NULL,
	"status" "invite_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "member_invites_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" "user_role" DEFAULT 'family_view' NOT NULL,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"event_type" "event_type" NOT NULL,
	"status" "event_status" DEFAULT 'tentative' NOT NULL,
	"start_time" timestamp with time zone,
	"end_time" timestamp with time zone,
	"location_name" text,
	"location_address" text,
	"map_url" text,
	"contact_person" text,
	"contact_phone" text,
	"public_notes" text,
	"private_notes" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "events_time_order_check" CHECK (end_time IS NULL OR end_time >= start_time)
);
--> statement-breakpoint
CREATE TABLE "wedding_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bride_name" text NOT NULL,
	"groom_name" text NOT NULL,
	"short_title" text,
	"tentative_date_note" text DEFAULT 'Dự kiến sau Tết âm lịch 2028' NOT NULL,
	"is_date_confirmed" boolean DEFAULT false NOT NULL,
	"representative_event_id" uuid,
	"budget_target" bigint,
	"contingency_budget" bigint,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "wedding_settings_budget_target_check" CHECK (budget_target IS NULL OR budget_target >= 0),
	CONSTRAINT "wedding_settings_contingency_check" CHECK (contingency_budget IS NULL OR contingency_budget >= 0)
);
--> statement-breakpoint
CREATE TABLE "attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guest_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"rsvp_status" "rsvp_status" DEFAULT 'not_contacted' NOT NULL,
	"contact_count" integer DEFAULT 0 NOT NULL,
	"contact_notes" text,
	"next_followup_date" date,
	"needs_seat" boolean DEFAULT true NOT NULL,
	"needs_meal" boolean DEFAULT true NOT NULL,
	"meal_dietary_tier" "dietary_tier" DEFAULT 'regular' NOT NULL,
	"dietary_notes" text,
	"accommodation_needed" boolean DEFAULT false NOT NULL,
	"transport_needed" boolean DEFAULT false NOT NULL,
	"is_origin_onsite" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "attendance_guest_event_unique" UNIQUE("guest_id","event_id"),
	CONSTRAINT "attendance_contact_count_check" CHECK (contact_count >= 0)
);
--> statement-breakpoint
CREATE TABLE "contact_followups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guest_id" uuid NOT NULL,
	"event_id" uuid,
	"updated_by_user_id" text NOT NULL,
	"contact_time" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"outcome" text NOT NULL,
	"next_followup_date" date,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guest_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"side" "guest_side" DEFAULT 'unassigned' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"side" "guest_side" DEFAULT 'unassigned' NOT NULL,
	"group_id" uuid,
	"sub_tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"age_tier" "age_tier" DEFAULT 'adult' NOT NULL,
	"phone" text,
	"email" text,
	"address" text,
	"private_notes" text,
	"is_archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"is_placeholder" boolean DEFAULT false NOT NULL,
	"placeholder_for" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invitation_id" uuid NOT NULL,
	"guest_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "invitation_members_unique" UNIQUE("invitation_id","guest_id")
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"card_name" text NOT NULL,
	"representative_guest_id" uuid NOT NULL,
	"delivery_method" "delivery_method" DEFAULT 'paper' NOT NULL,
	"in_charge_user_id" text,
	"status" "invitation_status" DEFAULT 'save_the_date' NOT NULL,
	"sent_date" date,
	"notes" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"default_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "budget_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "category_budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"allocated_amount" bigint DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "category_budgets_category_id_unique" UNIQUE("category_id"),
	CONSTRAINT "category_budgets_allocated_check" CHECK (allocated_amount >= 0)
);
--> statement-breakpoint
CREATE TABLE "cost_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category_id" uuid NOT NULL,
	"event_id" uuid,
	"vendor_name" text,
	"vendor_phone" text,
	"vendor_contact" text,
	"estimated_amount" bigint,
	"contracted_amount" bigint,
	"final_settlement_amount" bigint,
	"status" "cost_status" DEFAULT 'draft' NOT NULL,
	"in_charge_user_id" text,
	"cancellation_fee" bigint,
	"cancellation_notes" text,
	"notes" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "cost_items_estimated_check" CHECK (estimated_amount IS NULL OR estimated_amount >= 0),
	CONSTRAINT "cost_items_contracted_check" CHECK (contracted_amount IS NULL OR contracted_amount >= 0),
	CONSTRAINT "cost_items_settlement_check" CHECK (final_settlement_amount IS NULL OR final_settlement_amount >= 0),
	CONSTRAINT "cost_items_cancellation_fee_check" CHECK (cancellation_fee IS NULL OR cancellation_fee >= 0)
);
--> statement-breakpoint
CREATE TABLE "fund_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opening_as_of" timestamp with time zone,
	"initial_balance" bigint DEFAULT 0 NOT NULL,
	"fund_scope_confirmed" boolean DEFAULT false NOT NULL,
	"confirmed_by" text,
	"notes" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "fund_settings_initial_balance_check" CHECK (initial_balance >= 0)
);
--> statement-breakpoint
CREATE TABLE "funding_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_type" "funding_entry_type" NOT NULL,
	"amount" bigint NOT NULL,
	"contributor_name" text,
	"contribution_date" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"linked_cost_item_id" uuid,
	"linked_payment_id" uuid,
	"notes" text,
	"is_voided" boolean DEFAULT false NOT NULL,
	"voided_reason" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "funding_entries_amount_check" CHECK (amount > 0)
);
--> statement-breakpoint
CREATE TABLE "payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"schedule_id" uuid,
	"allocated_amount" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "payment_allocations_amount_check" CHECK (allocated_amount > 0)
);
--> statement-breakpoint
CREATE TABLE "payment_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cost_item_id" uuid NOT NULL,
	"installment_number" integer NOT NULL,
	"title" text NOT NULL,
	"amount_due" bigint NOT NULL,
	"due_date" date NOT NULL,
	"status" "schedule_status" DEFAULT 'estimated' NOT NULL,
	"notes" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "payment_schedules_item_installment_unique" UNIQUE("cost_item_id","installment_number"),
	CONSTRAINT "payment_schedules_installment_check" CHECK (installment_number >= 1),
	CONSTRAINT "payment_schedules_amount_check" CHECK (amount_due > 0)
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cost_item_id" uuid NOT NULL,
	"payment_type" "payment_type" DEFAULT 'outflow' NOT NULL,
	"amount" bigint NOT NULL,
	"transaction_time" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"payment_method" "payment_method" DEFAULT 'bank_transfer' NOT NULL,
	"payer_name" text,
	"recipient_name" text,
	"parent_payment_id" uuid,
	"is_direct_third_party" boolean DEFAULT false NOT NULL,
	"linked_funding_entry_id" uuid,
	"notes" text,
	"is_voided" boolean DEFAULT false NOT NULL,
	"voided_reason" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "payments_amount_check" CHECK (amount > 0)
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"event_id" uuid,
	"location" text,
	"attendees" text,
	"in_charge_user_id" text,
	"notes" text,
	"shared_with_family" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "appointments_time_order_check" CHECK (end_time >= start_time)
);
--> statement-breakpoint
CREATE TABLE "task_checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"title" text NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_dependencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dependent_task_id" uuid NOT NULL,
	"prerequisite_task_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "task_dependencies_unique" UNIQUE("dependent_task_id","prerequisite_task_id"),
	CONSTRAINT "task_dependencies_no_self_ref" CHECK (dependent_task_id <> prerequisite_task_id)
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"category" text,
	"event_id" uuid,
	"in_charge_user_id" text,
	"support_contacts" text[] DEFAULT '{}'::text[] NOT NULL,
	"priority" "task_priority" DEFAULT 'normal' NOT NULL,
	"status" "task_status" DEFAULT 'not_started' NOT NULL,
	"deadline_type" "deadline_type" DEFAULT 'fixed_date' NOT NULL,
	"fixed_date" date,
	"fixed_datetime" timestamp with time zone,
	"relative_event_id" uuid,
	"relative_offset_days" integer,
	"relative_direction" "relative_direction" DEFAULT 'before' NOT NULL,
	"pinned_manual" boolean DEFAULT false NOT NULL,
	"private_notes" text,
	"shared_with_family" boolean DEFAULT false NOT NULL,
	"shared_public_title" text,
	"shared_public_notes" text,
	"reopened_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attachment_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attachment_id" uuid NOT NULL,
	"variant_type" "image_variant_type" NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text DEFAULT 'image/webp' NOT NULL,
	"file_size_bytes" bigint NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "attachment_variants_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "attachment_variants_type_unique" UNIQUE("attachment_id","variant_type")
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"storage_key" text NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size_bytes" bigint NOT NULL,
	"width" integer,
	"height" integer,
	"checksum_sha256" text NOT NULL,
	"is_private" boolean DEFAULT true NOT NULL,
	"owner_only" boolean DEFAULT true NOT NULL,
	"entity_type" "attachment_entity_type" NOT NULL,
	"entity_id" uuid,
	"processing_status" "processing_status" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"uploader_user_id" text NOT NULL,
	"lease_expires_at" timestamp with time zone,
	"is_archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "attachments_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "attachments_size_check" CHECK (file_size_bytes > 0)
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"before_state" jsonb,
	"after_state" jsonb,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"operation_type" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"request_hash" text NOT NULL,
	"status" "idempotency_status" DEFAULT 'processing' NOT NULL,
	"response_status" integer,
	"response_body" jsonb,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "idempotency_records_unique" UNIQUE("user_id","operation_type","idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"import_type" "import_type" NOT NULL,
	"file_name" text NOT NULL,
	"total_rows" integer NOT NULL,
	"valid_rows" integer DEFAULT 0 NOT NULL,
	"skipped_rows" integer DEFAULT 0 NOT NULL,
	"error_rows" integer DEFAULT 0 NOT NULL,
	"status" "batch_status" DEFAULT 'staged' NOT NULL,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"committed_at" timestamp with time zone,
	"rolled_back_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "import_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"row_index" integer NOT NULL,
	"raw_data" jsonb NOT NULL,
	"error_messages" text[] DEFAULT '{}'::text[] NOT NULL,
	"is_valid" boolean DEFAULT false NOT NULL,
	"is_skipped" boolean DEFAULT false NOT NULL,
	"target_entity_id" uuid,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"deduplication_key" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"snoozed_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "notifications_deduplication_key_unique" UNIQUE("deduplication_key")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_event_access" ADD CONSTRAINT "member_event_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_event_access" ADD CONSTRAINT "member_event_access_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_invites" ADD CONSTRAINT "member_invites_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wedding_settings" ADD CONSTRAINT "wedding_settings_representative_event_id_events_id_fk" FOREIGN KEY ("representative_event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_followups" ADD CONSTRAINT "contact_followups_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_followups" ADD CONSTRAINT "contact_followups_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_followups" ADD CONSTRAINT "contact_followups_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guests" ADD CONSTRAINT "guests_group_id_guest_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."guest_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_members" ADD CONSTRAINT "invitation_members_invitation_id_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."invitations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_members" ADD CONSTRAINT "invitation_members_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_representative_guest_id_guests_id_fk" FOREIGN KEY ("representative_guest_id") REFERENCES "public"."guests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_in_charge_user_id_users_id_fk" FOREIGN KEY ("in_charge_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_budgets" ADD CONSTRAINT "category_budgets_category_id_budget_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."budget_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_items" ADD CONSTRAINT "cost_items_category_id_budget_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."budget_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_items" ADD CONSTRAINT "cost_items_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_items" ADD CONSTRAINT "cost_items_in_charge_user_id_users_id_fk" FOREIGN KEY ("in_charge_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fund_settings" ADD CONSTRAINT "fund_settings_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding_entries" ADD CONSTRAINT "funding_entries_linked_cost_item_id_cost_items_id_fk" FOREIGN KEY ("linked_cost_item_id") REFERENCES "public"."cost_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_schedule_id_payment_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."payment_schedules"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_schedules" ADD CONSTRAINT "payment_schedules_cost_item_id_cost_items_id_fk" FOREIGN KEY ("cost_item_id") REFERENCES "public"."cost_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_cost_item_id_cost_items_id_fk" FOREIGN KEY ("cost_item_id") REFERENCES "public"."cost_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_parent_payment_id_payments_id_fk" FOREIGN KEY ("parent_payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_linked_funding_entry_id_funding_entries_id_fk" FOREIGN KEY ("linked_funding_entry_id") REFERENCES "public"."funding_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_in_charge_user_id_users_id_fk" FOREIGN KEY ("in_charge_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_checklist_items" ADD CONSTRAINT "task_checklist_items_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_dependent_task_id_tasks_id_fk" FOREIGN KEY ("dependent_task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_prerequisite_task_id_tasks_id_fk" FOREIGN KEY ("prerequisite_task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_in_charge_user_id_users_id_fk" FOREIGN KEY ("in_charge_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_relative_event_id_events_id_fk" FOREIGN KEY ("relative_event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachment_variants" ADD CONSTRAINT "attachment_variants_attachment_id_attachments_id_fk" FOREIGN KEY ("attachment_id") REFERENCES "public"."attachments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploader_user_id_users_id_fk" FOREIGN KEY ("uploader_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_batch_id_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."import_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "guests_display_name_trgm_idx" ON "guests" USING gin (immutable_unaccent(lower("display_name")) gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "guests_phone_idx" ON "guests" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "guests_group_id_idx" ON "guests" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "invitations_event_id_idx" ON "invitations" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "cost_items_category_id_idx" ON "cost_items" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "payments_cost_item_id_idx" ON "payments" USING btree ("cost_item_id");--> statement-breakpoint
CREATE INDEX "payments_transaction_time_idx" ON "payments" USING btree ("transaction_time");--> statement-breakpoint
CREATE INDEX "payments_parent_payment_id_idx" ON "payments" USING btree ("parent_payment_id");--> statement-breakpoint
CREATE INDEX "tasks_status_idx" ON "tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tasks_priority_idx" ON "tasks" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "tasks_event_id_idx" ON "tasks" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "attachments_entity_idx" ON "attachments" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_user_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "import_rows_batch_idx" ON "import_rows" USING btree ("batch_id","row_index");--> statement-breakpoint
CREATE INDEX "notifications_user_unread_idx" ON "notifications" USING btree ("user_id","is_read");