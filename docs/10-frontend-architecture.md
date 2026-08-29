# Frontend Architecture
## Cloud-Based Campus Asset QR & Maintenance Management System

> **Status:** Implementation-ready frontend specification  
> **Audience:** Claude Code / student development team  
> **Source of truth:** `docs/00-project-context.md` through `docs/09-storage-file-management.md`
>
> The frontend is the user-facing application. It must remain simple, responsive, secure-by-default, and compatible with the Azure/Azure Static Web Apps architecture.

---

# 1. Frontend Goal

The frontend must provide a clear interface for four audiences:

```text
Public Visitor
     ↓
QR Asset Page

Member
     ↓
User Dashboard
     ↓
Asset Requests / Maintenance Reports

Technician
     ↓
Maintenance Dashboard
     ↓
Repair Workflow

Admin
     ↓
Administrative Dashboard
     ↓
Asset / User / Location / Maintenance Management
```

The frontend should make the core workflows obvious without requiring users to understand the underlying cloud architecture.

---

# 2. Frontend Technology

Use:

```text
Next.js
React
TypeScript
Tailwind CSS
Azure
```

Recommended:

```text
Next.js App Router
```

Do not introduce:

- A second frontend framework
- Redux unless clearly necessary
- A separate Express server
- A separate API gateway
- A separate frontend backend service

---

# 3. Rendering Strategy

Use a mixture of:

```text
Server Components
Client Components
Server-side actions/handlers where appropriate
```

General rule:

### Server components

Prefer for:

- Data-heavy pages
- Initial page rendering
- Server-side authenticated data retrieval
- Static/semi-static content

### Client components

Use when browser interactivity is required:

- Forms
- Dropdowns
- Modals
- Tabs
- Filters
- Search interactions
- QR download/print
- File upload
- Interactive dashboards

Do not make the entire application a single client component.

---

# 4. Application Route Structure

Suggested route structure:

```text
app/
├── page.tsx
├── login/
│   └── page.tsx
│
├── asset/
│   └── [publicCode]/
│       └── page.tsx
│
├── dashboard/
│   └── page.tsx
│
├── assets/
│   ├── page.tsx
│   └── [id]/
│       └── page.tsx
│
├── maintenance/
│   ├── page.tsx
│   ├── new/
│   │   └── page.tsx
│   └── [id]/
│       └── page.tsx
│
├── admin/
│   ├── page.tsx
│   ├── assets/
│   │   ├── page.tsx
│   │   ├── new/
│   │   │   └── page.tsx
│   │   └── [id]/
│   │       └── edit/
│   │           └── page.tsx
│   ├── maintenance/
│   │   ├── page.tsx
│   │   └── [id]/
│   │       └── page.tsx
│   ├── buildings/
│   │   └── page.tsx
│   ├── users/
│   │   └── page.tsx
│   └── audit-logs/
│       └── page.tsx
│
└── technician/
    ├── page.tsx
    └── maintenance/
        ├── page.tsx
        └── [id]/
            └── page.tsx
```

The exact folder structure may be adjusted using Next.js route groups.

---

# 5. Route Groups

Use route groups where useful to separate layouts without changing URLs.

Example:

```text
app/
├── (public)/
│   └── asset/[publicCode]/
│
├── (auth)/
│   └── login/
│
└── (protected)/
    ├── dashboard/
    ├── assets/
    ├── maintenance/
    ├── admin/
    └── technician/
```

Do not create route groups purely for organization if they make the project harder to understand.

---

# 6. Global Layout

The protected application should use a common layout.

Example:

```text
┌────────────────────────────────────────────┐
│ Logo / App Name                  User ▼    │
├─────────────┬──────────────────────────────┤
│ Dashboard   │                              │
│ Assets      │          PAGE CONTENT        │
│ Maintenance │                              │
│ ...         │                              │
│             │                              │
│ Logout      │                              │
└─────────────┴──────────────────────────────┘
```

Desktop:

```text
Sidebar + content
```

Mobile:

```text
Top bar
+
Collapsible navigation
```

---

# 7. Public Layout

The QR asset page should not use the full admin sidebar.

Example:

```text
┌────────────────────────────┐
│ ANIKA / Asset Management   │
├────────────────────────────┤
│                            │
│      Asset Information     │
│                            │
└────────────────────────────┘
```

Keep it mobile-first.

---

# 8. Login Page

Recommended:

```text
┌─────────────────────────────┐
│                             │
│       APP LOGO / NAME       │
│                             │
│ Email                       │
│ [_______________________]   │
│                             │
│ Password                    │
│ [_______________________]   │
│                             │
│ [        Sign In        ]   │
│                             │
│ Error message               │
└─────────────────────────────┘
```

Do not overload the login page.

---

# 9. Dashboard Strategy

Use role-specific dashboards.

### Admin

Focus:

```text
Assets
Maintenance
Users
Locations
Audit
Metrics
```

### Technician

Focus:

```text
Assigned maintenance
Priority
Status
Recent work
```

### Member

Focus:

```text
My assets
My requests
Report problem
```

---

# 10. Admin Dashboard

Recommended metrics:

```text
┌────────────┐ ┌────────────┐ ┌────────────┐
│Total Assets│ │ Available  │ │ Assigned   │
│    142     │ │     91     │ │     32     │
└────────────┘ └────────────┘ └────────────┘

┌────────────┐ ┌────────────┐ ┌────────────┐
│Maintenance │ │ Damaged    │ │ Lost       │
│     12     │ │      5     │ │      2     │
└────────────┘ └────────────┘ └────────────┘
```

Below:

```text
Open Maintenance
Recent Assets
Recent Activity
```

Avoid excessive charts in the MVP.

---

# 11. Technician Dashboard

Example:

```text
My Maintenance Requests

┌───────────────────────────────────────┐
│ CRITICAL  Projector P-104             │
│ IN_PROGRESS                            │
│ MR-2026-0017                           │
└───────────────────────────────────────┘

┌───────────────────────────────────────┐
│ HIGH      Laptop L-204                │
│ ASSIGNED                              │
│ MR-2026-0018                           │
└───────────────────────────────────────┘
```

Prioritize actionable information.

---

# 12. Member Dashboard

Example:

```text
My Active Assets

Projector P-104
Vivekananda / VK404
Expected return: Today

My Maintenance Requests

MR-2026-0017
Projector P-104
IN_PROGRESS
```

Include:

```text
[Browse Assets]
[Report Problem]
```

---

# 13. Navigation Rules

Navigation should depend on role.

Admin:

```text
Dashboard
Assets
Maintenance
Buildings & Rooms
Users
Audit Logs
Profile
Logout
```

Technician:

```text
Dashboard
My Maintenance
Assets
Profile
Logout
```

Member:

```text
Dashboard
Assets
My Assignments
My Requests
Profile
Logout
```

Do not merely hide unauthorized pages. Route/API authorization protection remains required.

---

# 14. Asset List Page

Main sections:

```text
Assets
[Search........................]

Filters:
Status [▼]
Category [▼]
Building [▼]
Department [▼]

┌─────────────────────────────────────────────┐
│ Asset ID │ Name │ Location │ Status │ ... │
├─────────────────────────────────────────────┤
│ AST-001  │ P-104│ VY/VY001 │AVAILABLE│...│
│ AST-002  │ L-12 │ VK/VK404 │ASSIGNED │...│
└─────────────────────────────────────────────┘
```

Use pagination.

---

# 15. Asset Detail UI

Use clear sections.

```text
Asset Header
    ↓
Status
    ↓
Registered Location
    ↓
Asset Details
    ↓
Current Assignment
    ↓
QR Code
    ↓
Maintenance History
```

Actions depend on role.

---

# 16. Asset Create/Edit UI

Suggested sections:

```text
Basic Information
------------------
Name
Category
Serial Number
Department

Registered Location
-------------------
Building
Room

Purchase / Warranty
-------------------
Purchase Date
Warranty Until

Description
-----------
[........................]

Image
-----
[Upload]

[Cancel] [Save]
```

Use the reusable `BuildingRoomSelector`.

---

# 17. BuildingRoomSelector

This is a critical reusable component.

Props/concept:

```text
selectedBuildingId
selectedRoomId
onBuildingChange
onRoomChange
disabled
error
```

Behavior:

```text
No building:
Room disabled

Vyas selected:
Rooms = VY001, VY101, ...

Vivekananda selected:
Rooms = VK301, VK404, ...
```

When building changes:

```text
selectedRoomId = null
```

Then load/filter the correct rooms.

---

# 18. Asset Request UI

From an asset page:

```text
Request / Use Asset
```

Modal/page:

```text
Asset:
Projector P-104

Where will you use it?

Building:
[Vivekananda ▼]

Room:
[VK404 ▼]

Expected return:
[________]

Notes:
[________________]

[Cancel] [Submit Request]
```

After submission:

```text
Request successful.
```

The application must wait for server/database confirmation before displaying the final assignment state.

---

# 19. Report Problem UI

Example:

```text
Report a Problem

Asset:
Projector P-104

Problem description:
[___________________________]

Priority:
[HIGH ▼]

Photo:
[Choose File]

[Submit Report]
```

Reporter identity is automatically derived from the authenticated session.

---

# 20. Maintenance List UI

Columns:

```text
Request
Asset
Priority
Status
Technician
Created
Actions
```

Use badges:

```text
CRITICAL
HIGH
MEDIUM
LOW
```

and:

```text
OPEN
ASSIGNED
IN_PROGRESS
RESOLVED
CANCELLED
```

Avoid relying only on color.

---

# 21. Maintenance Detail UI

Recommended sections:

```text
Request Header
      ↓
Asset
      ↓
Problem
      ↓
Reporter
      ↓
Technician
      ↓
Status Controls
      ↓
Repair Notes
      ↓
Evidence
      ↓
Maintenance Timeline
```

---

# 22. Technician Workflow UI

For assigned requests:

```text
ASSIGNED

[Start Work]
```

After starting:

```text
IN_PROGRESS

[Add Note]
[Upload Evidence]
[Resolve]
```

Resolve form:

```text
Resolution Notes
[________________________]

Asset final state:
[AVAILABLE ▼]

[Resolve Maintenance]
```

The final state selection must be restricted to valid choices.

---

# 23. QR UI

Asset page:

```text
QR Code

[ QR IMAGE ]

AST-2026-00142

[Download]
[Print]
```

Admin only.

The QR URL is derived from:

```text
publicCode
```

---

# 24. QR Public Page

Mobile-first layout:

```text
┌──────────────────────┐
│      Asset           │
│                      │
│  Projector P-104     │
│  AST-2026-00142      │
│                      │
│  AVAILABLE           │
│                      │
│  Vyas / VY001        │
│                      │
│ [Request Asset]      │
│ [Report Problem]     │
└──────────────────────┘
```

If not authenticated:

```text
[Login to request/use]
```

---

# 25. Tables

Use tables for desktop administrative views.

For mobile, provide either:

- Responsive horizontal scrolling
- Card transformation
- Compact row layout

Do not make mobile users scroll through an unusably wide table.

---

# 26. Cards

Use cards for:

- Dashboard metrics
- Maintenance requests
- Asset summaries
- Mobile list views

Avoid turning every piece of information into a card.

---

# 27. Status Badges

Create a reusable:

```text
StatusBadge
```

Use consistent semantic labels.

Example:

```text
AVAILABLE
ASSIGNED
IN MAINTENANCE
DAMAGED
LOST
RETIRED
```

Color is supplementary.

Always include text.

---

# 28. Priority Badges

Create:

```text
PriorityBadge
```

Values:

```text
LOW
MEDIUM
HIGH
CRITICAL
```

Do not communicate priority using color alone.

---

# 29. Loading States

Every asynchronous page must have a loading state.

Examples:

```text
Loading assets...
Loading maintenance requests...
Loading asset...
```

Use skeletons where useful.

Avoid giant full-screen spinners for small operations.

---

# 30. Empty States

Examples:

### No assets

```text
No assets found.

Try changing your filters.
```

### No maintenance

```text
No maintenance requests.
```

### No assignments

```text
You have no active asset assignments.
```

Empty states should explain what the user can do next where appropriate.

---

# 31. Error States

Example:

```text
Unable to load assets.

[Try Again]
```

Do not show:

```text
PostgrestError: ...
```

directly to users.

Log technical details appropriately.

---

# 32. Toasts

Use concise feedback for completed actions.

Examples:

```text
Asset created successfully.
```

```text
Asset updated.
```

```text
Maintenance request created.
```

```text
Assignment created.
```

```text
File uploaded.
```

Avoid excessive toast notifications.

---

# 33. Confirmation Dialogs

Use confirmation for destructive/important actions.

Examples:

```text
Retire Asset
```

```text
Cancel Maintenance Request
```

```text
Delete permitted file
```

The confirmation must explain the consequence.

---

# 34. Forms

All forms should provide:

- Labels
- Validation
- Error messages
- Loading state
- Success feedback
- Disabled submit while processing

Do not rely on placeholder text as the only label.

---

# 35. Form Validation

Use a consistent schema-validation strategy.

A suitable library such as:

```text
Zod
```

may be used.

Use the same conceptual validation rules across:

```text
Client UX
Server validation
```

but remember:

> Client validation is not a security boundary.

---

# 36. State Management

Do not introduce Redux by default.

Use:

- React state
- URL/search params
- Server data fetching
- Server actions where appropriate
- Small context providers only where genuinely useful

Examples of local state:

```text
selectedBuilding
selectedRoom
modalOpen
formState
```

Examples of URL state:

```text
?status=AVAILABLE
?building=VY
?page=2
```

This makes filters shareable/bookmarkable.

---

# 37. Server Data vs Client State

Prefer:

```text
Database data
→ server fetch
→ render
```

rather than:

```text
Database
→ huge client state store
→ entire application
```

Use client state only for actual interaction.

---

# 38. Search/Filter Architecture

For assets:

```text
Search input
      ↓
URL query parameters
      ↓
Server/database query
      ↓
Paginated results
```

Example:

```text
/assets?search=projector&status=AVAILABLE&building=VY
```

This is preferable to downloading every asset and filtering in JavaScript.

---

# 39. Pagination Architecture

Use database pagination.

Conceptually:

```text
page
pageSize
offset/cursor
```

For the MVP, offset pagination is acceptable.

Example:

```text
page = 2
pageSize = 20
```

Do not fetch all records and slice them in the browser.

---

# 40. URL State

Useful URL parameters:

```text
search
status
category
building
department
page
sort
```

This allows:

- Browser back/forward
- Bookmarking
- Sharing filtered views

---

# 41. Dashboard Data

Dashboards should query only required metrics.

Example:

```text
COUNT assets WHERE status = AVAILABLE
COUNT assets WHERE status = ASSIGNED
COUNT assets WHERE status = IN_MAINTENANCE
```

Do not download all assets simply to count them in React.

---

# 42. API/Data Layer

Create a consistent application data-access layer.

Possible organization:

```text
src/lib/data/
├── assets.ts
├── assignments.ts
├── maintenance.ts
├── buildings.ts
├── rooms.ts
├── profiles.ts
├── documents.ts
└── audit.ts
```

Functions can include:

```text
getAsset()
listAssets()
getBuildings()
getRoomsByBuilding()
createAsset()
createAssignment()
createMaintenanceRequest()
```

The exact architecture may use server actions or route handlers instead.

The important requirement is consistency.

---

# 43. Do Not Create a Fake Backend

Do not create unnecessary wrappers such as:

```text
Frontend
 ↓
Next.js API route
 ↓
Azure
```

for every single database query.

For straightforward authorization-protected reads/writes, call the Prisma-backed data layer directly from a Server Component or a Next.js Route Handler.

Use server routes/actions when they add security or business logic.

---

# 44. Business Logic Placement

Examples:

### Simple read

```text
List buildings
→ Prisma/Postgres query
```

### Dependent rooms

```text
Get rooms for selected building
→ Prisma/Postgres query
```

### Sensitive assignment

```text
Request asset
→ secure server-side workflow
→ validate
→ create assignment
→ audit
```

### Maintenance resolution

```text
Resolve maintenance
→ secure workflow
→ validate technician
→ update request
→ history
→ asset state
→ audit
```

---

# 45. Frontend Security

The frontend must:

- Never expose secrets
- Never trust role values from URL/query strings
- Never trust client-provided user IDs
- Never assume hidden buttons are security
- Never bypass Route Handler authorization
- Never expose private storage paths unnecessarily

---

# 46. Responsive Design

Breakpoints should support:

```text
Mobile
Tablet
Desktop
```

Prioritize mobile for:

```text
QR page
Asset details
Request asset
Report problem
```

Prioritize desktop/tablet for:

```text
Admin dashboard
Asset management table
Maintenance management
Audit logs
```

---

# 47. Mobile QR Experience

This is a critical UX path.

Target:

```text
Scan QR
 ↓
Browser opens
 ↓
Asset loads quickly
 ↓
User understands status
 ↓
User sees available actions
```

Avoid forcing the user through multiple unnecessary screens before understanding the asset.

---

# 48. Accessibility

Implement:

- Semantic HTML
- Labels
- Keyboard support
- Focus states
- Accessible buttons
- Accessible dialogs
- Error messages associated with fields
- Text labels for statuses

Do not depend on:

```text
red = error
green = success
```

alone.

---

# 49. Design System

Use a small consistent design language.

Define:

```text
Typography
Spacing
Border radius
Buttons
Inputs
Cards
Tables
Badges
Dialogs
Navigation
```

Use Tailwind utilities/components consistently.

Do not create a huge custom design system for the MVP.

---

# 50. Visual Priority

The interface should prioritize:

```text
1. Asset identity
2. Status
3. Location
4. Primary action
5. Secondary details
```

For maintenance:

```text
1. Request
2. Asset
3. Priority
4. Status
5. Required action
6. History
```

---

# 51. Admin Asset Workflow UI

```text
Admin Dashboard
       ↓
Assets
       ↓
[Add Asset]
       ↓
Asset Form
       ↓
Create
       ↓
Asset Detail
       ↓
QR
```

Asset table should provide:

```text
View
Edit
Retire
```

where authorized.

---

# 52. Member Asset Workflow UI

```text
Assets
 ↓
Search
 ↓
Select asset
 ↓
View details
 ↓
Request / Use
 ↓
Building
 ↓
Room
 ↓
Submit
```

---

# 53. Member Maintenance Workflow UI

```text
Asset
 ↓
Report Problem
 ↓
Description
 ↓
Priority
 ↓
Optional photo
 ↓
Submit
 ↓
Request confirmation
```

---

# 54. Technician Workflow UI

```text
Technician Dashboard
 ↓
Assigned Request
 ↓
Details
 ↓
Start Work
 ↓
Add Notes
 ↓
Upload Evidence
 ↓
Resolve
 ↓
Asset Final State
 ↓
Complete
```

---

# 55. Admin Maintenance Workflow UI

```text
Admin Dashboard
 ↓
Maintenance
 ↓
Open Request
 ↓
Review
 ↓
Assign Technician
 ↓
Monitor
 ↓
Review Resolution
 ↓
Complete
```

---

# 56. File Upload UI

Use a reusable uploader.

Example:

```text
Upload evidence

Drag file here
or
[Choose File]

JPG / PNG / WEBP / PDF
Maximum 10 MB
```

Show:

```text
Uploading...
```

then:

```text
Uploaded
```

If failure:

```text
Upload failed
```

---

# 57. QR Download UI

Use:

```text
[Download QR]
[Print QR]
```

Do not require a server upload just to generate a QR.

The QR can be generated client-side from the stable URL.

---

# 58. Frontend Error Boundaries

Use appropriate Next.js error handling.

At minimum:

```text
error.tsx
not-found.tsx
loading.tsx
```

where appropriate for route segments.

Create a useful:

```text
Asset not found
```

page.

---

# 59. Not Found Pages

For invalid asset public ID:

```text
Asset Not Found

This QR code does not correspond to a registered asset.
```

For protected missing resources:

```text
Resource not found.
```

Do not leak whether a private record exists if the requester is unauthorized.

---

# 60. Performance Rules

Avoid:

- Large client bundles
- Unnecessary dependencies
- Giant JSON responses
- Repeated identical queries
- Unoptimized images
- Rendering thousands of rows
- Excessive polling

Use:

- Pagination
- Targeted queries
- Server rendering where appropriate
- Lazy loading
- Optimized assets

---

# 62. Offline Behavior

Offline functionality is not part of MVP.

If network connectivity is lost:

```text
Unable to connect.
Please check your connection and try again.
```

Do not create a local offline database unless explicitly requested later.

---

# 63. Notifications UI

If in-app notifications are implemented:

```text
Bell icon
   ↓
Notification list
```

Examples:

```text
Maintenance request assigned.
Maintenance request resolved.
```

This is optional.

---

# 64. Frontend Folder Organization

Suggested:

```text
src/
├── app/
├── components/
│   ├── ui/
│   ├── layout/
│   ├── assets/
│   ├── maintenance/
│   ├── qr/
│   ├── locations/
│   ├── assignments/
│   └── auth/
│
├── lib/
│   ├── Azure/
│   ├── auth/
│   ├── data/
│   ├── validation/
│   ├── storage/
│   └── utils/
│
├── types/
│   ├── database.ts
│   ├── assets.ts
│   ├── maintenance.ts
│   └── auth.ts
│
└── styles/
```

Exact organization may be adapted.

---

# 65. TypeScript Requirements

Do not use:

```text
any
```

for core application data unless unavoidable.

Define types for:

```text
Asset
Building
Room
Assignment
MaintenanceRequest
MaintenanceHistory
Profile
Document
AuditLog
```

Prefer Prisma's generated types over hand-written duplicates.

This helps keep database/application contracts aligned.

---

# 66. Prisma-Generated Types

Prisma auto-generates fully-typed models directly from `03-database-schema.md`'s `schema.prisma` — no separate codegen step is required.

Conceptually:

```text
schema.prisma
       ↓
npx prisma generate
       ↓
@prisma/client (typed models)
       ↓
Application
```

Import model types straight from `@prisma/client` (e.g. `import type { Asset, MaintenanceRequest } from "@prisma/client"`) instead of hand-maintaining parallel interfaces. This reduces mismatch between:

```text
Database
```

and:

```text
TypeScript
```

---

# 67. Component Reuse

Do not duplicate:

```text
Building dropdown
Room dropdown
Status badge
File uploader
Asset card
Maintenance status selector
```

Create reusable components.

But avoid over-abstracting components that are only used once.

---

# 68. Form Architecture

For complex forms, a form library such as React Hook Form may be used if useful.

Potential combination:

```text
React Hook Form
+
Zod
```

This is optional.

Do not introduce libraries unnecessarily.

---

# 69. Frontend Testing

Test at multiple levels.

### Unit

Useful for:

- Validation
- URL helpers
- Status transition helpers
- Formatting

### Component

Useful for:

- Forms
- BuildingRoomSelector
- Status badges
- File uploader

### Integration/E2E

Important workflows:

```text
Login
QR asset page
Request asset
Report maintenance
Technician resolves request
Admin creates asset
```

---

# 70. Frontend Security Testing

Test manually and/or automatically:

```text
Member opens /admin
→ denied

Member calls protected data operation
→ Route Handler authorization denies

Technician opens unrelated maintenance
→ denied

Public opens maintenance route
→ denied

Public opens QR asset
→ allowed safe data
```

---

# 71. Frontend Definition of Done

The frontend is complete when:

- Public QR page works.
- Login works.
- Logout works.
- Role-aware navigation works.
- Protected routes work.
- Admin dashboard works.
- Technician dashboard works.
- Member dashboard works.
- Asset list works.
- Asset detail works.
- Asset create/edit forms work.
- Building → room selector works.
- Asset request workflow works.
- Maintenance report workflow works.
- Maintenance processing UI works.
- QR generation/download/print works.
- File upload UI works.
- Loading/empty/error states exist.
- Mobile QR workflow is usable.
- Desktop admin workflow is usable.
- TypeScript types are consistent.
- No client-side secrets exist.
- Route Handler authorization remains the security boundary.

---

# Azure Implementation Alignment

This document is part of the Azure-native implementation of the system.

The application target is:

```text
Local development
      ↓
GitHub
      ↓
Azure Static Web Apps
      ↓
Next.js Route Handlers (app/api/.../route.ts, same app, no separate service)
      ↓
Azure Database for PostgreSQL Flexible Server (via Prisma)
      ↓
Azure Blob Storage
      +
Microsoft Entra ID
```

The existing functional requirements in this document remain authoritative. Only the cloud implementation boundary changes.

**Important:** Do not introduce Supabase, Vercel, Railway, or another cloud platform while implementing this document. This is a green-field build — there is no legacy UI, workflow, or business logic to preserve.
---

# Claude Code Execution Boundary

Claude Code implements application code and local project files. Azure resource creation, Azure Portal configuration, secrets, GitHub repository operations, commits/pushes, and deployment are performed by the human developer. Claude Code may provide exact manual instructions and configuration templates, but must not execute or claim completion of those operations.

