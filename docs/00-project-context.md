# Cloud-Based Campus Asset QR & Maintenance Management System
## Project Context — Azure-Native Source of Truth

> **Document status:** Authoritative project context
> **Implementation target:** Claude Code
> **Cloud target:** Azure only
> **Important:** The human developer will create/configure the Azure resources and GitHub/Azure connection. Claude Code implements the application and infrastructure configuration files but must never receive private credentials.

---

# 1. Project Overview

Build a cloud-based campus asset QR and maintenance management web application for a college/university.

The system gives every physical institutional asset a unique QR-based digital identity. Assets may include:

- Projectors
- Laptops
- Desktop PCs
- Arduino kits
- Raspberry Pi kits
- Oscilloscopes
- Cameras
- Networking equipment
- Printers
- Laboratory equipment
- Other institutional equipment

The application must support the complete operational lifecycle:

```text
Physical Asset
      ↓
QR Code
      ↓
Public Asset Page
      ↓
Authentication / User Action
      ↓
Asset Request / Assignment
      ↓
Usage Location
      ↓
Maintenance
      ↓
Maintenance History
      ↓
Audit Trail
```

The system is a 4th-year Cloud Computing PBL project. It must demonstrate practical cloud concepts while remaining simple enough for a student team to implement, deploy, understand and defend.

---

# 2. Core Architectural Principle

Use an **Azure-native architecture built on Next.js**.

The target architecture is:

```text
Users / QR
    ↓
Azure Static Web Apps (Next.js, hybrid SSR + Route Handlers)
    ↓
Next.js Route Handlers (TypeScript)
    ├── Authentication validation
    ├── Authorization
    ├── Business workflows
    └── API
       ↓
    ┌───────────────┬────────────────┐
    ↓               ↓                ↓
Azure Database    Azure Blob      Microsoft
for PostgreSQL    Storage          Entra ID
Flexible Server
```

Do not introduce a separate always-running Express/Django/Spring server, and do not stand up a separate Azure Functions project.

The backend boundary is Next.js Route Handlers, deployed as part of the same Azure Static Web Apps app via its hybrid Next.js support.

**One exception:** the asset retention/hard-delete rule (see Section 8) runs as a daily **pg_cron** job inside Postgres itself. It is not a Route Handler and not an Azure Function — it is database-native scheduling, so the "no separate Functions project" rule stays intact.

---

# 3. Technology Stack

## Frontend

- Next.js / React
- TypeScript
- Tailwind CSS

## Backend / Cloud

- Azure Static Web Apps (hybrid Next.js hosting, including Route Handlers)
- Next.js Route Handlers (API layer — no separate Azure Functions project)
- Azure Database for PostgreSQL Flexible Server, accessed via Prisma
- pg_cron (in-database scheduled job, used only for the asset retention/hard-delete rule)
- Azure Blob Storage
- Microsoft Entra ID
- GitHub Actions / Azure-integrated CI/CD

## QR

Use a stable, lightweight QR-code generation library compatible with Next.js/TypeScript.

QR URLs should use:

```text
https://<production-domain>/asset/<public-id>
```

The production domain comes from configuration.

---

# 4. Azure Responsibility Boundary

### Human developer

The human developer is responsible for:

- Creating/configuring the Azure subscription/resource group
- Creating Azure Static Web Apps
- Creating the Azure Database for PostgreSQL Flexible Server instance
- Creating Blob Storage
- Configuring Microsoft Entra ID
- Connecting GitHub to Azure
- Setting deployment secrets/environment variables
- Reviewing Azure costs and free-tier eligibility

### Claude Code

Claude Code is responsible for:

- Application code (Next.js frontend and Route Handlers)
- Prisma schema and PostgreSQL data-access code
- Postgres Row-Level Security policy definitions
- Blob Storage integration
- Entra ID application integration
- Authorization logic
- Environment-variable templates
- Tests
- CI/CD configuration where appropriate
- Documentation
- Database seed/setup scripts where required

Claude Code must never require the developer to paste passwords, client secrets, access keys, or subscription credentials into the chat.

---

# 5. Database Decision

**Azure Database for PostgreSQL Flexible Server** is the committed, primary database for this project. It is not a fallback or a hedge — it was chosen deliberately over Cosmos DB.

The reasons:

- The domain is genuinely relational (assets, buildings, rooms, assignments, maintenance requests, attachments, audit log all reference one another), and Postgres gives real **ACID transactions** across those entities in a single database.
- Real **foreign keys** enforce referential integrity at the database layer instead of the application having to simulate it.
- Postgres **sequences** provide simple, reliable generation of human-readable public asset codes (e.g. `AST-2026-00142`) without inventing a counter mechanism.
- There is no partition-key design to get right (or get wrong) up front, and no partition-key immutability trap when an asset's building/room assignment changes.
- Postgres **Row-Level Security** gives a genuine second layer of defense-in-depth authorization underneath the app-layer checks in the Route Handlers.

Access is through **Prisma** as the ORM, with a per-request session wrapper so RLS policies can see the authenticated user's role and ID.

The detailed relational schema (tables, foreign keys, indexes) is defined in `03-database-schema.md`.

---

# 6. Identity and Roles

Microsoft Entra ID provides authenticated identity.

The application maintains a profile document containing application-specific information:

```text
userId
fullName
email
role
department
phone
isActive
createdAt
updatedAt
```

Roles:

```text
ADMIN
TECHNICIAN
MEMBER
```

`MEMBER` is a single merged role for all non-privileged authenticated users (replacing the earlier separate STAFF/STUDENT roles, since no part of the spec ever gave them different permissions).

Public QR visitors are unauthenticated.

Role checks in the UI are not security boundaries. Route Handlers must validate the authenticated identity and role before protected operations, and Postgres Row-Level Security policies enforce the same boundary at the database layer.

---

# 7. Storage

Azure Blob Storage stores binary files.

Use **one generic logical container**:

```text
attachments
```

A single `attachments` table holds metadata for every uploaded file, whether it is linked to an asset or to a maintenance request. Files should normally remain private; a per-file `isPublic` flag marks the specific attachments (typically asset images) that are safe to serve on the public QR asset page.

The database stores metadata such as:

```text
blobContainer
blobName
originalFilename
mimeType
fileSizeBytes
uploadedBy
assetId
maintenanceRequestId
isPublic
```

Do not store binary file contents inside the Postgres database.

---

# 8. Core Functional Requirements

This is a green-field build. There is no existing application to preserve — the frontend, business logic, and UI are built from scratch in Next.js/TypeScript/Tailwind, following the functional requirements documented across `docs/`.

The system must implement:

- Asset CRUD
- Asset registration
- Buildings → rooms hierarchy
- Dynamic building → room filtering
- Registered/home location
- Current usage location
- Asset assignment
- Asset movement/history
- Maintenance/status tracking
- Technician workflows
- Asset photos/documents
- QR-code generation and scanning
- QR-based asset identification
- User roles and permissions
- Audit logs
- Search/filtering
- Dashboards
- Public-safe QR pages

**Asset retention rule:** once an asset's status becomes `RETIRED`, it is permanently hard-deleted from the database **7 days later** by a daily `pg_cron` job. To keep the audit trail intact after deletion, the maintenance history, assignment history, and audit log tables store a **denormalized snapshot** of the asset's name and public code at the time of each event, rather than relying solely on a foreign key. The public QR page shows a friendly "this asset is no longer in service" message rather than a raw 404 for a retired or deleted asset's code.

---

# 9. Security Principle

Security is layered:

```text
Browser
   ↓
Microsoft Entra ID
   ↓
Azure Static Web Apps
   ↓
Next.js Route Handlers
   ↓
Authentication + role authorization + validation
   ↓
PostgreSQL (app-layer checks + Row-Level Security) / Blob Storage
```

Never trust:

- Hidden form fields
- Client-side role values
- URL parameters
- Arbitrary user IDs
- Client-supplied audit actors

The authenticated Entra ID identity is the source of the actor identity.

---

# 10. Public QR Access

A public QR page may expose only safe fields:

```text
Asset name
Asset identifier
Category
Registered location
Safe status
```

It must not expose:

- Private user information
- Maintenance notes
- Private documents
- Internal authorization data
- Secrets
- Arbitrary database records

Public reads should use a deliberately limited Route Handler API response.

---

# 11. Development Workflow

The final workflow is:

```text
VS Code
   ↓
Local development
   ↓
Local tests
   ↓
Git commit
   ↓
GitHub
   ↓
Azure CI/CD
   ↓
Azure Static Web Apps (Next.js frontend + Route Handlers)
   ↓
Production
```

Do not deploy directly from a developer laptop as the normal production workflow.

---

# 12. Green-Field Build Principle

There is no legacy application. This is a **green-field build** — the repository currently contains only documentation, and the entire codebase is created from scratch.

Build using:

- Next.js (App Router) + React
- TypeScript
- Tailwind CSS
- Prisma against Azure Database for PostgreSQL
- Next.js Route Handlers as the API layer

Follow the functional requirements, data model, and workflows documented across `docs/` as the specification. There is no prior SDK, prior schema, or prior UI to adapt or translate — design and implement each piece directly against the Azure-native architecture described in this document.

---

# 13. Cost Principle

The target is a low-cost or free-eligible MVP.

Azure pricing and free-tier eligibility can change. Do not hardcode pricing claims into application logic.

The project must:

- Prefer free/low-cost eligible services
- Avoid unnecessary always-on infrastructure
- Avoid Redis unless required
- Avoid paid queues unless required
- Avoid paid analytics platforms
- Avoid unnecessary third-party APIs
- Monitor resource usage

---

# 14. Definition of Done

The project is complete when:

- The app runs locally.
- The app builds successfully.
- Route Handler APIs work.
- Entra ID authentication works.
- Roles are enforced server-side and by Postgres Row-Level Security.
- PostgreSQL stores the required relational data.
- Blob Storage handles private files.
- QR URLs remain stable.
- Public QR pages expose only safe information.
- Asset, assignment and maintenance workflows work.
- Audit history is preserved, including after the retention job hard-deletes retired assets.
- Automated tests pass.
- GitHub → Azure deployment works.
- No cloud secrets are committed.
---

# Claude Code Execution Boundary

Claude Code implements application code and local project files. Azure resource creation, Azure Portal configuration, secrets, GitHub repository operations, commits/pushes, and deployment are performed by the human developer. Claude Code may provide exact manual instructions and configuration templates, but must not execute or claim completion of those operations.

