# Azure Documentation Package — Developer/Cloud Responsibility Split

This package defines an Azure-native implementation of the Cloud-Based Campus Asset QR & Maintenance Management System.

## Target architecture

```text
Local Development
      ↓
Next.js / React
      ↓
Azure Static Web Apps (hybrid SSR + Route Handlers)
      ↓
Next.js Route Handlers (TypeScript)
      ↓
      ├──────────────────────────────┬──────────────────┐
      ↓                               ↓                  ↓
Azure Database for PostgreSQL    Blob Storage    Microsoft Entra ID
Flexible Server
```

One exception: the asset retention rule (7-day hard-delete of `RETIRED` assets) runs as a daily `pg_cron` job inside Postgres, not through a Route Handler.

## Critical execution rule

**Claude Code is responsible for code and project files. The human developer is responsible for Azure, GitHub, secrets, and deployment.**

Claude Code may:

- Create/edit source code.
- Create/edit configuration templates.
- Create Next.js Route Handlers.
- Create Prisma/PostgreSQL repositories, data-access code, and Row-Level Security policies.
- Create the pg_cron retention job SQL.
- Create Blob Storage integration.
- Create Entra integration.
- Create tests.
- Run local validation.
- Create GitHub/Azure workflow files.
- Give exact manual instructions.

Claude Code must not:

- Log into Azure.
- Create Azure resources.
- Configure Azure Portal resources.
- Create/configure production secrets.
- Push to GitHub.
- Modify GitHub repository settings.
- Deploy to Azure.
- Claim that production deployment succeeded.

The human developer performs:

```text
Azure preparation
      ↓
Secret/configuration setup
      ↓
Git commit
      ↓
Git push
      ↓
Azure deployment
      ↓
Production testing
```

## Database

The relational schema — tables, foreign keys, indexes, and Row-Level Security policies — is defined in `03-database-schema.md`.

## Filenames

`04-rls-security-policies.md` and `11-server-side-logic-edge-functions.md` describe exactly what their names say: `04` covers real Postgres Row-Level Security policies, and `11` covers Next.js Route Handler server-side logic.

## Recommended Claude Code workflow

```text
Read docs
  ↓
Inspect repository
  ↓
Implement one phase
  ↓
Run local checks
  ↓
Fix local errors
  ↓
Report changed files
  ↓
Provide Manual Developer Actions if needed
  ↓
Human performs Azure/Git/GitHub actions
  ↓
Next phase
```

The goal is a complete, locally runnable application codebase that the human developer can then configure, push, deploy, and verify on Azure.
