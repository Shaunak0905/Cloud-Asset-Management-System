-- Week 2: assignment workflow + the narrow SECURITY DEFINER functions the app
-- needs wherever RLS alone can't express the rule.
--
-- Why SECURITY DEFINER functions (docs/04-rls-security-policies.md #6a):
-- the app connects as `app_user`, which is subject to RLS. Four operations
-- can't work through ordinary RLS policies:
--   * first-login provisioning — happens before any RLS identity exists,
--     and `users` deliberately has no INSERT policy;
--   * the public QR page — the visitor is unauthenticated, and must only ever
--     see a fixed set of safe columns (RLS filters rows, not columns);
--   * requesting / returning an asset — a MEMBER must flip the asset's status
--     and usage location, but `assets` UPDATE is admin-only under RLS.
-- Each function does exactly one thing, enforces its own invariants, and takes
-- the caller's identity from the RLS session settings (never from arguments),
-- so it can't be used to act as someone else. These functions are owned by the
-- migration role (DIRECT_DATABASE_URL), which owns the tables and so is not
-- itself filtered by RLS.
--
-- Must be applied with DIRECT_DATABASE_URL (the table owner), not as app_user.

-- ============================================================================
-- Schema changes
-- ============================================================================

-- docs/06-asset-management.md #18/#20 — optional expected return on a request;
-- also what the "overdue returns" admin metric (docs/12) is computed from.
ALTER TABLE "assignments" ADD COLUMN "expected_return_at" TIMESTAMPTZ;

-- Tables created by future migrations get the same grants as 0001's tables.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

-- ============================================================================
-- Hardening for the existing SECURITY DEFINER function (0001)
-- ============================================================================

-- Pin search_path so a definer function can't be hijacked via objects on a
-- caller-controlled schema, and stop every role (PUBLIC) from being able to
-- run the purge — only pg_cron (running as the owner) should.
ALTER FUNCTION purge_retired_assets() SET search_path = public;
REVOKE ALL ON FUNCTION purge_retired_assets() FROM PUBLIC;

-- ============================================================================
-- First-login provisioning (docs/05-authentication.md #6)
-- ============================================================================

-- Looks the user up by Entra ID object id, creating a MEMBER row if this is
-- their first sign-in. Never grants ADMIN/TECHNICIAN.
CREATE OR REPLACE FUNCTION app_login_user(p_entra_id text, p_full_name text, p_email text)
RETURNS TABLE (id uuid, full_name text, email text, role user_role, is_active boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
BEGIN
  INSERT INTO users (entra_id, full_name, email, role, updated_at)
  VALUES (p_entra_id, p_full_name, p_email, 'MEMBER', now())
  ON CONFLICT (entra_id) DO NOTHING;

  RETURN QUERY
    SELECT u.id, u.full_name, u.email, u.role, u.is_active
    FROM users u
    WHERE u.entra_id = p_entra_id;
END;
$$;

-- ============================================================================
-- Public QR read (docs/03-database-schema.md #24, docs/07-qr-system.md #18)
-- ============================================================================

-- Returns only the public-safe projection of an asset. Zero rows means the
-- code is unknown or the asset has already been purged by the retention job.
CREATE OR REPLACE FUNCTION get_public_asset(p_public_code text)
RETURNS TABLE (
  public_code   text,
  name          text,
  category      text,
  department    text,
  status        asset_status,
  building_name text,
  building_code text,
  room_name     text,
  room_code     text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.public_code, a.name, a.category, a.department, a.status,
         b.name, b.code, r.name, r.code
  FROM assets a
  JOIN buildings b ON b.id = a.registered_building_id
  JOIN rooms r ON r.id = a.registered_room_id
  WHERE a.public_code = p_public_code;
$$;

-- ============================================================================
-- Request / return (docs/06-asset-management.md #17-21)
-- ============================================================================

-- Self-service checkout: creates an ACTIVE assignment for the current user and
-- moves the asset to IN_USE at the requested usage location, atomically.
-- The FOR UPDATE row lock serializes concurrent requests for the same asset;
-- uniq_active_assignment_per_asset (0001) remains the final backstop.
-- Errors are raised with a stable token as the message, which the app maps to
-- HTTP responses (src/lib/data/assignments.ts).
CREATE OR REPLACE FUNCTION request_asset(
  p_public_code        text,
  p_usage_building_id  uuid,
  p_usage_room_id      uuid,
  p_expected_return_at timestamptz,
  p_notes              text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id       uuid := nullif(current_setting('app.current_user_id', true), '')::uuid;
  v_asset         assets%ROWTYPE;
  v_assignment_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM users WHERE id = v_user_id AND is_active) THEN
    RAISE EXCEPTION 'USER_INACTIVE';
  END IF;

  SELECT * INTO v_asset FROM assets WHERE public_code = p_public_code FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ASSET_NOT_FOUND';
  END IF;
  IF v_asset.status <> 'AVAILABLE' THEN
    RAISE EXCEPTION 'ASSET_NOT_AVAILABLE';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM rooms
    WHERE id = p_usage_room_id AND building_id = p_usage_building_id AND is_active
  ) THEN
    RAISE EXCEPTION 'ROOM_NOT_IN_BUILDING';
  END IF;

  INSERT INTO assignments (
    asset_id, asset_name_snapshot, asset_public_code_snapshot, user_id, status,
    usage_building_id, usage_room_id, expected_return_at, approved_at, notes, updated_at
  )
  VALUES (
    v_asset.id, v_asset.name, v_asset.public_code, v_user_id, 'ACTIVE',
    p_usage_building_id, p_usage_room_id, p_expected_return_at, now(), p_notes, now()
  )
  RETURNING id INTO v_assignment_id;

  UPDATE assets
  SET status = 'IN_USE',
      current_usage_building_id = p_usage_building_id,
      current_usage_room_id = p_usage_room_id,
      updated_at = now()
  WHERE id = v_asset.id;

  RETURN v_assignment_id;
END;
$$;

-- Ends an ACTIVE assignment. Allowed for the assignee or an ADMIN.
-- Usage location is always cleared; the asset only goes back to AVAILABLE if
-- it's still IN_USE — if it was reported for maintenance or lost while checked
-- out, returning must not silently put it back into circulation.
CREATE OR REPLACE FUNCTION return_assignment(p_assignment_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id    uuid := nullif(current_setting('app.current_user_id', true), '')::uuid;
  v_role       text := current_setting('app.current_user_role', true);
  v_assignment assignments%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT * INTO v_assignment FROM assignments WHERE id = p_assignment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ASSIGNMENT_NOT_FOUND';
  END IF;
  IF v_assignment.user_id <> v_user_id AND v_role IS DISTINCT FROM 'ADMIN' THEN
    RAISE EXCEPTION 'NOT_ALLOWED';
  END IF;
  IF v_assignment.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'ASSIGNMENT_NOT_ACTIVE';
  END IF;

  UPDATE assignments
  SET status = 'RETURNED', returned_at = now(), updated_at = now()
  WHERE id = p_assignment_id;

  UPDATE assets
  SET status = CASE WHEN status = 'IN_USE' THEN 'AVAILABLE'::asset_status ELSE status END,
      current_usage_building_id = NULL,
      current_usage_room_id = NULL,
      updated_at = now()
  WHERE id = v_assignment.asset_id;
END;
$$;

-- ============================================================================
-- Grants: functions are executable by PUBLIC by default — lock them down to
-- the application role only.
-- ============================================================================

REVOKE ALL ON FUNCTION app_login_user(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_public_asset(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION request_asset(text, uuid, uuid, timestamptz, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION return_assignment(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION app_login_user(text, text, text) TO app_user;
GRANT EXECUTE ON FUNCTION get_public_asset(text) TO app_user;
GRANT EXECUTE ON FUNCTION request_asset(text, uuid, uuid, timestamptz, text) TO app_user;
GRANT EXECUTE ON FUNCTION return_assignment(uuid) TO app_user;
