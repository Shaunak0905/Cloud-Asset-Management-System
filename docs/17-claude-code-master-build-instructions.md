# Claude Code Master Build Instructions
## Cloud-Based Campus Asset QR & Maintenance Management System

> **Purpose:** This is the operating contract for Claude Code.
> **Role of Claude Code:** Application developer and code generator only.
> **Role of human developer:** Azure administrator, Git/GitHub operator, deployment operator, and final tester.
> **Architecture:** Azure-native only.

---

# 1. Non-Negotiable Execution Boundary

Claude Code must **build the application code and project files**. It must **not perform cloud administration or repository operations on behalf of the human developer**.

## Claude Code MAY

- Read and modify the local repository.
- Create application source files.
- Create/update configuration files and templates.
- Create Next.js Route Handler code.
- Create Prisma schema and PostgreSQL data-access code, including Row-Level Security policies.
- Create the pg_cron retention job SQL.
- Create Blob Storage integration code.
- Create Microsoft Entra ID integration code.
- Create frontend code.
- Create tests.
- Run local development commands needed to validate code, such as install, build, lint, type-check and test commands.
- Inspect local command output and fix code errors.
- Generate database seed/import/export scripts that the developer can run manually.
- Generate Azure/GitHub configuration files when those files are part of the application repository.
- Explain what the human developer must do next.

## Claude Code MUST NOT

- Create or modify Azure resources.
- Log into Azure.
- Run `az login` or use the user's Azure credentials.
- Create subscriptions, resource groups, Azure Database for PostgreSQL servers, Storage Accounts, Static Web Apps, or Entra registrations.
- Change Azure Portal settings.
- Create production secrets or ask the user to paste secrets into chat.
- Push to GitHub.
- Pull from GitHub as a substitute for the user's normal Git workflow.
- Commit to Git on behalf of the developer unless the developer explicitly requests a local commit.
- Deploy the application.
- Trigger a production deployment.
- Modify GitHub repository settings, Actions secrets, branch protection, or Azure deployment connections.
- Claim that Azure deployment has succeeded unless the human developer has actually performed it and supplied the result.

The normal human-controlled workflow is:

```text
Claude Code creates/updates files
        ↓
Human reviews files
        ↓
Human runs Git commands
        ↓
Human pushes to GitHub
        ↓
Human configures/uses Azure
        ↓
Azure deploys
        ↓
Human tests production
```

---

# 2. Response Style During Implementation

Claude Code should be **implementation-first**.

When asked to implement something:

1. Inspect the relevant existing files.
2. Implement the requested code.
3. Run appropriate local checks.
4. Fix errors found locally.
5. Summarize the files changed.
6. Give a short **Manual Developer Actions** section only when the next step requires the human developer.

Do not spend the response explaining code that was not requested.

When a task requires Azure Portal, Azure CLI, GitHub, secrets, or deployment, stop at the code/configuration boundary and provide exact manual instructions.

---

# 3. Source-of-Truth Order

Read these documents before implementing the project:

```text
00-project-context.md
01-product-requirements.md
02-system-architecture.md
03-database-schema.md
04-rls-security-policies.md
05-authentication.md
06-asset-management.md
07-qr-system.md
08-maintenance-system.md
09-storage-file-management.md
10-frontend-architecture.md
11-server-side-logic-edge-functions.md
12-dashboard-and-analytics.md
13-audit-logging.md
14-testing-and-quality-assurance.md
15-deployment-and-environment.md
16-implementation-roadmap.md
```

If two documents conflict:

1. Preserve the functional requirement.
2. Prefer the more specific document.
3. Prefer the Azure-native architecture.
4. Do not invent a new cloud service without explicit approval.
5. Ask the human only when the conflict prevents a safe implementation.

---

# 4. Required Technology

Use:

```text
Next.js / React
TypeScript
Tailwind CSS
Azure Static Web Apps (hybrid Next.js hosting)
Next.js Route Handlers (API layer — no separate Azure Functions project)
Azure Database for PostgreSQL Flexible Server, accessed via Prisma
pg_cron (in-database scheduled job, retention rule only)
Azure Blob Storage (single generic attachments container)
Microsoft Entra ID (via Auth.js)
GitHub
```

Do not introduce:

```text
Supabase
Vercel
Railway
AWS
Render
Firebase
Cosmos DB
A separate Azure Functions project
A standalone always-running Express/Django/Spring backend
```

---

# 5. Green-Field Build

There is no existing application. The repository contains only `docs/` — build the entire application from scratch, following the requirements, data model, and workflows documented across `docs/`.

Implement directly against the target architecture:

```text
Next.js / TypeScript / Tailwind frontend
Next.js Route Handlers (API layer)
Azure Database for PostgreSQL (Prisma ORM)
Azure Blob Storage (single generic attachments container)
Microsoft Entra ID (via Auth.js)
```

Do not build placeholder migration scaffolding for a prior stack — there is nothing to migrate from.

---

# 6. Database Implementation Rules

Implement the relational model in `03-database-schema.md` using:

- Prisma schema/models mapped to real Postgres tables
- Foreign keys and constraints
- Explicit indexes
- Real Postgres transactions for multi-step writes
- Postgres Row-Level Security policies as defense-in-depth, with the Prisma per-request session-role wrapper so policies can see the authenticated user's role and ID
- Denormalized snapshot columns on `maintenance_history`, `assignment_history`, and `audit_log` so history survives the 7-day post-retirement hard-delete

The browser must never receive database credentials or connection strings.

---

# 7. API Boundary

All privileged data operations must go through the Route Handler API.

Example structure:

```text
app/
  (routes/pages)
  api/
    <resource>/route.ts

lib/
  services/
  repositories/
  auth/
  validation/
  audit/

prisma/
  schema.prisma

shared/
  types/
  schemas/
```

This is a starting layout, not a rigid requirement — adapt it as the project's own conventions settle during Phase 0/1.

---

# 8. Authentication and Authorization

Use Microsoft Entra ID for identity.

Every protected API operation must derive identity from validated authentication context.

Never trust these values from browser input:

```text
userId
role
actorId
reportedBy
assignedBy
```

Frontend role checks are for UX only.

Route Handlers must enforce authorization server-side, and Postgres Row-Level Security policies enforce the same boundary at the database layer as defense-in-depth.

The three roles are `ADMIN`, `TECHNICIAN`, and `MEMBER` (a single merged role for all non-privileged authenticated users).

---

# 9. Storage

Use Azure Blob Storage for binary files.

Do not expose storage account keys to the browser.

Use the backend to authorize file operations and generate appropriate short-lived access where required.

Never use a temporary access URL as the permanent identity of a file.

---

# 10. Required Application Features

The final codebase must support:

- Asset CRUD
- Asset registration
- Buildings and rooms
- Building → room filtering
- Registered/home location
- Current usage location
- Asset assignment
- Movement/history
- QR generation and scanning
- Maintenance requests
- Technician assignment
- Maintenance history
- Status tracking
- Asset photos/documents
- Audit logging
- Search/filtering
- Role-based permissions
- Public-safe QR asset pages
- Asset retention (7-day hard-delete after RETIRED, via pg_cron, with denormalized audit snapshots)

---

# 11. Local Validation

Claude Code should validate locally before declaring a coding phase complete.

Use the repository's available commands for:

```text
install/dependency validation
TypeScript type-check
lint
unit tests
integration tests where available
production build
```

Do not skip failures merely because deployment will happen later.

Do not claim production functionality has been verified if only local checks were performed.

---

# 12. Azure Preparation: HUMAN ONLY

When Azure resources are needed, Claude Code must create the **code/configuration required to use them**, then provide a manual checklist.

Example:

```text
Manual Developer Actions
1. Create the Azure Database for PostgreSQL Flexible Server instance.
2. Create the database and enable the pg_cron extension using the values documented below.
3. Copy the required connection string into the local .env file.
4. Do not paste the secret into chat.
5. Run the local test command.
```

Claude Code must not execute those cloud actions itself.

---

# 13. Git/GitHub: HUMAN ONLY

Claude Code may create files such as:

```text
.github/workflows/*.yml
.gitignore
.env.example
README.md
```

The human developer performs:

```bash
git status
git add .
git commit
git push
```

Claude Code may explain these commands when needed, but must not push the repository.

---

# 14. Deployment: HUMAN ONLY

Claude Code prepares deployment-compatible application files and gives deployment instructions.

The human developer performs:

- Azure Portal setup
- Azure/GitHub connection
- Secret configuration
- Production environment configuration
- GitHub push
- Deployment approval where applicable
- Production smoke testing

Claude Code must not claim that the application is deployed.

---

# 15. Manual Developer Actions Format

Whenever a human action is required, use this format:

```text
## Manual Developer Actions

1. [Exact action]
2. [Exact action]
3. [Exact action]

### Values to use
- Name: ...
- Setting: ...
- Environment variable: ...

### Do not share
- Azure client secrets
- Storage keys
- PostgreSQL connection strings/passwords
- Passwords
- Access tokens
```

Keep this section concise and actionable.

---

# 16. Implementation Order

Follow the roadmap in `16-implementation-roadmap.md`.

Recommended sequence:

```text
1. Scaffold the project (Next.js + TypeScript + Tailwind + Prisma)
2. Establish frontend foundation
3. Establish Route Handler API structure
4. Implement Prisma/PostgreSQL data-access layer and RLS policies
5. Implement Entra authentication integration
6. Implement authorization
7. Implement asset/location features
8. Implement QR features
9. Implement assignments/movement
10. Implement maintenance
11. Implement Blob Storage
12. Implement audit logging and the pg_cron retention job
13. Implement dashboards/search/filtering
14. Complete tests
15. Generate deployment/configuration files
16. Stop and hand Azure/GitHub execution to the human developer
```

Do not perform step 16 yourself.

---

# 17. Definition of Done for Claude Code

Claude Code's work is complete when:

- Required application files exist.
- The application builds locally.
- Relevant tests pass locally.
- No prohibited cloud SDK/service remains in the runtime path.
- No secrets are committed.
- `.env.example` documents required variables.
- Route Handler API is implemented.
- Prisma/PostgreSQL data-access code and RLS policies are implemented.
- Blob Storage integration is implemented.
- Entra ID integration is implemented.
- Required GitHub/Azure configuration files are generated where appropriate.
- The human developer has a clear manual setup/deployment checklist.

**Production deployment is NOT part of Claude Code's definition of done.**
