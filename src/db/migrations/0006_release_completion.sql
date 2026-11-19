ALTER TABLE catering_snapshots ALTER COLUMN locked_by TYPE text USING locked_by::text;
ALTER TABLE catering_snapshots ADD COLUMN menu_snapshot jsonb;
ALTER TABLE gifts ADD COLUMN received_at timestamptz;
UPDATE gifts SET received_at = created_at;
ALTER TABLE gifts ALTER COLUMN received_at SET NOT NULL;
ALTER TABLE gifts ALTER COLUMN received_at SET DEFAULT clock_timestamp();
CREATE TABLE media_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, url text NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('photo_album','video_highlight','raw_footage','other')),
  notes text, version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE media_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_links FORCE ROW LEVEL SECURITY;
CREATE POLICY media_links_owner ON media_links FOR ALL USING (current_setting('app.current_role', true) = 'owner') WITH CHECK (current_setting('app.current_role', true) = 'owner');

-- Enforce archive at the database boundary, including old APIs and direct service writes.
-- Shared write locks and the exclusive archive lock serialize freeze with in-flight writes.
CREATE FUNCTION enforce_wedding_archive() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE archived boolean;
BEGIN
  IF TG_TABLE_NAME = 'wedding_settings' THEN
    PERFORM pg_advisory_xact_lock(772034910);
    IF TG_OP = 'UPDATE' AND OLD.is_archived THEN
      IF NEW.is_archived = false AND
        (to_jsonb(NEW) - ARRAY['is_archived','reopened_at','reopened_by_user_id','updated_at','version']) =
        (to_jsonb(OLD) - ARRAY['is_archived','reopened_at','reopened_by_user_id','updated_at','version']) THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'Đám cưới đang lưu trữ. Hãy mở lại trước khi chỉnh sửa.' USING ERRCODE = 'P0001';
    END IF;
    IF TG_OP = 'DELETE' AND OLD.is_archived THEN
      RAISE EXCEPTION 'Không thể xóa cấu hình đang lưu trữ.' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    PERFORM pg_advisory_xact_lock_shared(772034910);
    SELECT is_archived INTO archived FROM wedding_settings LIMIT 1;
    IF archived THEN
      RAISE EXCEPTION 'Đám cưới đang lưu trữ. Hãy mở lại trước khi chỉnh sửa.' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

-- Serialize dependency insertion so concurrent edges cannot form a cycle.
CREATE FUNCTION enforce_task_dag() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(772034912);
  IF EXISTS (
    WITH RECURSIVE reachable(id) AS (
      SELECT NEW.dependent_task_id
      UNION
      SELECT d.dependent_task_id FROM task_dependencies d JOIN reachable r ON d.prerequisite_task_id = r.id
    ) SELECT 1 FROM reachable WHERE id = NEW.prerequisite_task_id
  ) THEN RAISE EXCEPTION 'Công việc không được tạo chu trình phụ thuộc.' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER task_dag_guard BEFORE INSERT ON task_dependencies FOR EACH ROW EXECUTE FUNCTION enforce_task_dag();
DO $$ DECLARE target record; BEGIN
  FOR target IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    AND tablename NOT IN ('users','sessions','accounts','verifications','member_invites','member_event_access','audit_logs','notifications','__drizzle_migrations','app_schema_migrations')
  LOOP
    EXECUTE format('CREATE TRIGGER wedding_archive_guard BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION enforce_wedding_archive()', target.tablename);
  END LOOP;
END $$;
