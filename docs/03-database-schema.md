# Database Schema & PostgreSQL Data Model
## Cloud-Based Campus Asset QR & Maintenance Management System

> **Status:** Implementation-ready PostgreSQL specification
> **Audience:** Claude Code / student development team
> **Database:** Azure Database for PostgreSQL Flexible Server (Burstable B1ms)
> **ORM:** Prisma
> **Important:** This is a real relational schema. Do not reintroduce Cosmos DB language (documents, containers, partition keys) anywhere in this project — tables, foreign keys and indexes are the whole story now.

---

# 1. Database Technology

Use:

**Azure Database for PostgreSQL Flexible Server**, accessed exclusively through **Prisma**.

Postgres is the single authoritative source of truth for all structured application data. The data model is designed around:

- Normalized tables with primary/foreign keys
- Indexes for the required query patterns
- Real ACID transactions for multi-table operations
- Row-Level Security policies (see `04-rls-security-policies.md`) as defense-in-depth beneath application-layer authorization
- Deliberate, targeted denormalization only where history must survive the deletion of a source row (see §16–18, §20)

---

# 2. Entity Overview

```text
users
buildings
rooms
assets
assignments
maintenance_requests
maintenance_history
attachments
audit_log
```

Nine tables. There is no separate "notification" table for the MVP (notifications were cut from scope — see `00-project-context.md`), and there is no separate document/container split — file metadata for both assets and maintenance requests lives in the single `attachments` table (§17).

---

# 3. Naming Convention

TypeScript/Prisma model fields use **camelCase** (`registeredBuildingId`, `publicCode`). Actual Postgres column names use **snake_case** (`registered_building_id`, `public_code`). Prisma's `@map` (per field) and `@@map` (per model) handle this translation automatically — declare the Prisma model in camelCase and map it to a snake_case table/column, e.g.:

```prisma
model Asset {
  id                   String   @id @default(uuid())
  publicCode           String   @unique @map("public_code")
  registeredBuildingId String   @map("registered_building_id")

  @@map("assets")
}
```

All SQL examples in this document use snake_case column names, matching what actually lands in Postgres. All example application code uses camelCase.

---

# 4. Common Columns

Every table has:

```text
id          uuid, primary key, default gen_random_uuid()
created_at  timestamptz, default now()
```

Every table except the append-only `audit_log` also has:

```text
updated_at  timestamptz, updated on write
```

Enable the extensions this schema depends on once, at the top of the initial migration:

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- trigram search on asset name
CREATE EXTENSION IF NOT EXISTS "pg_cron";   -- retention job, §20
```

---

# 5. users

Roles and identity for anyone who signs in. Public QR visitors are unauthenticated and never have a row here.

```sql
CREATE TYPE user_role AS ENUM ('ADMIN', 'TECHNICIAN', 'MEMBER');

CREATE TABLE users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entra_id    text UNIQUE NOT NULL,        -- Microsoft Entra ID object id
  full_name   text NOT NULL,
  email       text UNIQUE NOT NULL,
  role        user_role NOT NULL DEFAULT 'MEMBER',
  department  text,
  phone       text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
```

The Entra ID object id (`entra_id`) is the authoritative identity, resolved via Auth.js on every request. Do not store passwords — there are none.

## Roles

```text
ADMIN        Full access to every resource.
TECHNICIAN   Works maintenance requests assigned (or open) to them.
MEMBER       Everyone else who can sign in (students and staff). One role — the
             old STUDENT/STAFF split is gone because no document ever gave the
             two different permissions.
```

Deactivate a user by setting `is_active = false`. Users are never hard-deleted, which is why every foreign key that points at `users` below is `ON DELETE RESTRICT` — there is no deletion path to design for.

---

# 6. buildings

```sql
CREATE TABLE buildings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text UNIQUE NOT NULL,
  name        text NOT NULL,
  description text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
```

---

# 7. rooms

```sql
CREATE TABLE rooms (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES buildings(id) ON DELETE RESTRICT,
  code        text NOT NULL,
  name        text NOT NULL,
  floor       int,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (building_id, code)
);
```

A room belongs to exactly one building, enforced by the foreign key — no application-level "does this room belong to this building" check is needed for referential integrity, though the Route Handler should still validate it when a client submits a `(buildingId, roomId)` pair together (§ `11-server-side-logic-edge-functions.md`).

---

# 8. assets

```sql
CREATE TYPE asset_status AS ENUM (
  'AVAILABLE', 'IN_USE', 'IN_MAINTENANCE', 'DAMAGED', 'LOST', 'RETIRED'
);

CREATE TABLE assets (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_code                 text UNIQUE NOT NULL,   -- e.g. AST-2026-00142, see §9
  name                        text NOT NULL,
  category                    text NOT NULL,
  serial_number               text,
  department                  text,
  status                      asset_status NOT NULL DEFAULT 'AVAILABLE',

  registered_building_id      uuid NOT NULL REFERENCES buildings(id) ON DELETE RESTRICT,
  registered_room_id          uuid NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
  current_usage_building_id   uuid REFERENCES buildings(id) ON DELETE SET NULL,
  current_usage_room_id       uuid REFERENCES rooms(id) ON DELETE SET NULL,

  purchase_date               date,
  warranty_until               date,
  description                 text,
  created_by                  uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  retired_at                  timestamptz,            -- set when status → RETIRED, drives §20 retention

  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);
```

`registered_building_id`/`registered_room_id` is the asset's permanent home. `current_usage_building_id`/`current_usage_room_id` is where an active assignment is currently using it (nullable — null when there is no active assignment). These were split across two partition-key strategies under Cosmos DB (assets partitioned by `/buildingId`, assignments by `/assetId`), which made "asset + its assignment" impossible to write as one transaction. In Postgres they are just two nullable foreign keys on one row, updated inside the same transaction that writes the assignment — see §14 and `11-server-side-logic-edge-functions.md` §8.

---

# 9. Asset Identity

Exactly two identifiers, matching the product decision to drop the old third "Asset ID" concept:

## Internal id

`assets.id` — a `uuid`, the primary key. Never shown to users, never put in a URL. Used only for joins and internal references.

## Public code

`assets.public_code` — a stable, human-readable code such as:

```text
AST-2026-00142
```

Used everywhere a human or a QR code needs an identifier: the QR URL (`/asset/AST-2026-00142`), the UI, and free-text search. Never changes after issuance, including when the asset's registered building changes (that's a plain `registered_building_id` update now — no partition-key migration to design around).

### Concurrency-safe generation

Cosmos DB had no mechanism to hand out sequential human-readable codes without a race condition. Postgres does — use an atomic upsert-based counter function so concurrent requests never collide, and so the counter naturally resets per year:

```sql
CREATE TABLE id_counters (
  entity_type text NOT NULL,
  year        int  NOT NULL,
  last_value  int  NOT NULL DEFAULT 0,
  PRIMARY KEY (entity_type, year)
);

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
```

`INSERT ... ON CONFLICT DO UPDATE` takes a row lock, so two concurrent inserts always get distinct, gap-free-per-transaction values — no read-check-write race. Call it when creating a row:

```sql
INSERT INTO assets (public_code, name, category, ...)
VALUES (next_public_code('asset', 'AST', 5), 'Epson Projector P-104', 'Projector', ...);
```

The same function generates `maintenance_requests.request_number` (e.g. `MR-2026-0017`, width 4) — see §15. A plain `CREATE SEQUENCE` is an acceptable simpler alternative if a per-year reset is dropped as a requirement; this project keeps the per-year reset because the examples throughout the doc set assume it.

---

# 10. Asset Status

```text
AVAILABLE        Free to request.
IN_USE            Currently on an active assignment.
IN_MAINTENANCE    Undergoing repair. Not requestable.
DAMAGED           Reported broken, not yet triaged into maintenance. Not requestable.
LOST               Reported missing. Not requestable.
RETIRED           Terminal. Scrapped/disposed/decommissioned. Not requestable.
```

`DAMAGED`, `IN_MAINTENANCE` and `LOST` are never directly requestable — the only way out of any of them is through the maintenance workflow (§15–16), which resolves the asset to either `AVAILABLE` or `RETIRED`. `RETIRED` is the single terminal state; there is no separate `SCRAPPED` status.

Status transitions are validated by the Route Handler that owns each workflow, never accepted as an arbitrary client-submitted value (see `04-rls-security-policies.md` §13 and `11-server-side-logic-edge-functions.md`).

---

# 11. assignments

```sql
CREATE TYPE assignment_status AS ENUM ('PENDING', 'ACTIVE', 'RETURNED', 'REJECTED', 'CANCELLED');

CREATE TABLE assignments (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  asset_id                uuid REFERENCES assets(id) ON DELETE SET NULL,
  asset_name_snapshot        text NOT NULL,
  asset_public_code_snapshot text NOT NULL,

  user_id                 uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status                  assignment_status NOT NULL DEFAULT 'PENDING',

  usage_building_id       uuid REFERENCES buildings(id) ON DELETE SET NULL,
  usage_room_id           uuid REFERENCES rooms(id) ON DELETE SET NULL,

  requested_at            timestamptz NOT NULL DEFAULT now(),
  expected_return_at      timestamptz,           -- optional; drives "overdue" (docs/12)
  approved_at             timestamptz,
  approved_by             uuid REFERENCES users(id) ON DELETE RESTRICT,
  returned_at             timestamptz,

  notes                   text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- At most one ACTIVE assignment per asset, enforced by the database itself.
CREATE UNIQUE INDEX uniq_active_assignment_per_asset
  ON assignments (asset_id)
  WHERE status = 'ACTIVE';
```

**Design note — why `assignments` carries a snapshot too.** The retention rule (§20) hard-deletes an asset row 7 days after it retires. An assignment is part of that asset's usable history (who had it, when), so `asset_id` uses `ON DELETE SET NULL` rather than `RESTRICT`/`CASCADE`, and `asset_name_snapshot`/`asset_public_code_snapshot` are captured once at creation so the row stays readable ("Jane Doe used AST-2026-00142 (Epson Projector P-104) from ... to ...") after the source asset is gone. This mirrors the snapshot pattern the product decision mandated for `maintenance_history` and `audit_log` — applying it here too closes the same gap for the same reason.

The `uniq_active_assignment_per_asset` partial unique index is what actually resolves the old Cosmos-era "Active Assignment Rule" problem. Under Cosmos there was no database-level way to guarantee at most one active assignment per asset without ETags, transactional batches confined to a shared partition, or idempotency keys layered on top in the Function. In Postgres it's one line of DDL: a concurrent `INSERT` that would create a second `ACTIVE` row for the same asset simply fails the unique constraint, and the Route Handler turns that into an HTTP `409 Conflict`. See `11-server-side-logic-edge-functions.md` §8–9.

---

# 12. Usage Location vs. Registered Location

An assignment may set `usage_building_id`/`usage_room_id` — where the asset is being used temporarily. This must never silently overwrite `assets.registered_building_id`/`registered_room_id`; that only changes through an explicit admin "reassign registered location" action, which is a normal single-column `UPDATE` inside a transaction — not a special case. (Under Cosmos DB, changing an asset's partition key required deleting and recreating the document; that constraint doesn't exist here.)

When an assignment goes `ACTIVE`, the Route Handler transaction should also set `assets.current_usage_building_id`/`current_usage_room_id` to the assignment's usage location and `assets.status = 'IN_USE'`; on return, it clears both usage columns back to `NULL` and sets `status = 'AVAILABLE'`.

---

# 13. Assignment Integrity

**MVP decision: requests are self-service and auto-approved** — the assignment is `ACTIVE` immediately. `PENDING`/`REJECTED` stay in the enum for a future approval flow.

Creating an assignment, inside one Postgres transaction (implemented by the `request_asset()` function, `prisma/migrations/0002_*`):

1. Verify requesting user `is_active`.
2. Lock the asset row (`SELECT ... FOR UPDATE`) and verify `status = 'AVAILABLE'`.
3. Verify usage room belongs to usage building (FK-enforced, but validated as a pair for a clean error).
4. Insert the `assignments` row with `status = 'ACTIVE'` and the name/public-code snapshots.
5. Set `assets.status = 'IN_USE'` and the current-usage columns.
6. Write an `audit_log` entry (`ASSET_ASSIGNED`, from the app, same transaction).

Returning (`return_assignment()`) is allowed for the assignee or an ADMIN; it marks the assignment `RETURNED`, always clears the usage columns, and sets the asset back to `AVAILABLE` **only if it is still `IN_USE`** — an asset that went into maintenance or was reported lost while checked out must not silently return to circulation.

Why these live in `SECURITY DEFINER` functions rather than Prisma calls: a MEMBER must update the asset's status, but `assets` UPDATE is admin-only under RLS. See `04-rls-security-policies.md` §6a.

Because this is a real transaction, the steps either all commit or all roll back — there is no partial-write state to reconcile, and no idempotency-key scaffolding is required to make retries safe (a retried request either succeeds once or fails with "not available").

---

# 14. maintenance_requests

```sql
CREATE TYPE maintenance_status AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED');
CREATE TYPE maintenance_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

CREATE TABLE maintenance_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number   text UNIQUE NOT NULL,   -- e.g. MR-2026-0017, via next_public_code('maintenance_request', 'MR', 4)

  asset_id         uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  reported_by      uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assigned_to      uuid REFERENCES users(id) ON DELETE RESTRICT,

  status           maintenance_status NOT NULL DEFAULT 'OPEN',
  priority         maintenance_priority NOT NULL DEFAULT 'MEDIUM',
  description      text NOT NULL,
  resolution_notes text,

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  resolved_at      timestamptz
);
```

`status` has exactly five values — `OPEN, ASSIGNED, IN_PROGRESS, RESOLVED, CANCELLED`. There is no `WAITING` or `CLOSED`.

**Design note — why `maintenance_requests.asset_id` is `ON DELETE CASCADE`, not `SET NULL`.** This table is live workflow state, not the durable historical record — that's `maintenance_history` (§15), which snapshots every request into an append-only, readable-forever row *at the moment of each action*. By the time an asset reaches `RETIRED` its maintenance requests are already `RESOLVED`/`CANCELLED`, and their meaningful content has already been captured in `maintenance_history`. Cascading the now-inert workflow row away when the asset is purged keeps the schema simple without losing anything — the readable trail lives in `maintenance_history`, not here.

---

# 15. maintenance_history

Append-only. One row per meaningful action taken against a maintenance request.

```sql
CREATE TABLE maintenance_history (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  maintenance_request_id      uuid REFERENCES maintenance_requests(id) ON DELETE SET NULL,
  request_number_snapshot     text NOT NULL,

  asset_id                    uuid REFERENCES assets(id) ON DELETE SET NULL,
  asset_name_snapshot         text NOT NULL,
  asset_public_code_snapshot  text NOT NULL,

  action                      text NOT NULL,   -- CREATED | ASSIGNED | STATUS_CHANGED | RESOLVED | CANCELLED | NOTE_ADDED
  actor_id                    uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  notes                       text,

  created_at                  timestamptz NOT NULL DEFAULT now()
);
```

Both `maintenance_request_id` and `asset_id` are `ON DELETE SET NULL` — never `CASCADE`. This is deliberate: `maintenance_requests` rows cascade away when their asset is purged (§14), and the asset row itself is purged by the retention job (§20), but `maintenance_history` must outlive both, because it is the audit trail the Definition of Done in `00-project-context.md` and `13-audit-logging.md` require. `asset_name_snapshot`/`asset_public_code_snapshot`/`request_number_snapshot` are captured at write time precisely so the row reads cleanly ("MR-2026-0017 on AST-2026-00142 (Epson Projector P-104) was resolved by ...") after both parents are gone. Never update or delete a `maintenance_history` row once written.

---

# 16. attachments

A single generic table replaces the old three-container file-metadata design (`asset-images`, `maintenance-images`, `maintenance-documents`). Binary content lives in Azure Blob Storage; this table stores its metadata and links it to exactly one owning entity.

```sql
CREATE TABLE attachments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  blob_container        text NOT NULL,
  blob_name             text NOT NULL,   -- uuid-based, e.g. gen_random_uuid()::text + extension
  original_filename     text NOT NULL,
  mime_type             text NOT NULL,
  file_size_bytes       bigint NOT NULL,

  uploaded_by           uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  is_public             boolean NOT NULL DEFAULT false,

  asset_id              uuid REFERENCES assets(id) ON DELETE CASCADE,
  maintenance_request_id uuid REFERENCES maintenance_requests(id) ON DELETE CASCADE,

  created_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT attachments_exactly_one_owner CHECK (
    (asset_id IS NOT NULL)::int + (maintenance_request_id IS NOT NULL)::int = 1
  )
);
```

Exactly one of `asset_id`/`maintenance_request_id` must be set, enforced by the check constraint above. `is_public = true` is what the public QR asset page is allowed to serve (a photo of the asset, typically); everything else requires an authenticated, authorized request and a short-lived Blob URL (`04-rls-security-policies.md` §10, `11-server-side-logic-edge-functions.md` §14). `blob_container + blob_name` is the canonical file identity — never store a temporary SAS URL as if it were permanent.

---

# 17. audit_log

Append-only. Admin-read-only. No `UPDATE` or `DELETE` for any role.

```sql
CREATE TABLE audit_log (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  entity_type                 text NOT NULL,   -- 'asset' | 'assignment' | 'maintenance_request' | 'user' | ...
  entity_id                   uuid NOT NULL,
  entity_name_snapshot        text,
  entity_public_code_snapshot text,

  action                      text NOT NULL,   -- see §18
  actor_id                    uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_name_snapshot         text NOT NULL,   -- 'System' for pg_cron-initiated events

  metadata                    jsonb,
  created_at                  timestamptz NOT NULL DEFAULT now()
);
```

**Design note — `entity_id` is intentionally not a foreign key.** `audit_log` is polymorphic across every entity type in the system (an asset, an assignment, a maintenance request, a user...), so it cannot reference one single parent table. Its readability after a source row is deleted therefore comes entirely from `entity_name_snapshot`/`entity_public_code_snapshot`, captured at write time — not from referential integrity. This is what makes the retention rule (§20) safe: purging an `assets` row never needs to touch `audit_log` at all, because `audit_log` never depended on that row still existing.

`actor_id` is nullable and `ON DELETE SET NULL` to allow a system-initiated event (the retention job itself, §20) to write an audit entry with no human actor; `actor_name_snapshot` is set to `'System'` in that case.

Multi-table operations (e.g. resolving a maintenance request → writing `maintenance_history` → updating `assets.status` → writing `audit_log`) are one real Postgres transaction. Under Cosmos DB this was described as a "transaction" spanning three separate containers, which Cosmos cannot actually do atomically — that was a genuine error in the earlier draft. In Postgres it is a single `prisma.$transaction([...])` (or a `BEGIN`/`COMMIT` block), which is exactly what ACID transactions are for. See `13-audit-logging.md` for the full write-up.

---

# 18. Required Audit Events

At minimum:

```text
ASSET_CREATED
ASSET_UPDATED
ASSET_REGISTERED_LOCATION_CHANGED
ASSET_ASSIGNED
ASSET_RETURNED
ASSET_STATUS_CHANGED
ASSET_RETIRED
ASSET_PURGED                    -- written by the pg_cron retention job, actor_id = NULL, §20

MAINTENANCE_CREATED
MAINTENANCE_ASSIGNED
MAINTENANCE_STATUS_CHANGED
MAINTENANCE_RESOLVED

ATTACHMENT_UPLOADED
ATTACHMENT_DELETED

USER_ROLE_CHANGED
USER_ACTIVATED
USER_DEACTIVATED
```

The actor for every event other than `ASSET_PURGED` must come from the validated Entra ID identity resolved server-side — never a client-supplied `actorId`.

---

# 19. Retention Rule

Once `assets.status` transitions to `RETIRED`, the Route Handler that performs the transition sets `assets.retired_at = now()` in the same transaction. A daily `pg_cron` job then hard-deletes any asset row whose `retired_at` is more than 7 days in the past.

This is safe specifically because of the FK design above: `assignments.asset_id`, `maintenance_history.asset_id`/`maintenance_request_id`, and `audit_log`'s (non-FK) `entity_id` are all designed to survive the parent row's deletion, each backed by a denormalized snapshot column, so the delete never needs `CASCADE` into history and never orphans the audit trail. `maintenance_requests` does cascade (§14), which is fine because its content has already been captured in `maintenance_history` by the time the asset retires.

```sql
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
$$ LANGUAGE plpgsql;

-- Requires the pg_cron extension (allow-listed on Azure Database for PostgreSQL Flexible Server).
SELECT cron.schedule(
  'purge-retired-assets',
  '0 3 * * *',                          -- daily at 03:00 UTC
  $$SELECT purge_retired_assets();$$
);
```

The public QR page (`/asset/<publicCode>`) must return a friendly "this asset is no longer in service" response for a code that no longer resolves, rather than a raw `404` — reasonable both during the 7-day retention window (asset is `RETIRED` but still present) and after (row is gone; the `publicCode` simply no longer matches anything). See `04-rls-security-policies.md` §5 and `11-server-side-logic-edge-functions.md` §7.

---

# 20. Required Query Patterns

```text
asset by public_code
asset by name (free-text, partial match)
assets by status
assets by category
assets by registered building
assets by registered room
assets by serial number
active assignment by asset
assignments by user
maintenance requests by asset
maintenance requests by assignee
maintenance requests by status
maintenance history by maintenance request
audit log by entity (type + id)
audit log by actor
```

Free-text asset name search was never designed under the old Cosmos query-pattern list. In Postgres it's a normal indexed query — see §21.

---

# 21. Indexes

```sql
-- asset by public_code: UNIQUE constraint already indexes this.

-- asset by name (ILIKE / partial match)
CREATE INDEX idx_assets_name_trgm ON assets USING gin (name gin_trgm_ops);

-- common asset filters
CREATE INDEX idx_assets_status ON assets (status);
CREATE INDEX idx_assets_category ON assets (category);
CREATE INDEX idx_assets_registered_building ON assets (registered_building_id);
CREATE INDEX idx_assets_registered_room ON assets (registered_room_id);
CREATE INDEX idx_assets_serial_number ON assets (serial_number);

-- assignments
CREATE INDEX idx_assignments_user ON assignments (user_id);
CREATE INDEX idx_assignments_asset ON assignments (asset_id);
-- uniq_active_assignment_per_asset already covers "active assignment by asset" (§11)

-- maintenance
CREATE INDEX idx_maintenance_requests_asset ON maintenance_requests (asset_id);
CREATE INDEX idx_maintenance_requests_assigned_to ON maintenance_requests (assigned_to);
CREATE INDEX idx_maintenance_requests_status ON maintenance_requests (status);
CREATE INDEX idx_maintenance_history_request ON maintenance_history (maintenance_request_id);

-- audit
CREATE INDEX idx_audit_log_entity ON audit_log (entity_type, entity_id);
CREATE INDEX idx_audit_log_actor ON audit_log (actor_id);
CREATE INDEX idx_audit_log_created_at ON audit_log (created_at);
```

Free-text asset name search uses `pg_trgm` so `WHERE name ILIKE '%projector%'` (or `similarity(name, 'projector')`) can hit the GIN index instead of a sequential scan. A full-text (`tsvector`/`to_tsquery`) index is a reasonable alternative if search needs to expand beyond simple substring matching later; trigram search is sufficient for the MVP's asset-name search box.

---

# 22. Seed Data

```text
Buildings:  Vyas, Vivekananda
Rooms:      VY001, VY101, VK301, VK404
Categories: Projector, Laptop, Desktop, Camera, Oscilloscope,
            Networking Equipment, Other
```

Seed via a Prisma seed script (`prisma/seed.ts`) using `upsert` on the natural unique key (`code` for buildings, `(buildingId, code)` for rooms) so re-running it is idempotent.

---

# 23. Data Access Boundary

The frontend never connects to Postgres directly and never sees a database connection string.

```text
Browser
   ↓
Next.js Route Handler
   ↓
Prisma Client (server-side only)
   ↓
Azure Database for PostgreSQL
```

Keep Prisma access in a dedicated server-side data-access/service layer, not scattered across route handlers — see `11-server-side-logic-edge-functions.md` §19.

---

# 24. Public Asset Page

The public API queries by `public_code` and returns only safe fields:

```json
{
  "publicCode": "AST-2026-00142",
  "name": "Epson Projector P-104",
  "category": "Projector",
  "registeredLocation": "Vyas / VY001",
  "status": "AVAILABLE"
}
```

Never return: `createdBy`, internal `id`, any user IDs, maintenance notes, audit records, private attachment metadata, or any other internal field — unless explicitly required and safe. If `public_code` doesn't resolve to any row (retired-and-purged, §19), return the "no longer in service" response, not the full record.

---

# 25. Postgres/Prisma Implementation Rules for Claude Code

Claude Code must:

1. Use Prisma Client, generated from `prisma/schema.prisma`, as the only application-level database access path.
2. Keep all Prisma access in a dedicated server-side data-access/service layer — never import Prisma Client into client components.
3. Never expose `DATABASE_URL` or any Postgres credential to browser code.
4. Use Prisma migrations (`prisma migrate`) for every schema change — no ad hoc `ALTER TABLE` outside a migration file.
5. Wrap every multi-table write in `prisma.$transaction(...)`.
6. Use the `uniq_active_assignment_per_asset` constraint (and similar DB-level constraints) as the source of truth for concurrency-sensitive invariants — do not reimplement them as read-check-write application logic.
7. Set the RLS session variables (`04-rls-security-policies.md`) at the start of every authenticated transaction.
8. Avoid N+1 query patterns — use Prisma `include`/`select` deliberately.
9. Avoid unbounded `findMany()` calls — paginate list endpoints.
10. Preserve historical records: never `UPDATE` or `DELETE` a `maintenance_history` or `audit_log` row from application code.

---

# 26. Definition of Done

The database layer is complete when:

- All nine tables exist with the foreign keys, enums and constraints above.
- `next_public_code()` reliably generates unique, concurrency-safe `publicCode`/`requestNumber` values under concurrent load.
- Asset registered location and current usage location remain separate columns.
- At most one `ACTIVE` assignment per asset is enforced at the database level.
- `maintenance_history` and `audit_log` are append-only and remain readable after their source asset is purged.
- The `pg_cron` retention job runs daily and correctly purges assets 7 days after `retired_at`, writing an `ASSET_PURGED` audit entry first.
- Required indexes exist for every query pattern in §20.
- Public QR reads return only safe fields, and handle a purged/unknown `publicCode` gracefully.
- No Cosmos DB / container / partition-key dependency remains anywhere in the codebase or docs.
- All data access goes through Prisma from server-side Route Handlers only.

---

# Claude Code Execution Boundary

Claude Code implements application code and local project files. Azure resource creation, Azure Portal configuration, secrets, GitHub repository operations, commits/pushes, and deployment are performed by the human developer. Claude Code may provide exact manual instructions and configuration templates, but must not execute or claim completion of those operations.
