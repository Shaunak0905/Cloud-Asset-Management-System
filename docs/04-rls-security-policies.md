# Security & Row-Level Security Policies
## Cloud-Based Campus Asset QR & Maintenance Management System

> **Status:** Implementation-ready Postgres Row-Level Security specification
> **Audience:** Claude Code / student development team
> **Security boundary:** Route Handler authorization (primary) + Postgres Row-Level Security (defense-in-depth) + Microsoft Entra ID + Blob Storage access controls

---

# 1. Security Model

This is a genuine two-layer model — both layers are real, and neither is optional:

```text
Browser
   ↓
Azure Static Web Apps
   ↓
Microsoft Entra ID (Auth.js)
   ↓
Route Handler
   ↓
Authentication validation
   ↓
Application authorization        ← Layer 1, primary
   ↓
Prisma → PostgreSQL (RLS enforced)  ← Layer 2, defense-in-depth
   ↓
Blob Storage access controls
```

**The Route Handler is the primary, first authorization boundary.** Every protected handler must independently verify who the caller is and what they're allowed to do, exactly as if RLS didn't exist. **Postgres Row-Level Security is a second, database-native layer beneath that** — it exists so that a bug in a Route Handler's authorization logic, a missed check on a new endpoint, or a query issued from a code path nobody thought to review still cannot read or write rows the authenticated session shouldn't touch. Neither layer is a substitute for the other.

Frontend role checks are UX only and provide no security guarantee whatsoever.

---

# 2. Roles

Application roles:

```text
ADMIN
TECHNICIAN
MEMBER
```

Three roles. The old `STUDENT`/`STAFF` split is gone — every permission table in the doc set gave them identical access, so they're merged into one `MEMBER` role. Public users are unauthenticated and have no `users` row.

Role is stored in `users.role` (`03-database-schema.md` §5).

---

# 3. Authentication vs Authorization

Authentication answers:

> Who is this user?

Microsoft Entra ID, via Auth.js, answers this.

Authorization answers:

> What may this user do?

Both the Route Handler and Postgres RLS answer this, using:

```text
validated Entra ID identity
+
users row (is_active, role)
+
resource ownership/state
```

Never trust:

- Client-side role values
- Hidden form fields
- URL parameters
- Arbitrary `userId` values
- Client-provided audit actor IDs

---

# 4. Route Handler Authorization Requirement (Layer 1)

Every protected Route Handler must:

1. Validate the Entra ID session (Auth.js).
2. Extract the authenticated user id.
3. Load the `users` row.
4. Verify `is_active`.
5. Verify the required role.
6. Validate request input.
7. Verify resource-level permissions (ownership/assignment, not just role).
8. Perform the operation inside a transaction that also sets the RLS session variables (§6).
9. Write an `audit_log` entry when required.

Do not rely on RLS alone to catch an authorization bug — RLS is the safety net, not the primary check.

---

# 5. Public Asset Access

The public QR page may retrieve only safe fields, via a dedicated, unauthenticated-safe query path:

```text
publicCode
name
category
registered location
status
```

```text
GET /api/public/assets/:publicCode
```

The public Route Handler must not return the complete database row. If `publicCode` doesn't resolve (asset retired and purged, `03-database-schema.md` §19), it returns a "this asset is no longer in service" response, not a raw `404`.

---

# 6. Postgres Row-Level Security — Mechanism

RLS is enabled per table. Policies read the authenticated user's id and role from **Postgres session-local settings**, which Prisma sets at the start of every authenticated transaction — never from a value the query itself supplies.

## Prisma wrapper pattern

Every authenticated request runs its database work inside a transaction that first sets:

```sql
SET LOCAL app.current_user_id = '<uuid>';
SET LOCAL app.current_user_role = '<ADMIN|TECHNICIAN|MEMBER>';
```

Concretely, in the shared data-access layer:

```ts
async function withRlsContext<T>(userId: string, role: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_user_id = '${userId}'`);
    await tx.$executeRawUnsafe(`SET LOCAL app.current_user_role = '${role}'`);
    return fn(tx);
  });
}
```

(`userId`/`role` come from the already-validated server-side session — never from request input — so this is not a SQL-injection surface in the way it would be if either value were client-supplied.)

`SET LOCAL` scopes the setting to the current transaction only, so it can never leak between requests on a pooled connection.

## Enabling RLS and referencing the session variables

```sql
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY assets_select_all_authenticated ON assets
  FOR SELECT
  USING (current_setting('app.current_user_role', true) IS NOT NULL);
```

`current_setting('app.current_user_id', true)` and `current_setting('app.current_user_role', true)` (the `true` second argument makes an unset setting return `NULL` instead of erroring) are how every policy below reads the authenticated context.

**Important:** the application's own Prisma connection must use a Postgres role that is itself subject to RLS (i.e., not a superuser and not `BYPASSRLS`) — Postgres superusers and table owners bypass RLS by default. Create a dedicated `app_user` Postgres role for Prisma's connection with `NOSUPERUSER` and without `BYPASSRLS`.

This means **two connection strings** (`.env.example`):

- `DATABASE_URL` — the running app, as `app_user`. Every query, reads included, must run inside `withRlsContext()`; a query with no identity set matches no policy and returns nothing.
- `DIRECT_DATABASE_URL` — the server admin/table owner. Used only by Prisma Migrate (`directUrl` in `schema.prisma`) and the seed script, since migrations create tables, roles, and the functions below.

# 6a. SECURITY DEFINER Functions

A few operations can't be expressed as ordinary RLS policies. Each is a narrow `SECURITY DEFINER` function (runs as its owner, the table owner, so RLS doesn't filter it), defined in `prisma/migrations/0002_*`:

| Function | Why it can't be a plain policy |
|---|---|
| `app_login_user(entra_id, name, email)` | First-login provisioning happens before any RLS identity exists, and `users` deliberately has no INSERT policy. Only ever creates `MEMBER` rows; never changes an existing role. |
| `get_public_asset(public_code)` | Anonymous visitor; must return only the safe columns (RLS can't restrict columns). |
| `request_asset(...)` / `return_assignment(id)` | A MEMBER must change the asset's status and usage location, but `assets` UPDATE is admin-only. |

Rules every such function follows:

1. It does exactly one thing and enforces its own invariants (e.g. `request_asset` locks the asset row and rejects anything not `AVAILABLE`).
2. It takes the caller's identity from `current_setting('app.current_user_id')` — **never from an argument** — so it can't be used to act as someone else.
3. `SET search_path = public` pins name resolution, so it can't be hijacked by objects in a caller-controlled schema.
4. `EXECUTE` is revoked from `PUBLIC` and granted only to `app_user`. `purge_retired_assets()` isn't granted to `app_user` at all — only `pg_cron`, running as the owner, calls it.

These functions and the policies in §8 are verified together against a real Postgres instance by executing both migrations and acting as `app_user` (anonymous, MEMBER, ADMIN) — see `14-testing-and-quality-assurance.md` §17A.

---

# 7. Role Matrix

| Operation | Admin | Technician | Member | Public |
|---|---:|---:|---:|---:|
| View public asset page | Yes | Yes | Yes | Yes |
| View full asset details | Yes | Yes | Yes | No |
| Create asset | Yes | No | No | No |
| Edit asset | Yes | No | No | No |
| Retire asset | Yes | No | No | No |
| Manage buildings/rooms | Yes | No | No | No |
| Request/assign asset to self | Yes | Yes | Yes | No |
| View own assignments | Yes | Yes | Yes | No |
| View all assignments | Yes | No | No | No |
| Report maintenance | Yes | Yes | Yes | No |
| Assign technician to request | Yes | No | No | No |
| View own maintenance reports | Yes | Yes | Yes | No |
| Work assigned/open maintenance requests | Yes | Yes | No | No |
| View all maintenance requests | Yes | No | No | No |
| View audit log | Yes | No | No | No |
| Change user roles | Yes | No | No | No |

Exact permissions should remain consistent with `01-product-requirements.md`.

---

# 8. RLS Policies Per Table

Each policy below is the **defense-in-depth** rule — the Route Handler still enforces the same logic as its primary check.

## users

```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select_own_or_admin ON users
  FOR SELECT
  USING (
    id::text = current_setting('app.current_user_id', true)
    OR current_setting('app.current_user_role', true) = 'ADMIN'
  );

CREATE POLICY users_update_admin_only ON users
  FOR UPDATE
  USING (current_setting('app.current_user_role', true) = 'ADMIN');
```

## buildings / rooms

Reference data. Any authenticated user may read; only admins write.

```sql
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY buildings_select_authenticated ON buildings
  FOR SELECT
  USING (current_setting('app.current_user_role', true) IS NOT NULL);

CREATE POLICY buildings_write_admin_only ON buildings
  FOR ALL
  USING (current_setting('app.current_user_role', true) = 'ADMIN')
  WITH CHECK (current_setting('app.current_user_role', true) = 'ADMIN');

-- rooms: same pattern
```

## assets

MEMBER is authenticated, so sees full asset detail (not the trimmed public-page projection, which is a Route Handler concern, §5); ADMIN/TECHNICIAN have full access including writes.

```sql
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY assets_select_authenticated ON assets
  FOR SELECT
  USING (current_setting('app.current_user_role', true) IS NOT NULL);

CREATE POLICY assets_write_admin_only ON assets
  FOR INSERT WITH CHECK (current_setting('app.current_user_role', true) = 'ADMIN');

CREATE POLICY assets_update_admin_only ON assets
  FOR UPDATE
  USING (current_setting('app.current_user_role', true) = 'ADMIN')
  WITH CHECK (current_setting('app.current_user_role', true) = 'ADMIN');
```

(The public QR page has no RLS identity — the visitor is anonymous — so no `SELECT` policy above matches it and a plain query returns nothing. It reads through the `get_public_asset()` `SECURITY DEFINER` function instead (§6a), which can only ever return the public-safe columns. RLS filters rows, not columns, so the column restriction has to live in that function.)

## assignments

A MEMBER (and a TECHNICIAN acting as a member) sees only their own assignments; ADMIN sees all.

```sql
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY assignments_select_own_or_admin ON assignments
  FOR SELECT
  USING (
    user_id::text = current_setting('app.current_user_id', true)
    OR current_setting('app.current_user_role', true) = 'ADMIN'
  );

CREATE POLICY assignments_insert_own ON assignments
  FOR INSERT
  WITH CHECK (
    user_id::text = current_setting('app.current_user_id', true)
    OR current_setting('app.current_user_role', true) = 'ADMIN'
  );

CREATE POLICY assignments_update_own_or_admin ON assignments
  FOR UPDATE
  USING (
    user_id::text = current_setting('app.current_user_id', true)
    OR current_setting('app.current_user_role', true) = 'ADMIN'
  );
```

## maintenance_requests

Reporters see their own reports; technicians see requests assigned to them or still `OPEN`; admins see all.

```sql
ALTER TABLE maintenance_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY maintenance_requests_select ON maintenance_requests
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

CREATE POLICY maintenance_requests_insert_own ON maintenance_requests
  FOR INSERT
  WITH CHECK (reported_by::text = current_setting('app.current_user_id', true));

CREATE POLICY maintenance_requests_update ON maintenance_requests
  FOR UPDATE
  USING (
    assigned_to::text = current_setting('app.current_user_id', true)
    OR current_setting('app.current_user_role', true) = 'ADMIN'
  );
```

## maintenance_history

Append-only, readable by the same audience as the parent request plus admins; no `UPDATE`/`DELETE` policy exists for anyone (omitting a policy for a command denies it under RLS's default-deny).

```sql
ALTER TABLE maintenance_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY maintenance_history_select_authenticated ON maintenance_history
  FOR SELECT
  USING (current_setting('app.current_user_role', true) IS NOT NULL);

CREATE POLICY maintenance_history_insert_authenticated ON maintenance_history
  FOR INSERT
  WITH CHECK (actor_id::text = current_setting('app.current_user_id', true));

-- No UPDATE or DELETE policy: both are denied to every role, including ADMIN.
```

## attachments

Public attachments (`is_public = true`) are served through the public Route Handler outside RLS context, same as assets. Private attachments follow the visibility of their owning asset/maintenance request.

```sql
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY attachments_select_authenticated ON attachments
  FOR SELECT
  USING (
    is_public = true
    OR current_setting('app.current_user_role', true) IS NOT NULL
  );

CREATE POLICY attachments_insert_authenticated ON attachments
  FOR INSERT
  WITH CHECK (uploaded_by::text = current_setting('app.current_user_id', true));
```

## audit_log

Admin-read-only. No `UPDATE`/`DELETE` for anyone, including ADMIN — append-only means append-only.

```sql
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_log_select_admin_only ON audit_log
  FOR SELECT
  USING (current_setting('app.current_user_role', true) = 'ADMIN');

CREATE POLICY audit_log_insert_authenticated ON audit_log
  FOR INSERT
  WITH CHECK (current_setting('app.current_user_role', true) IS NOT NULL OR actor_id IS NULL);

-- No UPDATE or DELETE policy for any role. The pg_cron retention job (03-database-schema.md §19)
-- writes its own ASSET_PURGED row before deleting the asset; it never needs to touch an
-- existing audit_log row.
```

---

# 9. Resource-Level Authorization

Role alone is not sufficient. Both layers enforce:

### Technician

May update a maintenance request only if `request.assigned_to == authenticatedUserId`, unless Admin is performing the operation.

### Member

May act on an assignment only if `assignment.user_id == authenticatedUserId`, unless Admin is performing the operation.

### Admin

Manages all operational resources, in both layers.

---

# 10. Audit Actor Identity

For every auditable operation:

```text
Entra ID token
      ↓
validated user id
      ↓
audit_log.actor_id
```

Never accept a client-supplied `actorId`. The one exception is the `pg_cron` retention job, which writes `actor_id = NULL` / `actor_name_snapshot = 'System'` for `ASSET_PURGED` events, since there is no HTTP request or human actor for that job (`03-database-schema.md` §19).

---

# 11. PostgreSQL Access

The Postgres instance must not be directly reachable from the browser.

```text
Browser
   ↓
NO DATABASE_URL
NO direct Postgres connection
```

Only server-side Route Handlers, through Prisma, hold the connection string. The Prisma connection uses the RLS-subject `app_user` Postgres role (§6), never a superuser.

---

# 12. Blob Storage Security

Containers should normally be private.

The browser must not receive:

```text
Storage Account Key
Connection String
```

For authorized downloads:

```text
User
 ↓
Route Handler
 ↓
Authorization check
 ↓
Short-lived Blob access
 ↓
Browser
```

Access should expire. Public attachments (`attachments.is_public = true`) may be served through a dedicated public route without this flow.

---

# 13. Attachment Upload Authorization

Before accepting an upload, the Route Handler must validate:

- Authenticated user
- Role
- Target asset/maintenance request (exactly one, per the `attachments_exactly_one_owner` check constraint)
- File type
- File size
- File extension
- MIME type
- Storage path

Do not trust the browser's filename or MIME type alone.

---

# 14. Input Validation

Validate server-side:

```text
IDs
Names
Categories
Statuses
Priorities
Dates
Building IDs
Room IDs
User IDs
File metadata
Pagination parameters
Search strings
```

Reject invalid state transitions before they reach the database.

---

# 15. State Transition Security

The browser must not be able to submit an arbitrary:

```text
status = "RETIRED"
```

or:

```text
role = "ADMIN"
```

and have the API accept it. Route Handlers define allowed transitions (`03-database-schema.md` §10, §14); RLS's `UPDATE` policies (§8) additionally constrain who can write to the row at all, but do not themselves validate which transitions are legal — that check stays in the Route Handler.

---

# 16. Concurrency Security

For assignment and status workflows:

- Use the database-level `uniq_active_assignment_per_asset` partial unique index (`03-database-schema.md` §11) as the source of truth for "at most one active assignment per asset" — do not reimplement it as read-check-write application logic.
- Wrap multi-table writes in `prisma.$transaction(...)`.
- Catch the unique-constraint violation and return HTTP `409 Conflict`.
- Make retryable operations safe to retry (a retry either succeeds once or hits the same `409`).

There is no ETag or idempotency-key scaffolding to design here — a real transaction plus a real unique constraint replaces both.

---

# 17. Secrets

Never commit:

```text
Azure client secrets
Postgres connection strings / DATABASE_URL
Storage account keys
GitHub tokens
Entra secrets
```

Use Azure-managed configuration/secrets. Prefer managed identity where supported and practical.

---

# 18. Error Handling

Do not return:

- Stack traces
- Connection strings
- Postgres exceptions containing sensitive internals
- Token details
- Storage keys

Return safe errors:

```text
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
400 Bad Request
```

Log diagnostic details only to authorized server-side logging.

---

# 19. Security Testing

Test every important endpoint with:

```text
Unauthenticated user
Member
Technician
Admin
Wrong resource owner
Inactive user
Malformed input
Expired/invalid session
```

For at least the highest-risk tables (`assignments`, `maintenance_requests`, `audit_log`), also test that a cross-role query is denied **at the database level** — connect as `app_user` with the RLS session variables set to a low-privilege role and confirm the query returns zero rows or fails, independent of the Route Handler. This is the concrete verification that Layer 2 (§1) is actually active, not just declared.

Expected result must be explicit.

---

# 20. Definition of Done

Security is complete when:

- Entra ID identity is validated.
- Roles are enforced server-side in Route Handlers (Layer 1).
- Row-Level Security is enabled and policies exist for every table in §8 (Layer 2).
- The Prisma connection uses a non-superuser, non-`BYPASSRLS` Postgres role.
- PostgreSQL is not directly exposed to the browser.
- Blob Storage remains private except for explicitly public attachments.
- Public QR responses are limited to safe fields.
- Audit actor identity cannot be spoofed.
- State transitions are validated in the Route Handler.
- Concurrency conflicts are handled via the database unique constraint + `409 Conflict`.
- Secrets are never committed.
- Negative authorization tests pass at both the application layer and the database layer.

---

# Claude Code Execution Boundary

Claude Code implements application code and local project files. Azure resource creation, Azure Portal configuration, secrets, GitHub repository operations, commits/pushes, and deployment are performed by the human developer. Claude Code may provide exact manual instructions and configuration templates, but must not execute or claim completion of those operations.
