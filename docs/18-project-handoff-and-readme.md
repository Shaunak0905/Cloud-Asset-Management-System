# Project Handoff & Developer README
## Cloud-Based Campus Asset QR & Maintenance Management System

> **Status:** Final Azure developer handoff document
> **Audience:** Claude Code, student developers, evaluators, future maintainers
> **Source of truth:** `docs/00-project-context.md` through `docs/17-claude-code-master-build-instructions.md`

---

# 1. What This Project Is

The system is a cloud-based campus asset management application.

Its core purpose is to:

```text
Register assets
Track assets
Identify assets through QR codes
Track temporary usage
Manage maintenance
Assign technicians
Store maintenance evidence
Maintain historical records
Audit important actions
```

Operational flow:

```text
Physical Asset
      ↓
QR Code
      ↓
Digital Asset Record
      ↓
Usage / Assignment
      ↓
Maintenance
      ↓
History + Audit
```

---

# 2. Main Users

```text
ADMIN
TECHNICIAN
MEMBER
PUBLIC QR VISITOR
```

---

# 3. Admin

Admin manages:

```text
Assets
Buildings
Rooms
Users/roles
Technicians
Maintenance
Dashboards
Audit logs
Retirement
```

---

# 4. Technician

Technician handles:

```text
Assigned maintenance
Diagnosis
Repair notes
Evidence
Resolution
```

Technicians do not automatically have administrative privileges.

---

# 5. Member

Normal authenticated users (the merged non-privileged role) can:

```text
Scan QR
View safe asset information
Request/use assets
Select usage location
Return assigned assets
Report problems
View own assignments
View own maintenance requests
```

---

# 6. Public QR Visitor

Public QR pages expose only safe information:

```text
Asset name
Asset identifier
Category
Registered location
Safe status
```

Private operations require authentication.

---

# 7. Core Location Concept

The system intentionally separates:

```text
Registered Location
```

from:

```text
Usage Location
```

Example:

```text
Asset:
Projector P-104

Registered:
Vyas / VY001

Temporary usage:
Vivekananda / VK404
```

The assignment records the temporary usage location.

The registered location remains unchanged unless an Admin explicitly changes it.

---

# 8. QR Principle

The QR identifies the physical asset.

It does not identify:

```text
Current user
Current room
Status
Maintenance request
Assignment
Session
```

Stable URL:

```text
https://<production-domain>/asset/<publicCode>
```

Do not change the public ID after QR issuance.

---

# 9. Maintenance Flow

```text
Problem Report
 ↓
Maintenance Request
 ↓
Technician Assignment
 ↓
Diagnosis
 ↓
Repair
 ↓
Resolution
 ↓
Maintenance History
```

Historical records must not be overwritten.

---

# 10. Azure Architecture

```text
GitHub
   ↓
Azure Static Web Apps
   ↓
Next.js Route Handlers
   ↓
┌───────────────┬────────────────┐
↓               ↓                ↓
PostgreSQL   Blob Storage    Entra ID
```

More explicitly:

```text
Browser
  ↓
Azure Static Web Apps
  ↓
Next.js Route Handlers
  ├── Authentication/authorization
  ├── Business workflows
  ├── PostgreSQL data access (Prisma)
  └── Blob access
       ↓
Azure Database for PostgreSQL / Blob Storage
```

One exception: the asset retention job (7-day hard-delete of RETIRED assets) runs as a daily `pg_cron` job inside Postgres, not through a Route Handler.

---

# 11. Azure Services

## Azure Static Web Apps

Hosts the Next.js/React frontend, using its hybrid support for server-side rendering and Route Handlers.

## Next.js Route Handlers

Provide the TypeScript API and server-side workflows. There is no separate Azure Functions project. The one exception is the asset retention job, which runs via `pg_cron` inside Postgres.

## Azure Database for PostgreSQL Flexible Server

Stores structured application data, accessed via Prisma.

Core tables:

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

## Azure Blob Storage

Stores all uploaded files in a single generic container:

```text
attachments
```

Each file's metadata row links it to either an asset or a maintenance request, with a per-file `isPublic` flag controlling whether it can be served on the public QR page.

## Microsoft Entra ID

Provides authentication and authenticated identity.

## GitHub

Source control and CI/CD trigger.

---

# 12. Database Model

The system uses a real relational PostgreSQL schema, accessed through Prisma.

Important concepts:

```text
Tables
Foreign keys
Indexes
Row-Level Security policies
Transactions
Denormalized snapshot columns (for audit history after asset hard-delete)
```

See `03-database-schema.md` for the detailed model.

---

# 13. Security Model

```text
Microsoft Entra ID
        ↓
Authenticated identity
        ↓
Next.js Route Handlers
        ↓
Role/resource authorization (app layer + Postgres Row-Level Security)
        ↓
PostgreSQL / Blob Storage
```

Frontend role checks are UX only.

Never trust browser-supplied:

```text
role
userId
actorId
```

---

# 14. Storage

Binary files live in Blob Storage, in a single generic `attachments` container.

PostgreSQL stores metadata, including the `isPublic` flag used to serve public-safe asset images on the QR page.

Never store:

```text
Storage account keys
Database connection strings/passwords
Entra client secrets
```

in browser code.

---

# 15. Audit

Important actions are recorded.

Examples:

```text
ASSET_CREATED
ASSET_ASSIGNED
ASSET_RETURNED
ASSET_TRANSFERRED
MAINTENANCE_CREATED
MAINTENANCE_RESOLVED
FILE_UPLOADED
USER_ROLE_CHANGED
```

The actor is the validated Entra ID user.

---

# 16. Frontend

Built from scratch using:

```text
React/Next.js
TypeScript
Tailwind CSS
Components
QR functionality
UI/UX
Business workflows
```

The frontend should call the Route Handler API rather than directly accessing PostgreSQL or Blob Storage.

---

# 17. API

Representative endpoints:

```text
/api/public/assets/:publicCode

/api/assets
/api/assets/:id

/api/buildings
/api/buildings/:id/rooms

/api/assignments
/api/assignments/:id/return
/api/assignments/:id/transfer

/api/maintenance
/api/maintenance/:id
/api/maintenance/:id/assign
/api/maintenance/:id/resolve

/api/files
/api/files/:id/access

/api/dashboard/admin
/api/dashboard/technician

/api/audit
/api/users
```

Exact routing can follow the project's own structure as it's scaffolded.

---

# 18. Development Workflow

```text
VS Code
 ↓
Local coding
 ↓
Local testing
 ↓
Git
 ↓
GitHub
 ↓
Azure CI/CD
 ↓
Production
```

Do not make manual production edits the normal workflow.

---

# 19. Project Framing

This is a **green-field, Azure-native build**: a new Next.js + Azure + PostgreSQL application, written from scratch. There is no legacy Supabase app and nothing being migrated.

The target implementation is:

```text
Next.js/React
+
Azure Static Web Apps
+
Next.js Route Handlers
+
Azure Database for PostgreSQL (Prisma)
+
Blob Storage
+
Entra ID
```

with `pg_cron` handling the one scheduled job (asset retention hard-delete).

---

# 20. Claude Code Operating Rule and Workflow

Claude Code should work in a loop:

```text
Read docs
 ↓
Implement one phase
 ↓
Test
 ↓
Fix
 ↓
Continue
```

Do not rewrite the entire project in one pass.

A recommended sequence for the human developer to drive this loop:

```text
1. Give Claude Code the docs.
2. Ask it to implement the current phase only (see 16-implementation-roadmap.md).
3. Review the generated/changed files.
4. Run the local validation it reports.
5. Perform any Manual Developer Actions it lists.
6. Ask Claude Code to continue to the next coding phase.
7. Repeat until all application code is complete.
8. Manually commit/push to GitHub.
9. Manually deploy/configure Azure.
10. Give Claude Code any non-secret deployment errors for fixes.
```

Claude Code should be treated as the **developer/coding agent**, not as the Azure administrator or GitHub operator.

---

# 21. Developer Execution Model

This project deliberately separates **software development** from **cloud administration**.

## Claude Code is responsible for

```text
Application code
Next.js Route Handler code
Prisma/PostgreSQL repositories and RLS policies
pg_cron retention job SQL
Blob integration
Entra integration
Frontend
Tests
Configuration templates
GitHub/Azure workflow files
Setup scripts
Documentation
```

## The human developer is responsible for

```text
Azure Portal
Azure resource creation
Azure credentials
Entra registration
Secrets
Postgres/Blob preparation
Git commits
Git pushes/pulls
GitHub settings
Azure deployment
Production testing
```

Claude Code should never claim that it has completed an Azure setup or deployment unless the human developer has explicitly performed that action and supplied the resulting evidence.

---

# 22. Final Definition of Done

The project is complete when:

- Asset CRUD works.
- Buildings/rooms work.
- Dynamic room filtering works.
- QR scanning works.
- QR URLs remain stable.
- Registered and usage locations remain separate.
- Assignment/movement history works.
- Maintenance works.
- Blob uploads/downloads work securely, from the single `attachments` container.
- Roles work (ADMIN, TECHNICIAN, MEMBER).
- Audit logs work, including denormalized snapshots surviving asset hard-deletion.
- The 7-day post-retirement pg_cron hard-delete works.
- Dashboards work.
- Entra ID authentication works.
- PostgreSQL stores the relational schema, with Row-Level Security enforced.
- Route Handlers enforce authorization.
- GitHub deploys to Azure.
