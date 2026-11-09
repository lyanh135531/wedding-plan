-- ==============================================================================
-- Migration: 0001_rls_policies.sql
-- Description: Enable & Force Row Level Security on all 33 tables.
--              Implements Owner full-access, Family View-only scoping,
--              Strict DENY on financial tables, unauthenticated Better Auth lookup,
--              and eliminates policy recursion via SECURITY DEFINER.
-- Standards: PLAN.md §5.1, §5.2, §21.2, PLAN_REVIEW RV05, AT03, AT57
-- ==============================================================================

-- -------------------------------------------------------------
-- 1. Helper Function: get_current_user_allowed_event_ids()
-- STABLE + SECURITY DEFINER with fixed search_path prevents RLS recursion on member_event_access
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_current_user_allowed_event_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT event_id 
  FROM member_event_access
  WHERE user_id = nullif(current_setting('app.current_user_id', true), '');
$$;

-- -------------------------------------------------------------
-- 2. ENABLE & FORCE RLS ON ALL 33 APPLICATION TABLES
-- -------------------------------------------------------------

-- Auth tables (6)
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;

ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions" FORCE ROW LEVEL SECURITY;

ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounts" FORCE ROW LEVEL SECURITY;

ALTER TABLE "verifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "verifications" FORCE ROW LEVEL SECURITY;

ALTER TABLE "member_invites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "member_invites" FORCE ROW LEVEL SECURITY;

ALTER TABLE "member_event_access" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "member_event_access" FORCE ROW LEVEL SECURITY;

-- Events & Settings tables (2)
ALTER TABLE "events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "events" FORCE ROW LEVEL SECURITY;

ALTER TABLE "wedding_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "wedding_settings" FORCE ROW LEVEL SECURITY;

-- Guests tables (6)
ALTER TABLE "guest_groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "guest_groups" FORCE ROW LEVEL SECURITY;

ALTER TABLE "guests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "guests" FORCE ROW LEVEL SECURITY;

ALTER TABLE "invitations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invitations" FORCE ROW LEVEL SECURITY;

ALTER TABLE "invitation_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invitation_members" FORCE ROW LEVEL SECURITY;

ALTER TABLE "attendance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance" FORCE ROW LEVEL SECURITY;

ALTER TABLE "contact_followups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contact_followups" FORCE ROW LEVEL SECURITY;

-- Financial tables (8)
ALTER TABLE "budget_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "budget_categories" FORCE ROW LEVEL SECURITY;

ALTER TABLE "category_budgets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "category_budgets" FORCE ROW LEVEL SECURITY;

ALTER TABLE "cost_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cost_items" FORCE ROW LEVEL SECURITY;

ALTER TABLE "payment_schedules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_schedules" FORCE ROW LEVEL SECURITY;

ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payments" FORCE ROW LEVEL SECURITY;

ALTER TABLE "payment_allocations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_allocations" FORCE ROW LEVEL SECURITY;

ALTER TABLE "fund_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fund_settings" FORCE ROW LEVEL SECURITY;

ALTER TABLE "funding_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "funding_entries" FORCE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'gift_returns') THEN
    EXECUTE 'ALTER TABLE "gift_returns" ENABLE ROW LEVEL SECURITY; ALTER TABLE "gift_returns" FORCE ROW LEVEL SECURITY;';
  END IF;
END $$;

-- Tasks & Appointments tables (4)
ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tasks" FORCE ROW LEVEL SECURITY;

ALTER TABLE "task_checklist_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "task_checklist_items" FORCE ROW LEVEL SECURITY;

ALTER TABLE "task_dependencies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "task_dependencies" FORCE ROW LEVEL SECURITY;

ALTER TABLE "appointments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointments" FORCE ROW LEVEL SECURITY;

-- Files & Storage tables (2)
ALTER TABLE "attachments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attachments" FORCE ROW LEVEL SECURITY;

ALTER TABLE "attachment_variants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attachment_variants" FORCE ROW LEVEL SECURITY;

-- System & Audit tables (5)
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;

ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" FORCE ROW LEVEL SECURITY;

ALTER TABLE "idempotency_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "idempotency_records" FORCE ROW LEVEL SECURITY;

ALTER TABLE "import_batches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "import_batches" FORCE ROW LEVEL SECURITY;

ALTER TABLE "import_rows" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "import_rows" FORCE ROW LEVEL SECURITY;

-- -------------------------------------------------------------
-- 3. FINANCIAL TABLES: OWNER FULL ACCESS & STRICT FAMILY DENY (AT03)
-- -------------------------------------------------------------

-- budget_categories
CREATE POLICY owner_all_budget_categories ON "budget_categories"
  FOR ALL TO PUBLIC
  USING (current_setting('app.current_role', true) = 'owner')
  WITH CHECK (current_setting('app.current_role', true) = 'owner');

-- category_budgets
CREATE POLICY owner_all_category_budgets ON "category_budgets"
  FOR ALL TO PUBLIC
  USING (current_setting('app.current_role', true) = 'owner')
  WITH CHECK (current_setting('app.current_role', true) = 'owner');

-- cost_items
CREATE POLICY owner_all_cost_items ON "cost_items"
  FOR ALL TO PUBLIC
  USING (current_setting('app.current_role', true) = 'owner')
  WITH CHECK (current_setting('app.current_role', true) = 'owner');

-- payment_schedules
CREATE POLICY owner_all_payment_schedules ON "payment_schedules"
  FOR ALL TO PUBLIC
  USING (current_setting('app.current_role', true) = 'owner')
  WITH CHECK (current_setting('app.current_role', true) = 'owner');

-- payments
CREATE POLICY owner_all_payments ON "payments"
  FOR ALL TO PUBLIC
  USING (current_setting('app.current_role', true) = 'owner')
  WITH CHECK (current_setting('app.current_role', true) = 'owner');

-- payment_allocations
CREATE POLICY owner_all_payment_allocations ON "payment_allocations"
  FOR ALL TO PUBLIC
  USING (current_setting('app.current_role', true) = 'owner')
  WITH CHECK (current_setting('app.current_role', true) = 'owner');

-- fund_settings
CREATE POLICY owner_all_fund_settings ON "fund_settings"
  FOR ALL TO PUBLIC
  USING (current_setting('app.current_role', true) = 'owner')
  WITH CHECK (current_setting('app.current_role', true) = 'owner');

-- funding_entries
CREATE POLICY owner_all_funding_entries ON "funding_entries"
  FOR ALL TO PUBLIC
  USING (current_setting('app.current_role', true) = 'owner')
  WITH CHECK (current_setting('app.current_role', true) = 'owner');

-- Optional gift_returns if table exists
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'gift_returns') THEN
    EXECUTE $policy$
      CREATE POLICY owner_all_gift_returns ON "gift_returns"
        FOR ALL TO PUBLIC
        USING (current_setting('app.current_role', true) = 'owner')
        WITH CHECK (current_setting('app.current_role', true) = 'owner');
    $policy$;
  END IF;
END $$;

-- -------------------------------------------------------------
-- 4. EVENTS & SETTINGS POLICIES
-- -------------------------------------------------------------

-- events
CREATE POLICY owner_all_events ON "events"
  FOR ALL TO PUBLIC
  USING (current_setting('app.current_role', true) = 'owner')
  WITH CHECK (current_setting('app.current_role', true) = 'owner');

CREATE POLICY family_select_events ON "events"
  FOR SELECT TO PUBLIC
  USING (
    current_setting('app.current_role', true) = 'family_view'
    AND id IN (SELECT public.get_current_user_allowed_event_ids())
  );

-- wedding_settings
CREATE POLICY owner_all_wedding_settings ON "wedding_settings"
  FOR ALL TO PUBLIC
  USING (current_setting('app.current_role', true) = 'owner')
  WITH CHECK (current_setting('app.current_role', true) = 'owner');

CREATE POLICY family_select_wedding_settings ON "wedding_settings"
  FOR SELECT TO PUBLIC
  USING (current_setting('app.current_role', true) = 'family_view');

-- -------------------------------------------------------------
-- 5. GUESTS & INVITATIONS POLICIES
-- -------------------------------------------------------------

-- guest_groups
CREATE POLICY owner_all_guest_groups ON "guest_groups"
  FOR ALL TO PUBLIC
  USING (current_setting('app.current_role', true) = 'owner')
  WITH CHECK (current_setting('app.current_role', true) = 'owner');

CREATE POLICY family_select_guest_groups ON "guest_groups"
  FOR SELECT TO PUBLIC
  USING (current_setting('app.current_role', true) = 'family_view');

-- guests
CREATE POLICY owner_all_guests ON "guests"
  FOR ALL TO PUBLIC
  USING (current_setting('app.current_role', true) = 'owner')
  WITH CHECK (current_setting('app.current_role', true) = 'owner');

CREATE POLICY family_select_guests ON "guests"
  FOR SELECT TO PUBLIC
  USING (
    current_setting('app.current_role', true) = 'family_view'
    AND id IN (
      SELECT guest_id 
      FROM attendance 
      WHERE event_id IN (SELECT public.get_current_user_allowed_event_ids())
    )
  );

-- invitations
CREATE POLICY owner_all_invitations ON "invitations"
  FOR ALL TO PUBLIC
  USING (current_setting('app.current_role', true) = 'owner')
  WITH CHECK (current_setting('app.current_role', true) = 'owner');

CREATE POLICY family_select_invitations ON "invitations"
  FOR SELECT TO PUBLIC
  USING (
    current_setting('app.current_role', true) = 'family_view'
    AND event_id IN (SELECT public.get_current_user_allowed_event_ids())
  );

-- invitation_members
CREATE POLICY owner_all_invitation_members ON "invitation_members"
  FOR ALL TO PUBLIC
  USING (current_setting('app.current_role', true) = 'owner')
  WITH CHECK (current_setting('app.current_role', true) = 'owner');

CREATE POLICY family_select_invitation_members ON "invitation_members"
  FOR SELECT TO PUBLIC
  USING (
    current_setting('app.current_role', true) = 'family_view'
    AND invitation_id IN (
      SELECT id 
      FROM invitations 
      WHERE event_id IN (SELECT public.get_current_user_allowed_event_ids())
    )
  );

-- attendance
CREATE POLICY owner_all_attendance ON "attendance"
  FOR ALL TO PUBLIC
  USING (current_setting('app.current_role', true) = 'owner')
  WITH CHECK (current_setting('app.current_role', true) = 'owner');

CREATE POLICY family_select_attendance ON "attendance"
  FOR SELECT TO PUBLIC
  USING (
    current_setting('app.current_role', true) = 'family_view'
    AND event_id IN (SELECT public.get_current_user_allowed_event_ids())
  );

-- contact_followups (Private guest communications: Owner only)
CREATE POLICY owner_all_contact_followups ON "contact_followups"
  FOR ALL TO PUBLIC
  USING (current_setting('app.current_role', true) = 'owner')
  WITH CHECK (current_setting('app.current_role', true) = 'owner');

-- -------------------------------------------------------------
-- 6. TASKS & APPOINTMENTS POLICIES
-- -------------------------------------------------------------

-- tasks
CREATE POLICY owner_all_tasks ON "tasks"
  FOR ALL TO PUBLIC
  USING (current_setting('app.current_role', true) = 'owner')
  WITH CHECK (current_setting('app.current_role', true) = 'owner');

CREATE POLICY family_select_tasks ON "tasks"
  FOR SELECT TO PUBLIC
  USING (
    current_setting('app.current_role', true) = 'family_view'
    AND shared_with_family = true
  );

-- task_checklist_items (Owner only per PLAN §5.4)
CREATE POLICY owner_all_task_checklist_items ON "task_checklist_items"
  FOR ALL TO PUBLIC
  USING (current_setting('app.current_role', true) = 'owner')
  WITH CHECK (current_setting('app.current_role', true) = 'owner');

-- task_dependencies (Owner only)
CREATE POLICY owner_all_task_dependencies ON "task_dependencies"
  FOR ALL TO PUBLIC
  USING (current_setting('app.current_role', true) = 'owner')
  WITH CHECK (current_setting('app.current_role', true) = 'owner');

-- appointments
CREATE POLICY owner_all_appointments ON "appointments"
  FOR ALL TO PUBLIC
  USING (current_setting('app.current_role', true) = 'owner')
  WITH CHECK (current_setting('app.current_role', true) = 'owner');

CREATE POLICY family_select_appointments ON "appointments"
  FOR SELECT TO PUBLIC
  USING (
    current_setting('app.current_role', true) = 'family_view'
    AND shared_with_family = true
  );

-- -------------------------------------------------------------
-- 7. FILES & ATTACHMENTS POLICIES
-- -------------------------------------------------------------

-- attachments
CREATE POLICY owner_all_attachments ON "attachments"
  FOR ALL TO PUBLIC
  USING (current_setting('app.current_role', true) = 'owner')
  WITH CHECK (current_setting('app.current_role', true) = 'owner');

CREATE POLICY family_select_attachments ON "attachments"
  FOR SELECT TO PUBLIC
  USING (
    current_setting('app.current_role', true) = 'family_view'
    AND owner_only = false
    AND is_private = false
  );

-- attachment_variants
CREATE POLICY owner_all_attachment_variants ON "attachment_variants"
  FOR ALL TO PUBLIC
  USING (current_setting('app.current_role', true) = 'owner')
  WITH CHECK (current_setting('app.current_role', true) = 'owner');

CREATE POLICY family_select_attachment_variants ON "attachment_variants"
  FOR SELECT TO PUBLIC
  USING (
    current_setting('app.current_role', true) = 'family_view'
    AND attachment_id IN (
      SELECT id 
      FROM attachments 
      WHERE owner_only = false AND is_private = false
    )
  );

-- -------------------------------------------------------------
-- 8. AUTH & SYSTEM POLICIES
-- -------------------------------------------------------------

-- users
CREATE POLICY owner_all_users ON "users"
  FOR ALL TO PUBLIC
  USING (current_setting('app.current_role', true) = 'owner')
  WITH CHECK (current_setting('app.current_role', true) = 'owner');

CREATE POLICY family_select_users ON "users"
  FOR SELECT TO PUBLIC
  USING (
    current_setting('app.current_role', true) = 'family_view'
    AND (
      id = nullif(current_setting('app.current_user_id', true), '')
      OR role = 'owner'
    )
  );

-- Unauthenticated basic lookup so Better Auth can resolve user by id/email during auth validation
CREATE POLICY users_auth_lookup ON "users"
  FOR SELECT TO PUBLIC
  USING (
    nullif(current_setting('app.current_role', true), '') IS NULL
    AND (
      role = 'owner'
      OR id IN (SELECT user_id FROM sessions WHERE expires_at > clock_timestamp())
    )
  );

-- sessions
CREATE POLICY owner_all_sessions ON "sessions"
  FOR ALL TO PUBLIC
  USING (current_setting('app.current_role', true) = 'owner')
  WITH CHECK (current_setting('app.current_role', true) = 'owner');

-- Authenticated user can read/manage own active sessions
CREATE POLICY user_manage_own_sessions ON "sessions"
  FOR ALL TO PUBLIC
  USING (
    user_id = nullif(current_setting('app.current_user_id', true), '')
  )
  WITH CHECK (
    user_id = nullif(current_setting('app.current_user_id', true), '')
  );

-- Unauthenticated token lookup so Better Auth can resolve active sessions by token before context is established
CREATE POLICY sessions_token_lookup ON "sessions"
  FOR SELECT TO PUBLIC
  USING (
    nullif(current_setting('app.current_role', true), '') IS NULL
    AND token IS NOT NULL
    AND expires_at > clock_timestamp()
  );

-- accounts (User can only read/manage own linked OAuth accounts)
CREATE POLICY user_manage_own_accounts ON "accounts"
  FOR ALL TO PUBLIC
  USING (
    user_id = nullif(current_setting('app.current_user_id', true), '')
    OR current_setting('app.current_role', true) = 'owner'
  )
  WITH CHECK (
    user_id = nullif(current_setting('app.current_user_id', true), '')
    OR current_setting('app.current_role', true) = 'owner'
  );

-- verifications (Owner full access, unauthenticated lookup for magic link / token verification)
CREATE POLICY owner_all_verifications ON "verifications"
  FOR ALL TO PUBLIC
  USING (current_setting('app.current_role', true) = 'owner')
  WITH CHECK (current_setting('app.current_role', true) = 'owner');

CREATE POLICY verifications_token_lookup ON "verifications"
  FOR SELECT TO PUBLIC
  USING (
    nullif(current_setting('app.current_role', true), '') IS NULL
  );

-- member_invites (Owner full access, unauthenticated lookup for invite token acceptance)
CREATE POLICY owner_all_member_invites ON "member_invites"
  FOR ALL TO PUBLIC
  USING (current_setting('app.current_role', true) = 'owner')
  WITH CHECK (current_setting('app.current_role', true) = 'owner');

CREATE POLICY invites_token_lookup ON "member_invites"
  FOR SELECT TO PUBLIC
  USING (
    nullif(current_setting('app.current_role', true), '') IS NULL
    AND token_hash IS NOT NULL
    AND status = 'pending'
    AND expires_at > clock_timestamp()
  );

-- member_event_access
CREATE POLICY owner_all_member_event_access ON "member_event_access"
  FOR ALL TO PUBLIC
  USING (current_setting('app.current_role', true) = 'owner')
  WITH CHECK (current_setting('app.current_role', true) = 'owner');

CREATE POLICY family_select_own_event_access ON "member_event_access"
  FOR SELECT TO PUBLIC
  USING (
    current_setting('app.current_role', true) = 'family_view'
    AND user_id = nullif(current_setting('app.current_user_id', true), '')
  );

-- audit_logs (Owner only)
CREATE POLICY owner_all_audit_logs ON "audit_logs"
  FOR ALL TO PUBLIC
  USING (current_setting('app.current_role', true) = 'owner')
  WITH CHECK (current_setting('app.current_role', true) = 'owner');

-- notifications (Users can manage own notifications)
CREATE POLICY user_manage_own_notifications ON "notifications"
  FOR ALL TO PUBLIC
  USING (
    user_id = nullif(current_setting('app.current_user_id', true), '')
    OR current_setting('app.current_role', true) = 'owner'
  )
  WITH CHECK (
    user_id = nullif(current_setting('app.current_user_id', true), '')
    OR current_setting('app.current_role', true) = 'owner'
  );

-- idempotency_records (Users can manage own idempotency locks)
CREATE POLICY user_manage_own_idempotency ON "idempotency_records"
  FOR ALL TO PUBLIC
  USING (
    user_id = nullif(current_setting('app.current_user_id', true), '')
    OR current_setting('app.current_role', true) = 'owner'
  )
  WITH CHECK (
    user_id = nullif(current_setting('app.current_user_id', true), '')
    OR current_setting('app.current_role', true) = 'owner'
  );

-- import_batches (Owner only)
CREATE POLICY owner_all_import_batches ON "import_batches"
  FOR ALL TO PUBLIC
  USING (current_setting('app.current_role', true) = 'owner')
  WITH CHECK (current_setting('app.current_role', true) = 'owner');

-- import_rows (Owner only)
CREATE POLICY owner_all_import_rows ON "import_rows"
  FOR ALL TO PUBLIC
  USING (current_setting('app.current_role', true) = 'owner')
  WITH CHECK (current_setting('app.current_role', true) = 'owner');
