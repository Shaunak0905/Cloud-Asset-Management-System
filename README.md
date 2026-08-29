# Campus Asset Management System

A QR-based campus asset tracking and maintenance management web app. Every
physical asset (projectors, laptops, lab equipment, etc.) gets a QR code
linking to a public asset page; authenticated staff/students can request and
use assets, report problems, and technicians/admins run those problems
through a maintenance workflow.

Full functional and technical specification: see [`docs/`](./docs), starting
with [`docs/00-project-context.md`](./docs/00-project-context.md). That
directory is the source of truth for every design decision in this codebase —
read it before making architectural changes.

## Stack

- **Frontend/API:** Next.js (App Router) + TypeScript + Tailwind CSS, deployed
  to Azure Static Web Apps (hybrid SSR/Route Handler support — no separate
  Azure Functions project).
- **Database:** Azure Database for PostgreSQL Flexible Server, via Prisma.
  Real Row-Level Security policies (`prisma/migrations/0001_init/migration.sql`)
  sit beneath application-layer authorization as defense-in-depth.
- **Auth:** Microsoft Entra ID via Auth.js (NextAuth v5).
- **Storage:** Azure Blob Storage, single generic `attachments` container.
- **Scheduled job:** `pg_cron` inside Postgres handles the 7-day
  retired-asset retention/purge rule — no separate Functions app needed.

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in real values — see comments in the file
npx prisma generate
npm run dev
```

`npm run build` and `npx prisma generate` both work without a live database
connection. Actually connecting requires an Azure Database for PostgreSQL
instance (see [`docs/15-deployment-and-environment.md`](./docs/15-deployment-and-environment.md)
for what to provision) and running
`npx prisma migrate deploy` to apply `prisma/migrations/0001_init/migration.sql`.

## Project status

Green-field build, no legacy codebase. See
[`docs/16-implementation-roadmap.md`](./docs/16-implementation-roadmap.md) for
the phase-by-phase build plan (solo, 1-month timeline).
