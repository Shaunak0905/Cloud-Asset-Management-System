# Server-Side Logic & Route Handlers
## Cloud-Based Campus Asset QR & Maintenance Management System

> **Status:** Implementation-ready server/API specification
> **Backend:** Next.js Route Handlers
> **Runtime:** Node.js + TypeScript
> **Database:** Azure Database for PostgreSQL Flexible Server, via Prisma
> **Storage:** Azure Blob Storage
> **Authentication:** Microsoft Entra ID (Auth.js)

This is genuine server-side logic, running on a real Node.js server for every request — the "edge functions" framing in this file's name refers to the earlier Azure Functions design, not to what actually runs. What follows describes Next.js Route Handlers, which own exactly the same responsibilities (authentication, authorization, business workflows, server-only credentials) as Azure Functions would have, just co-located with the frontend in one Next.js app instead of a separate Functions project.

---

# 1. Core Principle

There is no need for an always-running traditional backend server, and there is no separate compute project.

The architecture is:

```text
Next.js Frontend
      ↓
Azure Static Web Apps (hybrid Next.js hosting)
      ↓
Next.js Route Handlers (app/api/.../route.ts)
      ↓
Prisma → PostgreSQL / Blob Storage
```

Route Handlers provide the server-side boundary for authentication, authorization and business workflows. One workload runs entirely outside this request/response model — see §7.

---

# 2. Why Server-Side Logic Exists

Some operations require more than a simple browser action.

Examples:

```text
Request asset
Resolve maintenance
Assign technician
Generate temporary Blob access
Change user role
Retire asset
Create audit event
```

These operations require:

- Authentication
- Authorization
- Validation
- Multiple related writes, atomically
- Concurrency control
- Audit logging
- Server-only credentials (`DATABASE_URL`, Blob Storage keys, Entra secrets)

---

# 3. API Strategy

Use Next.js Route Handlers for all application data access.

```text
Frontend
   ↓
Route Handler (app/api/.../route.ts)
   ↓
Authorization
   ↓
Service / data-access layer
   ↓
Prisma → PostgreSQL / Blob Storage
```

Do not expose `DATABASE_URL` or Storage credentials to the frontend. Do not query Prisma from a client component.

---

# 4. Route Handler Organization

```text
app/
└── api/
    ├── assets/
    │   ├── route.ts              # GET (list), POST (create)
    │   └── [id]/route.ts         # GET, PATCH, DELETE (admin)
    ├── assignments/
    │   ├── route.ts
    │   └── [id]/route.ts
    ├── maintenance/
    │   ├── route.ts
    │   └── [id]/route.ts
    ├── users/
    ├── buildings/
    ├── rooms/
    ├── attachments/
    ├── audit/
    ├── dashboard/
    └── public/
        └── assets/[publicCode]/route.ts
```

Exact organization may evolve as routes are added, but each resource keeps its handlers under one `api/<resource>/` folder, matching the table it's backed by in `03-database-schema.md`.

---

# 5. Example Route Handlers

```text
GET  /api/public/assets/:publicCode   → getPublicAsset()
GET  /api/assets                      → listAssets()
POST /api/assets                      → createAsset()
PATCH /api/assets/:id                 → updateAsset()
POST /api/assets/:id/retire           → retireAsset()

POST /api/assignments                 → createAssignment()
POST /api/assignments/:id/approve     → approveAssignment()
POST /api/assignments/:id/return      → returnAssignment()

POST /api/maintenance                 → createMaintenanceRequest()
POST /api/maintenance/:id/assign      → assignTechnician()
PATCH /api/maintenance/:id/status     → updateMaintenanceStatus()
POST /api/maintenance/:id/resolve     → resolveMaintenance()

POST /api/attachments                 → uploadAttachment()
GET  /api/attachments/:id/access      → getAttachmentAccess()
DELETE /api/attachments/:id           → deleteAttachment()

GET  /api/dashboard/admin             → getAdminDashboard()
GET  /api/dashboard/technician        → getTechnicianDashboard()
GET  /api/dashboard/member            → getMemberDashboard()
GET  /api/audit                       → getAuditLog()          (admin only)
PATCH /api/users/:id/role             → changeUserRole()        (admin only)
```

---

# 6. Route Handler Security

Every protected Route Handler must:

- Validate the Entra ID session (Auth.js).
- Retrieve the authenticated user id.
- Load the `users` row.
- Check `is_active`.
- Check role.
- Validate input.
- Check resource-level authorization (ownership/assignment, not role alone — `04-rls-security-policies.md` §9).
- Perform the operation inside a Prisma transaction that also sets the RLS session variables (`04-rls-security-policies.md` §6).
- Audit when required, in the same transaction.

Do not assume:

```text
Route Handler = automatically secure
```

A handler with no explicit checks is exactly as insecure as a public one — see the two-layer model in `04-rls-security-policies.md`.

---

# 7. The One Exception: pg_cron Retention Job

The asset retention job (`03-database-schema.md` §19 — hard-deleting a `RETIRED` asset 7 days after `retired_at`) runs as a **`pg_cron` scheduled SQL job inside Postgres itself**, not as a Route Handler and not as an Azure Function. It has no HTTP trigger, nothing calls it, and nothing needs to: `cron.schedule(...)` runs `purge_retired_assets()` daily, entirely inside the database.

This is deliberate and is the one carve-out to "Route Handlers only" (`02-system-architecture.md` §15) — a scheduled, DB-native job has no meaningful HTTP surface to expose, and building an HTTP-triggered Route Handler just to be pinged by an external scheduler would add a moving part (something to call it, secure that call, and monitor it) for no benefit over a job that already lives next to the data it operates on.

---

# 8. Public Route Handlers

Public handlers are narrowly scoped.

```text
GET /api/public/assets/:publicCode
```

Returns only safe fields (`03-database-schema.md` §24). Never returns the full database row. If `publicCode` doesn't resolve, returns a "this asset is no longer in service" response rather than a raw `404`.

---

# 9. Asset Request — Concurrency

Asset requests are concurrency-sensitive.

```text
User A → Request Asset
User B → Request Asset
```

The system must prevent two active assignments on the same asset. This is enforced primarily by the database, not application logic:

- The `uniq_active_assignment_per_asset` partial unique index (`03-database-schema.md` §11) makes a second concurrent `ACTIVE` assignment for the same asset fail at the database level, unconditionally.
- The Route Handler wraps the read-validate-write sequence in `prisma.$transaction(...)`.
- On a unique-constraint violation, the handler catches it and returns `409 Conflict`.

There is no ETag, transactional-batch-within-a-partition, or idempotency-key design needed here — the earlier Cosmos DB-era concurrency design existed specifically to work around the lack of real transactions and constraints, neither of which is a problem in Postgres.

---

# 10. Recommended Asset Request Flow

```text
Frontend
   ↓
POST /api/assignments
   ↓
Authenticate
   ↓
Authorize
   ↓
Validate asset/user/location
   ↓
BEGIN transaction
   ↓
Read current asset state
   ↓
Insert assignment (status = PENDING or ACTIVE)
   ↓
Update asset state (status, current_usage_building_id/room_id) if auto-approved
   ↓
Insert audit_log row
   ↓
COMMIT
   ↓
Return result
```

Return:

```text
409 Conflict
```

if the unique-active-assignment constraint rejects the write because the asset became unavailable during the operation.

---

# 11. Return Asset

```text
Authenticate
 ↓
Authorize owner/Admin
 ↓
Validate assignment is ACTIVE
 ↓
BEGIN transaction
 ↓
Set assignments.status = RETURNED, returned_at = now()
 ↓
Clear assets.current_usage_building_id/room_id, set status = AVAILABLE
 ↓
Insert audit_log row
 ↓
COMMIT
```

The registered/home location (`assets.registered_building_id`/`registered_room_id`) is untouched by a return — only the usage location changes.

---

# 12. Changing an Asset's Registered Building

This is a plain, single-transaction update — not a special workflow.

```text
Authenticate
 ↓
Authorize Admin
 ↓
Validate target building/room exist and room belongs to building
 ↓
UPDATE assets SET registered_building_id = ..., registered_room_id = ...
 ↓
Insert audit_log row (ASSET_REGISTERED_LOCATION_CHANGED)
```

Worth calling out explicitly because the earlier Cosmos DB design got this wrong: since `assets` was partitioned by `/buildingId`, changing a registered building meant changing the partition key, which Cosmos DB cannot do in place — it required deleting and recreating the document, losing the document's change history along the way unless carefully staged. In Postgres, `registered_building_id` is an ordinary foreign key column; updating it is one `UPDATE` statement inside one transaction, with no special handling, no delete/recreate, and no history loss.

---

# 13. Maintenance Request

```text
Authenticate
 ↓
Verify active user
 ↓
Verify asset
 ↓
Validate description/priority
 ↓
BEGIN transaction
 ↓
Insert maintenance_requests row (request_number via next_public_code())
 ↓
Insert maintenance_history row (action = CREATED)
 ↓
Optionally update assets.status → DAMAGED / IN_MAINTENANCE
 ↓
Insert audit_log row
 ↓
COMMIT
```

Reporter identity comes from the validated Entra ID identity, never from client input.

---

# 14. Maintenance Resolution

```text
Authenticate
 ↓
Authorize technician (assigned_to == self) or Admin
 ↓
Validate current status allows this transition
 ↓
BEGIN transaction
 ↓
Update maintenance_requests (status = RESOLVED, resolved_at = now(), resolution_notes)
 ↓
Insert maintenance_history row (action = RESOLVED, snapshot columns populated)
 ↓
Update assets.status → AVAILABLE or RETIRED (+ retired_at if RETIRED)
 ↓
Insert audit_log row
 ↓
COMMIT
```

This is the concrete case the product decision called out: under the old design, this exact sequence was described as a "transaction" spanning three separate Cosmos containers, which Cosmos DB cannot actually do atomically — that framing was an error in the earlier draft. In Postgres it's one real `prisma.$transaction([...])` across `maintenance_requests`, `maintenance_history`, `assets`, and `audit_log` in the same database. See `13-audit-logging.md` for the full write-up and `03-database-schema.md` §10 for the allowed asset-status transitions (never allow arbitrary status jumps — `DAMAGED`/`IN_MAINTENANCE`/`LOST` only resolve to `AVAILABLE` or `RETIRED`, and only through this flow).

---

# 15. Attachment Operations

Attachment operations use Blob Storage plus the single `attachments` table (`03-database-schema.md` §17).

```text
Upload
 ↓
Authenticate
 ↓
Authorize
 ↓
Validate file (type, size, extension, MIME)
 ↓
Upload to Blob Storage
 ↓
Insert attachments row (exactly one of asset_id/maintenance_request_id set)
 ↓
Audit
```

Downloads (non-public attachments):

```text
Authenticate
 ↓
Authorize
 ↓
Generate short-lived Blob access
```

Public attachments (`is_public = true`) may be served directly through the public asset Route Handler without this flow.

---

# 16. Dashboard Queries

Dashboard Route Handlers query only the required aggregates.

Do not:

```text
download all assets
→ calculate metrics in browser
```

Prefer:

```text
GET /api/dashboard/admin
GET /api/dashboard/technician
GET /api/dashboard/member
```

each returning only the metrics that role's dashboard needs — full counts/backlog for Admin, "my assigned requests"/"my current assignments" for Technician and Member respectively (`00-project-context.md`, `12-dashboard-and-analytics.md`).

---

# 17. Audit Logging

Important Route Handlers write audit events in the same transaction as the write they're auditing.

The actor is:

```text
validated Entra ID user id
```

never a browser-supplied value — with the single exception of the `pg_cron` retention job (§7), which writes `actor_id = NULL`, `actor_name_snapshot = 'System'` (`03-database-schema.md` §17, §19).

---

# 18. Idempotency

Real transactions plus the `uniq_active_assignment_per_asset` constraint (§9) already make the highest-risk operation (`createAssignment`) safe to retry: a duplicate `ACTIVE` insert fails the constraint rather than creating a second active assignment. For other write operations that may be retried by a flaky client (`createMaintenanceRequest`, `uploadAttachment`), an idempotency key is still reasonable defensive practice, but it is no longer standing in for a missing database guarantee the way it did under the Cosmos DB design — it's a UX nicety here, not the primary correctness mechanism.

---

# 19. Error Model

Use consistent status codes:

```text
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
413 Payload Too Large
415 Unsupported Media Type
429 Too Many Requests
500 Internal Server Error
```

Never expose stack traces or secrets.

---

# 20. Data Access Layer

Keep Prisma access separate from Route Handler request/response code.

```text
Route Handler
      ↓
Service / business logic
      ↓
Repository / Prisma data-access layer
      ↓
Prisma Client → PostgreSQL
```

This keeps the application testable and keeps every Prisma call in one place, which is also where the RLS session-variable wrapper (`04-rls-security-policies.md` §6) lives.

---

# 21. Definition of Done

The backend layer is complete when:

- Route Handlers run locally via `next dev`.
- Protected Route Handlers validate the Entra ID session.
- Roles are enforced server-side (Layer 1) with Postgres RLS as Layer 2.
- Prisma access is centralized in a single data-access layer.
- Blob access is server-authorized.
- Concurrency-sensitive workflows are protected by real transactions and database constraints, not application-level locking.
- Multi-table workflows (e.g. maintenance resolution, §14) commit as one transaction.
- Audit events are generated, including the `pg_cron`-authored `ASSET_PURGED` event.
- Public APIs expose only safe data.
- The `pg_cron` retention job is the only server-side logic that does not run as a Route Handler, and it runs entirely inside Postgres.
- No privileged credential reaches the browser.

---

# Claude Code Execution Boundary

Claude Code implements application code and local project files. Azure resource creation, Azure Portal configuration, secrets, GitHub repository operations, commits/pushes, and deployment are performed by the human developer. Claude Code may provide exact manual instructions and configuration templates, but must not execute or claim completion of those operations.
