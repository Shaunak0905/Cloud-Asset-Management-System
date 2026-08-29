# Implementation Roadmap
## Cloud-Based Campus Asset QR & Maintenance Management System

> **Status:** Master Azure implementation plan for Claude Code
> **Audience:** Claude Code / student development team
> **Critical instruction:** Build incrementally. Do not generate the entire project in one pass.

---

# 1. Implementation Goal

Build in controlled phases:

```text
Project Scaffold
      ↓
Azure Architecture Foundation
      ↓
PostgreSQL Data Model
      ↓
Entra ID Authentication
      ↓
Route Handler API
      ↓
Core UI
      ↓
Asset Management
      ↓
QR
      ↓
Assignments
      ↓
Maintenance
      ↓
Blob Storage
      ↓
Audit
      ↓
Dashboards
      ↓
Security / Testing
      ↓
GitHub → Azure Deployment
```

Each phase must leave the application runnable.

---

# 1a. Timeline: 1-Month Solo Build

This is a solo, 1-month build. The 15 phases below map onto four weeks plus a short buffer:

```text
Week 1 (Phases 0-4): Repo scaffold (Next.js + TypeScript + Tailwind), Prisma schema
against Azure Database for PostgreSQL, Row-Level Security policies, Entra ID auth
(Auth.js), Buildings → Rooms hierarchy, Asset CRUD (admin).

Week 2 (Phases 5-8): QR generation + public asset page, request/assignment workflow,
search/filter/pagination.

Week 3 (Phases 9-11): Maintenance lifecycle, attachments upload/serving, audit
logging with denormalized snapshots, pg_cron retention job.

Week 4 + 2-3 day buffer (Phases 12-15): Dashboards (3 role tiers), end-to-end
testing, Azure deployment, defense prep.
```

This mapping is approximate — phase boundaries do not need to line up with calendar days precisely, but each week should end with the slice of functionality above working end-to-end.

---

# 2. Master Rule

Before coding:

1. Read all project documents.
2. Scaffold the project (there is no existing repository to inspect — this is a green-field build).
3. Implement the current phase's functionality.
4. Do not build unrelated features ahead of schedule.
5. Change the cloud/data boundary deliberately.
6. Run checks after every meaningful phase.
7. Fix failures before proceeding.

---

# 3. Phase 0 — Project Scaffold

There is no legacy application and no `supabase/` directory to inspect — this is a green-field build. Phase 0 creates the project from scratch:

```text
Scaffold a new Next.js + TypeScript project (App Router)
Add Tailwind CSS
Initialize Prisma
Configure Prisma's datasource to point at Azure Database for PostgreSQL Flexible Server
Add ESLint/formatting config
Add .env.example
Add a minimal README
```

Determine and record:

```text
Package manager (npm/pnpm)
Project directory layout
Local environment variable requirements
```

---

# 4. Phase 1 — Azure Project Foundation

Create/configure:

```text
Azure resource group
Azure Database for PostgreSQL Flexible Server (Burstable B1ms)
Blob Storage
Static Web Apps
Microsoft Entra ID
```

The human developer supplies credentials/configuration.

Claude Code prepares:

```text
Prisma schema/client setup
Environment templates
Postgres connection/session-role wrapper
Blob service
Entra integration
```

---

# 5. Phase 1 Acceptance

Verify:

```text
Frontend starts locally
Route Handlers start locally
Environment validation works
Prisma can connect to Azure Database for PostgreSQL
Azure resources are reachable from server-side code
No secrets are committed
```

---

# 6. Phase 2 — PostgreSQL Data Model

Implement the relational schema from `03-database-schema.md` as a Prisma schema.

Initial tables:

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

Configure:

```text
foreign keys
indexes
Postgres Row-Level Security policies
Prisma session-role wrapper (SET LOCAL ROLE / session variables)
seed data
```

---

# 7. Phase 2 Acceptance

Verify:

```text
User profile can be read
Buildings/rooms can be read
Asset can be created/read/updated
Assignment record can be created
Maintenance request can be created
Audit log row can be written
Row-Level Security denies a cross-role query at the database level
```

---

# 8. Phase 3 — Entra ID Authentication

Implement:

```text
Login
Logout
Session/token handling
Profile lookup
Active-user check
Role retrieval
Protected routes
```

Do not store passwords.

---

# 9. Phase 3 Acceptance

Test:

```text
Unauthenticated user
Authenticated member
Authenticated technician
Authenticated admin
Inactive user
```

Verify server-side authorization.

---

# 10. Phase 4 — Route Handler API Foundation

Create API/service layers as Next.js Route Handlers:

```text
auth
users
buildings
rooms
assets
assignments
maintenance
files
audit
dashboard
public
```

Every protected endpoint validates identity and authorization.

---

# 11. Phase 5 — Core UI

Build the core UI shell and shared design system (layout, navigation, role-aware views) from scratch.

All data access goes through the Route Handler API — the frontend never talks to Postgres or Blob Storage directly.

---

# 12. Phase 6 — Asset Management

Implement:

```text
Create
Read
Update
Search
Filter
Archive/retire
Status transitions
Registered location
```

Keep:

```text
registered location
```

separate from:

```text
temporary usage location
```

---

# 13. Phase 7 — QR

Implement:

```text
Stable public ID
QR generation
QR download
QR print
Public asset route
```

QR URL:

```text
/asset/<publicCode>
```

Never encode mutable operational state in the QR.

---

# 14. Phase 8 — Assignments

Implement:

```text
Request
Assign
Transfer
Return
History
Usage location
```

Protect against:

```text
double assignment
invalid room/building combination
inactive users
invalid asset status
```

Use ETags/transactional mechanisms as appropriate.

---

# 15. Phase 9 — Maintenance

Implement:

```text
Problem report
Priority
Technician assignment
Diagnosis
Repair notes
Status transitions
Resolution
Maintenance history
```

---

# 16. Phase 10 — Blob Storage

Implement a single generic `attachments` container/table, holding files linked to either an asset or a maintenance request:

```text
Upload (asset or maintenance-linked)
isPublic flag handling
Private downloads
Public-safe serving on the QR page
Upload validation
Delete
Metadata
```

Do not expose storage credentials.

---

# 17. Phase 11 — Audit and Retention

Implement important audit events, with denormalized snapshots of the asset name/public code on `maintenance_history`, `assignment_history`, and `audit_log` rows so history stays readable after an asset is deleted.

Actor identity must come from validated Entra ID identity.

Implement the daily `pg_cron` job that permanently hard-deletes assets 7 days after their status becomes `RETIRED`.

Verify audit history remains after records change, and remains readable after a retired asset is hard-deleted.

---

# 18. Phase 12 — Dashboards

Implement:

```text
Admin
Technician
Member
Public QR
```

Use API-side aggregation.

Do not download the entire dataset into the browser.

---

# 19. Phase 13 — Security

Test:

```text
Unauthenticated access
Role escalation
Resource ownership bypass
Inactive user
Malformed input
Invalid state transition
File access bypass
Audit spoofing
Secret exposure
```

---

# 20. Phase 14 — Testing

Run:

```text
Unit
Component
Integration
API authorization
Postgres data access (including Row-Level Security)
Blob access
QR
End-to-end
Manual acceptance
```

---

# 21. Phase 15 — Deployment

Deploy:

```text
GitHub
   ↓
Azure CI/CD
   ↓
Static Web Apps (Next.js frontend + Route Handlers)
```

Configure:

```text
Entra ID
Azure Database for PostgreSQL (including pg_cron extension)
Blob Storage
Production domain
Environment variables
```

---

# 22. Final Acceptance

The system is complete when:

- All documented workflows are implemented and working.
- Azure Static Web Apps hosts the frontend.
- Next.js Route Handlers implement the backend, with pg_cron handling the one scheduled retention job.
- Azure Database for PostgreSQL stores structured data, with Row-Level Security enforced.
- Blob Storage stores files in the single `attachments` container.
- Entra ID handles authentication for the 3-role model (ADMIN, TECHNICIAN, MEMBER).
- Server-side authorization works.
- QR workflows work, including the retired/deleted-asset tombstone page.
- Asset/assignment/maintenance workflows work.
- Audit logging works, including denormalized snapshots surviving asset hard-deletion.
- GitHub → Azure CI/CD works.

---

# Claude Code / Human Execution Boundary

This roadmap separates **coding work** from **manual cloud/repository work**.

## Claude Code performs

- Local source-code implementation
- Local configuration templates
- Next.js Route Handler code
- Prisma/PostgreSQL access code and RLS policies
- pg_cron retention job SQL
- Blob Storage integration
- Entra ID integration
- Tests
- Local builds/type-checks/linting
- GitHub/Azure workflow files
- Seed/migration/setup scripts
- Documentation and manual checklists

## Human developer performs

- Azure Portal/resource creation
- Azure authentication
- Entra app registration
- Postgres/Storage resource preparation
- Secret configuration
- Git commits
- Git pushes/pulls
- GitHub repository settings
- Azure/GitHub connection
- Deployment
- Production testing

Claude Code must **not** execute cloud administration, push the repository, or deploy the application. At every roadmap phase that needs human action, Claude Code should stop after producing the required files and provide a concise `Manual Developer Actions` checklist.

## Phase completion format

At the end of each implementation phase, Claude Code should report:

```text
Implemented:
- file/path
- file/path

Local validation:
- command/result
- command/result

Manual Developer Actions:
1. ...
2. ...

Next coding phase:
...
```

If no manual action is needed, omit the Manual Developer Actions section.
