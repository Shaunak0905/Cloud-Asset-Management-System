# Deployment & Environment Configuration
## Cloud-Based Campus Asset QR & Maintenance Management System

> **Status:** Implementation-ready Azure deployment specification
> **Audience:** Claude Code + human developer
> **Execution boundary:** Claude Code prepares code/configuration; the human developer performs Azure, GitHub, secrets, and deployment operations.

---

# 1. Purpose

This document defines both:

1. What Claude Code must prepare in the repository.
2. What the human developer must manually configure and execute.

The runtime target is:

```text
GitHub
   ↓
Azure Static Web Apps
   ↓
Next.js Route Handlers (app/api/.../route.ts — same app, no separate deployed service)
   ↓
┌──────────────────────────────────────┬───────────────────┬──────────────────┐
↓                                      ↓                   ↓
Azure Database for PostgreSQL          Blob Storage      Microsoft Entra ID
Flexible Server (via Prisma)
   ↓
pg_cron (runs inside the Postgres server itself — daily asset-retention job,
nothing extra to provision or deploy)
```

No Vercel, Supabase, Railway, or other cloud platform is part of the target runtime. There is no separate Azure Functions resource: Azure Static Web Apps' hybrid Next.js support serves both the SSR pages and the API Route Handlers from the same deployment.

---

# 2. Claude Code Responsibilities

Claude Code prepares:

- Application source code
- Next.js Route Handler source code (`app/api/.../route.ts`)
- Prisma schema and migrations against Postgres
- The `pg_cron` retention job SQL (runs inside Postgres, not deployed separately)
- Blob Storage integration
- Entra authentication integration
- `.env.example`
- Local configuration templates
- Azure-compatible build configuration
- GitHub Actions/workflow files if required
- Tests
- Deployment documentation
- Seed/import/export scripts
- Health-check endpoints where useful

Claude Code does **not**:

- Create Azure resources
- Log into Azure
- Run `az login`
- Configure the Azure Portal
- Create the Azure Database for PostgreSQL Flexible Server
- Create Entra app registrations
- Configure GitHub repository secrets
- Push to GitHub
- Deploy to Azure
- Verify production deployment

---

# 3. Human Developer Responsibilities

The human developer performs:

- Azure subscription/resource-group setup (using Azure for Students — see Section 6A)
- Azure Database for PostgreSQL Flexible Server creation (Burstable B1ms tier)
- Enabling the `pg_cron` extension via the server's Postgres extension/parameter settings
- Blob Storage account creation, with a single `attachments` container
- Azure Static Web Apps creation/configuration
- Microsoft Entra ID app registration/configuration
- Redirect URI configuration
- API permissions/consent where required
- Environment/secret configuration
- Connecting GitHub to the Azure Static Web App (repository/branch link for CI/CD)
- Git commits and pushes
- Azure deployment
- Production smoke testing
- Cost monitoring

Never paste secrets into Claude Code chat.

---

# 4. Local Environment

`.env.example` in the repo root is the source of truth for variable names, with a comment on each. The groups are:

```text
DATABASE_URL                        # runtime, as the RLS-subject app_user role
DIRECT_DATABASE_URL                 # server admin — migrations + seed only
AUTH_SECRET, AUTH_URL               # Auth.js
AUTH_MICROSOFT_ENTRA_ID_ID/_SECRET/_ISSUER   # Entra ID app registration
AUTH_ALLOWED_EMAIL_DOMAIN           # optional college-domain gate
AZURE_STORAGE_CONNECTION_STRING, AZURE_STORAGE_ATTACHMENTS_CONTAINER
NEXT_PUBLIC_APP_URL                 # base URL encoded into QR codes
APP_TIME_ZONE                       # display timezone for server-rendered times
```

Two database connection strings are intentional — see `04-rls-security-policies.md` §6. Pointing `DATABASE_URL` at the server admin would work but silently bypass every RLS policy.

`NEXT_PUBLIC_APP_URL` must be the real production origin before any QR sticker is printed: it's baked into the printed code and can't be changed afterward.

`.env.local` and secret-bearing files must be gitignored.

---

# 5. Local Development

The intended development loop is:

```text
Write code locally
      ↓
Run the Next.js dev server locally (app + Route Handlers, one process)
      ↓
Connect to configured development/Azure Postgres instance via Prisma
      ↓
Run tests/build
      ↓
Review changes
```

The human developer supplies local Azure/Postgres configuration values (e.g. `DATABASE_URL`).

Claude Code may run local application commands (including `prisma migrate dev`/`prisma generate` against the configured database) but must not create cloud resources.

---

# 6. Azure Resource Preparation — HUMAN ACTION

The human developer should create the required Azure resources using the Azure Portal or their own preferred Azure tooling.

Minimum target resources:

```text
Resource Group
Azure Static Web Apps
Azure Database for PostgreSQL Flexible Server (Burstable B1ms)
Azure Storage Account / single "attachments" Blob container
Microsoft Entra ID application registration
```

There is no separate Azure Functions resource to provision — Azure Static Web Apps' hybrid Next.js support serves the app's own Route Handlers.

Exact SKU/tier choices must be checked against current Azure pricing and availability at the time of setup.

Claude Code should provide the exact configuration values, connection strings, redirect URLs, and environment-variable names needed by the code.

---

# 6A. Cost/Hosting Note — Azure for Students

The user should use **Azure for Students** (available with a valid academic email): a $100 credit, no credit card required, valid for 12 months. This comfortably covers a single Azure Database for PostgreSQL Flexible Server (Burstable B1ms) for the duration of a 1-month build. Blob Storage, Azure Static Web Apps, and Microsoft Entra ID app registrations are free or negligible cost regardless of the credit, so the Postgres server is the only line item worth watching.

---

# 7. Azure Database for PostgreSQL Preparation — HUMAN ACTION

Create the Azure Database for PostgreSQL Flexible Server (Burstable B1ms tier) and the database/tables defined by `03-database-schema.md` (via Prisma migrations).

Before production setup, verify:

- Server tier/compute size (Burstable B1ms)
- The `pg_cron` extension is enabled via the server's allow-listed extensions/parameters (required for the daily asset-retention job — see `03-database-schema.md` and `13-audit-logging.md`)
- Firewall/networking rules (allow the app's outbound IP / use private access as appropriate)
- Region
- Automated backup settings (see Section 7A)

Claude Code may generate the Prisma schema, migration files, and the `pg_cron` job SQL, but the human developer provisions the server and applies migrations against it.

## 7.1 First-time database setup, in order

1. **Server parameters** (Azure Portal → the server → *Server parameters*):
   - `azure.extensions`: allow-list `PGCRYPTO`, `PG_TRGM`, and `PG_CRON`. Flexible Server rejects `CREATE EXTENSION` for anything not on this list — all three are used by the first migration.
   - `shared_preload_libraries`: add `pg_cron` (the server restarts to apply it).
   - `cron.database_name`: set to the app's database name (e.g. `cams`). pg_cron can only schedule jobs from this database; left at the default (`postgres`), the migration's `cron.schedule(...)` fails.
2. **Create the app database** (e.g. `cams`) and put the admin connection string in `DIRECT_DATABASE_URL`.
3. **Apply migrations:** `npm run db:migrate` (uses `DIRECT_DATABASE_URL`). This creates the `app_user` role.
4. **Give `app_user` a password**, connected as the admin: `ALTER ROLE app_user PASSWORD '<strong password>';` — then put it in `DATABASE_URL`. Store it as an app setting in Azure; never commit it.
5. **Seed** (optional): `npm run db:seed`.
6. **Make yourself an admin** after your first sign-in (everyone starts as `MEMBER`): `UPDATE users SET role = 'ADMIN' WHERE email = '<you>';`, connected as the admin.

---

# 7A. Backup & Recovery

Azure Database for PostgreSQL Flexible Server has **automated daily backups by default**, with a configurable retention window (set during/after server creation). For a 1-month student project, the default automated backup behavior is sufficient — there is no need to design detailed RPO/RTO targets, custom backup schedules, or a disaster-recovery runbook. The human developer should simply confirm the default backup retention is enabled when the server is created.

---

# 8. Blob Storage Preparation — HUMAN ACTION

Create a single Blob container:

```text
attachments
```

This one container holds every uploaded file — asset images, maintenance photos, and maintenance documents alike — linked via the `attachments` table (`03-database-schema.md`). Individual files are flagged `isPublic` where they need to be served on the public QR asset page; everything else stays private by default.

Keep the container itself private; public-safe files are served through the app-controlled public flag, not a public container.

The human developer configures storage permissions and environment variables.

Claude Code only implements the application-side storage integration.

---

# 9. Entra ID Preparation — HUMAN ACTION

The human developer creates/configures the Microsoft Entra application registration.

Configure the redirect/sign-out URLs required by the selected authentication flow.

Then place only the required configuration values into local/Azure environment settings.

Do not place client secrets in source code.

Claude Code implements the application-side authentication handling.

---

# 10. GitHub Preparation — HUMAN ACTION

Claude Code may generate:

```text
.github/workflows/*.yml
```

The human developer:

1. Reviews the workflow.
2. Commits it.
3. Pushes it to GitHub.
4. Connects/configures Azure deployment.
5. Adds required GitHub/Azure secrets or environment settings.

Claude Code must not push or alter repository settings.

---

# 11. Deployment Flow

The final human-controlled flow is:

```text
Claude Code
   ↓
Local files
   ↓
Human review
   ↓
git add / commit / push
   ↓
GitHub
   ↓
Azure CI/CD
   ↓
Static Web Apps (app + Route Handlers)
```

Claude Code documents this flow but does not execute it.

---

# 12. Production Verification — HUMAN ACTION

After Azure deployment, the human developer should verify:

```text
Frontend loads
Login works
Roles work
Public QR page works
Asset CRUD works
Building/room filtering works
Assignments work
Movement history works
Maintenance workflow works
Uploads/downloads work
Audit logs are created
Search/filtering works
```

The human developer should supply failures/logs back to Claude Code if fixes are needed.

Claude Code can then modify the local code and provide another manual deployment cycle.

---

# 13. Deployment Troubleshooting Boundary

If deployment fails:

### Human developer

Collect and provide relevant non-secret information such as:

- Build logs
- Route Handler/server logs
- HTTP status codes
- Error messages
- Azure configuration screenshots with secrets hidden

### Claude Code

Analyze the failure and modify code/configuration as appropriate.

Claude Code must never request passwords, access tokens, client secrets, storage keys, or database connection strings/credentials.

---

# 14. Final Deployment Checklist

The application is considered production-ready only after the human developer verifies:

- Azure resources exist.
- Environment variables/secrets are configured.
- GitHub contains the intended code.
- Azure deployment succeeds.
- Production smoke tests pass.
- QR URLs use the production domain.
- No Supabase/Vercel runtime dependency remains.
- No secrets are committed.

**This verification is performed by the human developer, not Claude Code.**
