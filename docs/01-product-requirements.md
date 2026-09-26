# Product Requirements Document
## Cloud-Based Campus Asset QR & Maintenance Management System

> **Status:** Implementation-ready requirements specification  
> **Audience:** Claude Code / student development team  
> **Source of truth:** `docs/00-project-context.md` takes precedence for architectural decisions.

---

# 1. Product Goal

Build a cloud-based campus asset management application that connects physical institutional assets to digital cloud records using QR codes.

The system must allow a college to:

- Maintain a central asset inventory
- Give each asset a unique QR identity
- Let public users safely view asset information
- Let authenticated users request/use assets
- Record where an asset is being used
- Track assignments and transfers
- Report and manage maintenance problems
- Preserve maintenance history
- Store asset/repair documents
- Enforce role-based permissions
- Maintain an audit trail
- Demonstrate practical cloud computing concepts

The product should be useful as a real campus operations prototype while remaining simple enough for a student PBL.

---

# 2. Product Principles

Prioritize:

1. Reliability
2. Simplicity
3. Security
4. Clear user experience
5. Cloud demonstration value
6. Maintainability
7. Free-tier compatibility

Avoid implementing features merely because they are technically possible.

---

# 3. Functional Scope

## 3.1 MVP

The MVP must include:

### Authentication

- Login
- Logout
- Session handling
- Role-aware navigation
- Protected authenticated routes

### User roles

Exactly 3 authenticated roles, plus unauthenticated public QR visitors:

- Admin
- Technician
- Member (single merged role — replaces the earlier separate Student/Staff split; no workflow ever gave students and staff different permissions)
- Public user (unauthenticated, QR access only)

### Asset management

- Create asset
- View asset
- Edit asset
- Archive/retire asset
- Search assets
- Filter assets
- View asset status
- Assign asset
- Transfer asset
- View assignment history

### Location management

- Buildings
- Rooms
- Building → room relationship
- Registered asset location
- Temporary usage location
- Dependent building/room dropdown

### QR management

- Generate QR code
- Display QR
- Download QR
- Print QR
- Open asset page from QR

### Maintenance

- Report problem
- Create maintenance request
- Set priority
- Assign technician
- Update maintenance status
- Add repair notes
- Upload repair evidence
- Resolve request
- Preserve maintenance history

### Storage

- Asset images
- Maintenance images
- Maintenance documents

### Security

- Microsoft Entra ID
- API/Function authorization
- Role-based authorization
- Private file access
- Input/file validation

### Audit

Track important actions.

### Dashboard

Show core asset and maintenance metrics.

---

# 4. Optional Features

Only implement optional features after the MVP is stable.

**Deferred / explicitly out of scope for the 1-month MVP** (the user has decided not to build these now, not merely "optional"):

- Notifications (in-app or otherwise)
- Warranty-reminder automation
- Scheduled maintenance reminders
- Real-time/live dashboard updates (no push/streaming updates — dashboards load on request)

Possible future additions, lower priority, also not in MVP scope:

- Department/category analytics
- Most frequently repaired assets
- Asset utilization analytics

Optional features must never compromise the core MVP.

---

# 5. User Stories

## 5.1 Public User

### View an asset

As a public user, I want to scan an asset QR code and see safe information about the asset.

Acceptance criteria:

- QR opens a valid asset URL.
- Asset name is displayed.
- Public asset ID is displayed.
- Safe status information is displayed.
- Public location information is displayed where appropriate.
- No private information is exposed.
- Invalid QR/public ID produces a useful error page.

---

# 6. Member User Stories

## 6.1 Login

As a member, I want to log in so I can perform authenticated actions.

Acceptance criteria:

- Valid credentials create a session.
- Invalid credentials show an error.
- Authenticated users can access permitted routes.
- Logout ends the session.
- Unauthorized routes do not expose protected data.

---

## 6.2 Request an asset

As a member, I want to request an available asset for use.

Workflow:

```text
Scan QR
  ↓
View asset
  ↓
Request / Use Asset
  ↓
Select building
  ↓
Select room
  ↓
Submit request
```

Acceptance criteria:

- User must be authenticated.
- Asset must be eligible for requesting.
- Building must be selected.
- Room must be selected.
- Room must belong to selected building.
- Request is associated with the authenticated user.
- Usage location is recorded.
- Registered asset location is unchanged.
- User can see their own request afterward.

---

# 7. Location Requirements

## 7.1 Registered location

Every asset may have a registered/home location.

Example:

```text
Asset: Projector P-104
Building: Vyas
Room: VY001
```

This represents where the asset normally belongs.

---

## 7.2 Usage location

An assignment/request may have a different usage location.

Example:

```text
Asset: Projector P-104

Registered:
Vyas → VY001

Current use:
Vivekananda → VK404
```

The usage location must belong to the assignment/request, not overwrite the asset's registered location.

---

## 7.3 Dependent dropdown

The UI must use two dropdowns.

### Building

```text
[Vyas ▼]
[Vivekananda ▼]
...
```

### Room

The room list is derived from the selected building.

For Vyas:

```text
VY001
VY101
VY201
...
```

For Vivekananda:

```text
VK301
VK404
VK405
...
```

Rules:

- Room dropdown is disabled until building is selected.
- Changing building clears the room selection.
- Room options are fetched/filtered using the selected building.
- Client must not assume a room belongs to a building.
- Server/database validation must verify the relationship.
- Invalid building/room combinations must be rejected.

---

# 8. Asset Management Requirements

## 8.1 Create asset

Admin enters:

- Asset name
- Category
- Serial number
- Department
- Registered building
- Registered room
- Purchase date
- Warranty end date
- Description
- Optional image

System generates/stores:

- Internal database ID (UUID primary key — never shown to users)
- Public asset code (human-readable, e.g. `AST-2026-00142`) — this is the single identifier used everywhere: QR URL, UI display, and search
- Created timestamp
- Initial status

Default initial status:

```text
AVAILABLE
```

---

## 8.2 Edit asset

Admin can update appropriate asset information.

Every important update should be auditable.

---

## 8.3 Archive/retire

Do not prefer hard deletion for operational assets.

Use archival/retirement semantics.

A retired asset:

- Remains historically traceable.
- Should continue to have an identifiable record.
- Should not normally be requestable.
- QR page should communicate that the asset is retired where appropriate.

---

# 9. Asset Assignment Requirements

An assignment should record:

- Asset
- User
- Usage building
- Usage room
- Start time
- Expected return time, if applicable
- Actual return time
- Assignment status

Example:

```text
Asset:
AST-2026-00142

User:
Student A

Registered location:
Vyas → VY001

Usage location:
Vivekananda → VK404

Status:
ACTIVE
```

---

# 10. Asset Transfer Requirements

Transfer means changing who is responsible for the asset or moving the asset between operational ownership/locations.

The system must preserve history.

Do not overwrite historical assignment information.

A transfer should create a new assignment/transfer event rather than destroying the previous record.

---

# 11. Asset Status Requirements

Primary statuses:

```text
AVAILABLE
IN_USE
IN_MAINTENANCE
LOST
DAMAGED
RETIRED
```

The UI should not expose arbitrary free-text statuses.

Use a controlled enum/select.

Important rules:

- RETIRED, IN_MAINTENANCE, LOST, and DAMAGED assets are never directly requestable.
- A DAMAGED asset must go through the maintenance workflow rather than being manually toggled back to AVAILABLE. Reporting/confirming damage moves the asset to the maintenance pipeline, which resolves it to exactly one of:
  - `AVAILABLE` — repaired and returned to service, or
  - `RETIRED` — unrepairable (scrapped/disposed/decommissioned). `RETIRED` is the single terminal state; no separate "scrapped" status exists.
- AVAILABLE assets may be requested if other eligibility rules pass.
- ASSIGNED assets cannot normally be assigned to another user simultaneously.

---

# 12. Maintenance Requirements

## 12.1 Report problem

Authenticated users can report an issue against an asset.

Required information:

- Asset
- Problem description
- Priority

Optional:

- Photo
- Additional notes

The reporter identity comes from the authenticated session and must not be freely supplied by the client.

---

## 12.2 Maintenance assignment

Admin can assign a maintenance request to a technician.

The technician must be an authorized technician profile.

---

## 12.3 Maintenance status

Use:

```text
OPEN
ASSIGNED
IN_PROGRESS
RESOLVED
CANCELLED
```

Only permitted roles should change each state.

---

## 12.4 Resolution

Technician records:

- Resolution notes
- Repair evidence where appropriate
- Resolution timestamp

The system creates/preserves a maintenance history record.

If the asset was placed into maintenance, it should return to an appropriate operational status after resolution.

---

# 13. Dashboard Requirements

## Admin dashboard

Display:

- Total assets
- Available
- Assigned
- In maintenance
- Lost
- Damaged
- Retired
- Open maintenance requests
- Recently added assets
- Recently resolved maintenance

The dashboard should prioritize clarity over visual complexity.

---

## Technician dashboard

Display:

- Assigned maintenance requests
- Request priority
- Asset
- Location
- Status
- Recent maintenance activity

---

## Member dashboard

Display:

- Their active assignments
- Their requests
- Their reported problems
- Relevant asset information

---

# 14. Search and Filtering

Assets should support:

### Search

Search by:

- Asset ID
- Name
- Serial number
- Category

### Filters

At minimum:

- Status
- Category
- Department
- Building

Use pagination for large lists.

Do not load an unbounded number of assets into the browser.

---

# 15. QR Requirements

Each asset has a stable public QR identity.

Example:

```text
https://app.example.com/asset/AST-2026-00142
```

The QR must not contain:

- Passwords
- Private database information
- Personal information
- Maintenance notes
- Authentication tokens

Scanning only identifies the asset.

---

# 16. QR Page Requirements

Public page should show:

- Asset name
- Asset ID
- Safe status
- Department where appropriate
- Registered building/room where appropriate
- Public image where appropriate

Authenticated actions may include:

- Request/use asset
- Report problem

Actions must be role-aware.

---

# 17. Storage Requirements

Users with appropriate permissions can upload:

### Asset images

Associated with an asset.

### Maintenance images

Associated with a maintenance request.

### Maintenance documents

Associated with a maintenance request/history.

File validation must check:

- Allowed MIME types
- File size
- Authorization
- Safe naming/path strategy

---

# 18. Audit Requirements

Audit important operations.

Minimum events:

```text
LOGIN
ASSET_CREATED
ASSET_UPDATED
ASSET_ARCHIVED
ASSET_ASSIGNED
ASSET_TRANSFERRED
MAINTENANCE_CREATED
MAINTENANCE_ASSIGNED
MAINTENANCE_STATUS_CHANGED
MAINTENANCE_RESOLVED
USER_ROLE_CHANGED
```

The audit system should not allow ordinary users to alter historical audit entries.

---

# 19. Notifications

Notifications are deferred and explicitly out of scope for the 1-month MVP — not merely optional.

If implemented in a later phase, prefer simple in-app notifications or a scheduled Route Handler/Postgres job workflow.

Do not introduce paid SMS/email providers unless explicitly approved.

---

# 20. Error Handling

Every major operation needs clear error handling.

Examples:

### Invalid QR

```text
Asset not found.
```

### Unauthorized action

```text
You do not have permission to perform this action.
```

### Invalid location

```text
The selected room does not belong to the selected building.
```

### Asset unavailable

```text
This asset is currently unavailable.
```

### Upload failure

```text
The file could not be uploaded. Check the file type and size.
```

Do not expose database stack traces or secrets to users.

---

# 21. Loading and Empty States

Every data-driven page must account for:

- Loading
- Empty
- Error
- Success

Example:

```text
Loading assets...
```

Empty:

```text
No assets match your filters.
```

Error:

```text
Unable to load assets.
Try again.
```

---

# 22. Responsive Requirements

The application must work on:

- Desktop
- Tablet
- Mobile

The QR asset page should be designed mobile-first because users are likely to open it directly from a phone camera.

The admin dashboard can be desktop-oriented but must remain usable on smaller screens.

---

# 23. Accessibility Basics

Implement practical accessibility:

- Labels for form fields
- Keyboard-accessible controls
- Adequate contrast
- Clear focus states
- Meaningful button text
- Useful error messages
- Do not rely on color alone to communicate status

---

# 24. Performance Requirements

Prioritize:

- Server-side data fetching where appropriate
- Pagination
- Database indexes
- Avoiding unnecessary queries
- Avoiding huge client-side datasets
- Optimized images
- Lazy loading where useful

Do not add a complex caching infrastructure.

---

# 25. Security Requirements

The application must enforce:

```text
Authentication
    +
Authorization
    +
API/Function authorization
    +
Input validation
    +
Private storage
    +
Audit logging
```

Frontend checks are UX controls, not the final security boundary.

---

# 26. Cloud Requirements

The product must clearly demonstrate:

| Cloud concept | Product implementation |
|---|---|
| Cloud hosting | Azure Static Web Apps (hybrid Next.js SSR/API route support) |
| Cloud database | Azure Database for PostgreSQL Flexible Server |
| Authentication | Microsoft Entra ID via Auth.js (NextAuth) |
| Authorization | Next.js Route Handler authorization + Postgres Row-Level Security |
| Cloud storage | Azure Blob Storage |
| Backend compute | Next.js Route Handlers (one scheduled `pg_cron` job for retention — no separate Azure Functions project) |
| APIs | Next.js Route Handlers |
| Monitoring | Azure Static Web Apps/Azure logs |
| Scalability | Managed/stateless architecture |
| Backup/recovery | Azure Database for PostgreSQL Flexible Server automated backups (default; no deeper RPO/RTO design for MVP) |

---

# 27. Non-Functional Requirements

## Reliability

The application should fail gracefully if a cloud request fails.

## Security

No unauthorized user should access protected data.

## Maintainability

Code should be understandable to a student development team.

## Portability

Application should be deployable to Azure Static Web Apps with Azure.

## Cost

Core functionality must work within free-tier constraints.

## Scalability

Use pagination/indexes/stateless logic rather than premature infrastructure.

---

# 28. Definition of MVP Complete

MVP is complete when a demonstration can perform this sequence:

```text
Admin logs in
      ↓
Creates asset
      ↓
Assigns registered location
      ↓
Generates QR
      ↓
QR opens public asset page
      ↓
Member logs in
      ↓
Requests asset
      ↓
Selects Building
      ↓
Selects Room filtered by Building
      ↓
Assignment is created
      ↓
Asset becomes IN_USE
      ↓
Member reports problem
      ↓
Admin assigns technician
      ↓
Technician updates request
      ↓
Technician resolves request
      ↓
Maintenance history is stored
      ↓
Asset returns to appropriate status
      ↓
Audit log shows important actions
```

---

# 29. Explicit Out-of-Scope Items

Do not implement in the initial application:

- GPS tracking
- Automatic location detection
- Real-time physical asset tracking
- RFID integration
- IoT sensors
- AI/ML
- Predictive maintenance
- Blockchain
- Payments
- Chat
- Social features
- Native mobile apps
- Microservices
- Kubernetes
- Redis
- Kafka
- Separate Express backend

These can be future extensions but are not part of the current project.

---

# 30. Implementation Guidance

Claude Code should translate these requirements into:

- Pages/routes
- Components
- TypeScript types
- Database queries
- Server-side actions where appropriate
- Next.js Route Handlers where appropriate
- Validation schemas
- API/Function authorization-compatible data access
- Storage integration
- Tests

Do not implement requirements by bypassing API/Function authorization.

Do not place server-only privileged credential credentials in client code.

Do not hardcode building/room relationships into the UI when they belong in the database.

The requirements in this document must remain consistent with `00-project-context.md`.
---

# Azure Implementation Alignment

This document is part of the Azure-native implementation of the system.

The application target is:

```text
Local development
      ↓
GitHub
      ↓
Azure Static Web Apps (hybrid Next.js hosting)
      ↓
Next.js Route Handlers (TypeScript)
      ↓
Azure Database for PostgreSQL Flexible Server (via Prisma)
      ↓
Azure Blob Storage
      +
Microsoft Entra ID (via Auth.js)
```

This is a green-field build — there is no legacy application, UI, or workflow to preserve. The existing functional requirements in this document remain authoritative; only the cloud implementation boundary changes.

**Important:** Do not introduce Supabase, Vercel, Railway, or another cloud platform while implementing this document.
---

# Claude Code Execution Boundary

Claude Code implements application code and local project files. Azure resource creation, Azure Portal configuration, secrets, GitHub repository operations, commits/pushes, and deployment are performed by the human developer. Claude Code may provide exact manual instructions and configuration templates, but must not execute or claim completion of those operations.

