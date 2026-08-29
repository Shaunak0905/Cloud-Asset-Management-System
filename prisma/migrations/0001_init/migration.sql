-- Initial schema for the Cloud Asset Management System.
--
-- This migration was authored by hand (not via `prisma migrate dev`) because no
-- live Postgres instance was available at scaffold time (Azure Database for
-- PostgreSQL is provisioned by the human developer, per docs/15-deployment-and-environment.md).
-- The CREATE TABLE / CREATE TYPE / AddForeignKey blocks below were generated
-- directly from prisma/schema.prisma via
-- `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`
-- (which needs no database connection) and are therefore guaranteed to match the
-- schema exactly. Everything from "-- Extensions" onward is hand-written to cover
-- what Prisma's schema language cannot express: extensions, the concurrency-safe
-- ID counter function, the partial unique index, the attachments CHECK constraint,
-- search/filter indexes, Row-Level Security, and the retention job.
--
-- Run with: npx prisma migrate deploy   (see docs/03-database-schema.md, docs/04-rls-security-policies.md)

-- ============================================================================
-- Extensions (docs/03-database-schema.md #4)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- trigram search on asset name
CREATE EXTENSION IF NOT EXISTS "pg_cron";   -- retention job, see bottom of this file
                                             -- (must be allow-listed as a shared_preload_library
                                             -- on Azure Database for PostgreSQL Flexible Server
                                             -- by the human developer before this succeeds)

-- ============================================================================
-- Schema, enums, tables, indexes, foreign keys
-- Generated from prisma/schema.prisma via `prisma migrate diff --from-empty`.
-- ============================================================================

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('ADMIN', 'TECHNICIAN', 'MEMBER');

-- CreateEnum
CREATE TYPE "asset_status" AS ENUM ('AVAILABLE', 'IN_USE', 'IN_MAINTENANCE', 'DAMAGED', 'LOST', 'RETIRED');

-- CreateEnum
CREATE TYPE "assignment_status" AS ENUM ('PENDING', 'ACTIVE', 'RETURNED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "maintenance_status" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "maintenance_priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entra_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "user_role" NOT NULL DEFAULT 'MEMBER',
    "department" TEXT,
    "phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buildings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "buildings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "building_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "floor" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "public_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "serial_number" TEXT,
    "department" TEXT,
    "status" "asset_status" NOT NULL DEFAULT 'AVAILABLE',
    "registered_building_id" UUID NOT NULL,
    "registered_room_id" UUID NOT NULL,
    "current_usage_building_id" UUID,
    "current_usage_room_id" UUID,
    "purchase_date" DATE,
    "warranty_until" DATE,
    "description" TEXT,
    "created_by" UUID NOT NULL,
    "retired_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "asset_id" UUID,
    "asset_name_snapshot" TEXT NOT NULL,
    "asset_public_code_snapshot" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "assignment_status" NOT NULL DEFAULT 'PENDING',
    "usage_building_id" UUID,
    "usage_room_id" UUID,
    "requested_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMPTZ,
    "approved_by" UUID,
    "returned_at" TIMESTAMPTZ,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "request_number" TEXT NOT NULL,
    "asset_id" UUID NOT NULL,
    "reported_by" UUID NOT NULL,
    "assigned_to" UUID,
    "status" "maintenance_status" NOT NULL DEFAULT 'OPEN',
    "priority" "maintenance_priority" NOT NULL DEFAULT 'MEDIUM',
    "description" TEXT NOT NULL,
    "resolution_notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "resolved_at" TIMESTAMPTZ,

    CONSTRAINT "maintenance_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "maintenance_request_id" UUID,
    "request_number_snapshot" TEXT NOT NULL,
    "asset_id" UUID,
    "asset_name_snapshot" TEXT NOT NULL,
    "asset_public_code_snapshot" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor_id" UUID NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "blob_container" TEXT NOT NULL,
    "blob_name" TEXT NOT NULL,
    "original_filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size_bytes" BIGINT NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "asset_id" UUID,
    "maintenance_request_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "entity_name_snapshot" TEXT,
    "entity_public_code_snapshot" TEXT,
    "action" TEXT NOT NULL,
    "actor_id" UUID,
    "actor_name_snapshot" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "id_counters" (
    "entity_type" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "last_value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "id_counters_pkey" PRIMARY KEY ("entity_type","year")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_entra_id_key" ON "users"("entra_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "buildings_code_key" ON "buildings"("code");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_building_id_code_key" ON "rooms"("building_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "assets_public_code_key" ON "assets"("public_code");

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_requests_request_number_key" ON "maintenance_requests"("request_number");

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_registered_building_id_fkey" FOREIGN KEY ("registered_building_id") REFERENCES "buildings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_registered_room_id_fkey" FOREIGN KEY ("registered_room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_current_usage_building_id_fkey" FOREIGN KEY ("current_usage_building_id") REFERENCES "buildings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_current_usage_room_id_fkey" FOREIGN KEY ("current_usage_room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_usage_building_id_fkey" FOREIGN KEY ("usage_building_id") REFERENCES "buildings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_usage_room_id_fkey" FOREIGN KEY ("usage_room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_history" ADD CONSTRAINT "maintenance_history_maintenance_request_id_fkey" FOREIGN KEY ("maintenance_request_id") REFERENCES "maintenance_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_history" ADD CONSTRAINT "maintenance_history_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_history" ADD CONSTRAINT "maintenance_history_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_maintenance_request_id_fkey" FOREIGN KEY ("maintenance_request_id") REFERENCES "maintenance_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- Hand-written additions Prisma's schema language cannot express
-- (docs/03-database-schema.md #9, #11, #16, #20, #21)
-- ============================================================================

-- Concurrency-safe, per-year-reset counter for assets.public_code / maintenance_requests.request_number.
-- See docs/03-database-schema.md #9.
CREATE OR REPLACE FUNCTION next_public_code(p_entity_type text, p_prefix text, p_width int)
RETURNS text AS $$
DECLARE
  v_year int := EXTRACT(YEAR FROM now())::int;
  v_next int;
BEGIN
  INSERT INTO id_counters (entity_type, year, last_value)
  VALUES (p_entity_type, v_year, 1)
  ON CONFLICT (entity_type, year)
  DO UPDATE SET last_value = id_counters.last_value + 1
  RETURNING last_value INTO v_next;

  RETURN p_prefix || '-' || v_year || '-' || lpad(v_next::text, p_width, '0');
END;
$$ LANGUAGE plpgsql;

-- At most one ACTIVE assignment per asset, enforced by the database itself.
-- See docs/03-database-schema.md #11.
CREATE UNIQUE INDEX "uniq_active_assignment_per_asset"
  ON "assignments" ("asset_id")
  WHERE "status" = 'ACTIVE';

-- Exactly one of asset_id / maintenance_request_id must be set on an attachment.
-- See docs/03-database-schema.md #16.
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_exactly_one_owner" CHECK (
  ("asset_id" IS NOT NULL)::int + ("maintenance_request_id" IS NOT NULL)::int = 1
);

-- Free-text asset name search (docs/03-database-schema.md #20-21).
CREATE INDEX "idx_assets_name_trgm" ON "assets" USING gin ("name" gin_trgm_ops);

-- Common asset filters.
CREATE INDEX "idx_assets_status" ON "assets" ("status");
CREATE INDEX "idx_assets_category" ON "assets" ("category");
CREATE INDEX "idx_assets_registered_building" ON "assets" ("registered_building_id");
CREATE INDEX "idx_assets_registered_room" ON "assets" ("registered_room_id");
CREATE INDEX "idx_assets_serial_number" ON "assets" ("serial_number");

-- Assignments.
CREATE INDEX "idx_assignments_user" ON "assignments" ("user_id");
CREATE INDEX "idx_assignments_asset" ON "assignments" ("asset_id");

-- Maintenance.
CREATE INDEX "idx_maintenance_requests_asset" ON "maintenance_requests" ("asset_id");
CREATE INDEX "idx_maintenance_requests_assigned_to" ON "maintenance_requests" ("assigned_to");
CREATE INDEX "idx_maintenance_requests_status" ON "maintenance_requests" ("status");
CREATE INDEX "idx_maintenance_history_request" ON "maintenance_history" ("maintenance_request_id");

-- Audit.
CREATE INDEX "idx_audit_log_entity" ON "audit_log" ("entity_type", "entity_id");
CREATE INDEX "idx_audit_log_actor" ON "audit_log" ("actor_id");
CREATE INDEX "idx_audit_log_created_at" ON "audit_log" ("created_at");

-- ============================================================================
-- Row-Level Security (docs/04-rls-security-policies.md)
-- ============================================================================

-- The application connects as a dedicated, non-superuser role so RLS actually
-- applies (superusers and table owners bypass RLS by default). The human
-- developer sets this role's password on the real Azure Postgres instance and
-- puts it in DATABASE_URL (docs/04-rls-security-policies.md #6, .env.example).
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user WITH LOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT EXECUTE ON FUNCTION next_public_code(text, text, int) TO app_user;

-- users
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select_own_or_admin ON "users"
  FOR SELECT
  USING (
    id::text = current_setting('app.current_user_id', true)
    OR current_setting('app.current_user_role', true) = 'ADMIN'
  );

CREATE POLICY users_update_admin_only ON "users"
  FOR UPDATE
  USING (current_setting('app.current_user_role', true) = 'ADMIN');

-- buildings / rooms
ALTER TABLE "buildings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rooms" ENABLE ROW LEVEL SECURITY;

CREATE POLICY buildings_select_authenticated ON "buildings"
  FOR SELECT
  USING (current_setting('app.current_user_role', true) IS NOT NULL);

CREATE POLICY buildings_write_admin_only ON "buildings"
  FOR ALL
  USING (current_setting('app.current_user_role', true) = 'ADMIN')
  WITH CHECK (current_setting('app.current_user_role', true) = 'ADMIN');

CREATE POLICY rooms_select_authenticated ON "rooms"
  FOR SELECT
  USING (current_setting('app.current_user_role', true) IS NOT NULL);

CREATE POLICY rooms_write_admin_only ON "rooms"
  FOR ALL
  USING (current_setting('app.current_user_role', true) = 'ADMIN')
  WITH CHECK (current_setting('app.current_user_role', true) = 'ADMIN');

-- assets
ALTER TABLE "assets" ENABLE ROW LEVEL SECURITY;

CREATE POLICY assets_select_authenticated ON "assets"
  FOR SELECT
  USING (current_setting('app.current_user_role', true) IS NOT NULL);

CREATE POLICY assets_insert_admin_only ON "assets"
  FOR INSERT WITH CHECK (current_setting('app.current_user_role', true) = 'ADMIN');

CREATE POLICY assets_update_admin_only ON "assets"
  FOR UPDATE
  USING (current_setting('app.current_user_role', true) = 'ADMIN')
  WITH CHECK (current_setting('app.current_user_role', true) = 'ADMIN');

-- assignments
ALTER TABLE "assignments" ENABLE ROW LEVEL SECURITY;

CREATE POLICY assignments_select_own_or_admin ON "assignments"
  FOR SELECT
  USING (
    user_id::text = current_setting('app.current_user_id', true)
    OR current_setting('app.current_user_role', true) = 'ADMIN'
  );

CREATE POLICY assignments_insert_own ON "assignments"
  FOR INSERT
  WITH CHECK (
    user_id::text = current_setting('app.current_user_id', true)
    OR current_setting('app.current_user_role', true) = 'ADMIN'
  );

CREATE POLICY assignments_update_own_or_admin ON "assignments"
  FOR UPDATE
  USING (
    user_id::text = current_setting('app.current_user_id', true)
    OR current_setting('app.current_user_role', true) = 'ADMIN'
  );

-- maintenance_requests
ALTER TABLE "maintenance_requests" ENABLE ROW LEVEL SECURITY;

CREATE POLICY maintenance_requests_select ON "maintenance_requests"
  FOR SELECT
  USING (
    reported_by::text = current_setting('app.current_user_id', true)
    OR assigned_to::text = current_setting('app.current_user_id', true)
    OR (
      current_setting('app.current_user_role', true) = 'TECHNICIAN'
      AND status = 'OPEN'
    )
    OR current_setting('app.current_user_role', true) = 'ADMIN'
  );

CREATE POLICY maintenance_requests_insert_own ON "maintenance_requests"
  FOR INSERT
  WITH CHECK (reported_by::text = current_setting('app.current_user_id', true));

CREATE POLICY maintenance_requests_update ON "maintenance_requests"
  FOR UPDATE
  USING (
    assigned_to::text = current_setting('app.current_user_id', true)
    OR current_setting('app.current_user_role', true) = 'ADMIN'
  );

-- maintenance_history (append-only: no UPDATE/DELETE policy for any role)
ALTER TABLE "maintenance_history" ENABLE ROW LEVEL SECURITY;

CREATE POLICY maintenance_history_select_authenticated ON "maintenance_history"
  FOR SELECT
  USING (current_setting('app.current_user_role', true) IS NOT NULL);

CREATE POLICY maintenance_history_insert_authenticated ON "maintenance_history"
  FOR INSERT
  WITH CHECK (actor_id::text = current_setting('app.current_user_id', true));

-- attachments
ALTER TABLE "attachments" ENABLE ROW LEVEL SECURITY;

CREATE POLICY attachments_select_authenticated ON "attachments"
  FOR SELECT
  USING (
    is_public = true
    OR current_setting('app.current_user_role', true) IS NOT NULL
  );

CREATE POLICY attachments_insert_authenticated ON "attachments"
  FOR INSERT
  WITH CHECK (uploaded_by::text = current_setting('app.current_user_id', true));

-- audit_log (append-only, admin-read-only: no UPDATE/DELETE policy for any role)
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_log_select_admin_only ON "audit_log"
  FOR SELECT
  USING (current_setting('app.current_user_role', true) = 'ADMIN');

CREATE POLICY audit_log_insert_authenticated ON "audit_log"
  FOR INSERT
  WITH CHECK (current_setting('app.current_user_role', true) IS NOT NULL OR actor_id IS NULL);

-- ============================================================================
-- Retention job (docs/03-database-schema.md #19)
-- ============================================================================

CREATE OR REPLACE FUNCTION purge_retired_assets() RETURNS void AS $$
DECLARE
  v_asset record;
BEGIN
  FOR v_asset IN
    SELECT id, name, public_code
    FROM assets
    WHERE status = 'RETIRED'
      AND retired_at IS NOT NULL
      AND retired_at <= now() - interval '7 days'
  LOOP
    INSERT INTO audit_log (entity_type, entity_id, entity_name_snapshot, entity_public_code_snapshot,
                            action, actor_id, actor_name_snapshot, metadata)
    VALUES ('asset', v_asset.id, v_asset.name, v_asset.public_code,
            'ASSET_PURGED', NULL, 'System', jsonb_build_object('reason', 'retention_period_elapsed'));

    DELETE FROM assets WHERE id = v_asset.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Requires the pg_cron extension (allow-listed on Azure Database for PostgreSQL Flexible Server).
SELECT cron.schedule(
  'purge-retired-assets',
  '0 3 * * *',                          -- daily at 03:00 UTC
  $$SELECT purge_retired_assets();$$
);
