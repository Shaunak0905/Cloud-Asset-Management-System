# Authentication
## Cloud-Based Campus Asset QR & Maintenance Management System

> **Status:** Implementation-ready authentication specification
> **Authentication provider:** Microsoft Entra ID, integrated via Auth.js (NextAuth)
> **Backend:** Next.js Route Handlers (no separate Azure Functions project)
> **Frontend:** Next.js/React on Azure Static Web Apps

---

# 1. Authentication Goal

Use **Microsoft Entra ID** as the application's authentication provider, integrated through **Auth.js (NextAuth)** running inside the Next.js application.

Authentication must provide:

- Login
- Logout
- Persistent authenticated state
- Authenticated user identity
- Protected routes
- Role-aware navigation
- Profile retrieval
- Secure API interaction
- Clear authentication errors

Do not build a custom password authentication system.

Do not store passwords in Postgres.

---

# 2. Authentication Architecture

```text
User
  ↓
Next.js Login / Auth.js (NextAuth) Entra ID flow
  ↓
Microsoft Entra ID
  ↓
Authenticated session/token
  ↓
Entra ID user/object ID
  ↓
users table (Postgres, via Prisma)
  ↓
Application role
  ↓
Next.js Route Handler authorization
  ↓
Authorized UI + API operation
```

The Entra ID user/object ID is the authoritative identity.

---

# 3. Identity vs Application Profile

Microsoft Entra ID maintains the authenticated identity.

The application maintains a profile document:

```text
id
fullName
email
role
department
phone
isActive
createdAt
updatedAt
```

Relationship:

```text
Entra ID user/object ID
        │
        │ 1:1
        ▼
Postgres users row (Prisma)
```

Do not create an unrelated application identity.

---

# 4. Supported Roles

```text
ADMIN
TECHNICIAN
MEMBER
```

`MEMBER` is a single merged role covering all non-privileged authenticated users (replacing the earlier separate STUDENT/STAFF split, since no workflow ever gave them different permissions).

Public users are unauthenticated.

Role determines application permissions, but Next.js Route Handlers (backed by Postgres Row-Level Security as defense-in-depth) remain the final authorization boundary.

---

# 5. Login Flow

Recommended:

```text
User opens /login
       ↓
Microsoft Entra ID sign-in
       ↓
Authentication succeeds
       ↓
Session/token established
       ↓
Application obtains validated user ID
       ↓
Retrieve profile
       ↓
Check isActive
       ↓
Determine role
       ↓
Redirect to appropriate dashboard
```

Do not implement password handling in application code.

---

# 6. Profile Provisioning

After first successful authentication:

```text
Entra ID user authenticated
        ↓
Look up users row by Entra ID object ID
        ↓
If missing:
    create profile
        ↓
role = MEMBER (default, lowest-privilege authenticated role)
```

New users provisioning via Entra ID always default to `MEMBER`.

`ADMIN` and `TECHNICIAN` are never granted automatically. Those roles must be granted explicitly by an existing admin (e.g. through an admin user-management screen or a direct database action), after the user already exists with the default `MEMBER` role.

This first-sign-in provisioning **is** self-registration: there is no separate signup form. Any account able to complete Entra ID sign-in gets a `users` row on first login.

---

# 6a. Restricting Self-Registration to a College Email Domain

The strongest restriction is scoping the Entra ID app registration itself to the college's own tenant (human developer, in the Azure Portal) — accounts outside that tenant simply cannot complete sign-in.

As an app-level backstop (or for setups where the app registration allows multiple tenants/personal accounts), an optional `AUTH_ALLOWED_EMAIL_DOMAIN` environment variable gates the `signIn` callback in `src/lib/auth/auth.ts`: if set, only emails ending in `@<that domain>` are allowed to sign in; anyone else is redirected back to `/login` with an error. This is a plain string comparison — no directory lookup, no external API. Leave the variable unset to allow whatever the Entra ID app registration itself permits (e.g. for local development).

The login page also carries a static reminder to use the official college email — a UX nudge, not a security boundary in its own right.

---

# 7. Active User Check

Every protected API request must verify:

```text
profile exists
AND
profile.isActive == true
```

An inactive profile must not be allowed to perform protected operations even if Entra ID authentication succeeds.

---

# 8. Protected Routes

Examples:

```text
/dashboard
/assets
/maintenance
/admin/*
```

The frontend should redirect unauthenticated users.

However, route hiding is not security.

The API must independently enforce authorization.

---

# 9. Public Routes

Examples:

```text
/
 /asset/[publicCode]
 /login
```

The public asset page must use a safe public API response.

---

# 10. API Authentication

Frontend requests to Next.js Route Handlers should include the appropriate Entra ID access token/session according to the configured Auth.js (NextAuth) session model.

The Route Handler must:

1. Validate the token.
2. Extract the user ID.
3. Verify profile.
4. Verify active state.
5. Verify role/resource authorization.

Never accept a browser-provided user ID as the authenticated identity.

---

# 11. Logout

Logout should:

```text
End application session
Clear local authenticated state
Return user to public/login experience
```

Use the standard Entra ID/client integration rather than custom credential invalidation logic.

---

# 12. Unauthorized States

Handle:

```text
Unauthenticated
Authenticated but inactive
Authenticated but missing profile
Authenticated but insufficient role
Expired/invalid session
```

Provide clear user-facing messages without exposing implementation details.

---

# 13. Environment Configuration

Use environment variables appropriate to the Entra ID application configuration.

Example:

```env
NEXT_PUBLIC_AZURE_TENANT_ID=
NEXT_PUBLIC_AZURE_CLIENT_ID=
NEXT_PUBLIC_API_BASE_URL=
NEXT_PUBLIC_APP_URL=
```

Only include variables that are actually required by the chosen Entra ID integration.

Never commit secrets.

---

# 14. No Custom Password Database

Never create:

```text
password
password_hash
reset_token
```

in the application profile document.

Authentication credentials remain the responsibility of Microsoft Entra ID.

---

# 15. Definition of Done

Authentication is complete when:

- Entra ID login works.
- Logout works.
- Sessions are handled correctly.
- User identity maps to a profile.
- Inactive users are blocked.
- Roles are loaded correctly.
- Protected frontend routes are guarded.
- Next.js Route Handlers independently validate authorization (with Postgres Row-Level Security as defense-in-depth).
- No password is stored in Postgres.
- No client secret is exposed to browser code.
---

# Claude Code Execution Boundary

Claude Code implements application code and local project files. Azure resource creation, Azure Portal configuration, secrets, GitHub repository operations, commits/pushes, and deployment are performed by the human developer. Claude Code may provide exact manual instructions and configuration templates, but must not execute or claim completion of those operations.

