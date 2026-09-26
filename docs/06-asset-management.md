# Asset Management
## Cloud-Based Campus Asset QR & Maintenance Management System

> **Status:** Implementation-ready asset-management specification  
> **Audience:** Claude Code / student development team  
> **Source of truth:** `docs/00-project-context.md` through `docs/05-authentication.md`
>
> This document defines how physical campus assets are created, identified, displayed, assigned, transferred, searched, filtered, archived, and tracked.

---

# 1. Asset Management Goal

The asset module is the core of the application.

It creates the digital representation of a physical campus asset and connects that asset to:

- A stable asset identity
- A QR code
- A registered/home location
- A current operational status
- Users/assignments
- Maintenance history
- Documents/images
- Audit history

The central principle is:

> **The QR identifies the asset; the database manages the asset's lifecycle.**

---

# 2. Asset Lifecycle

The normal lifecycle is:

```text
Asset Created
     ↓
AVAILABLE
     ↓
IN_USE
     ↓
RETURNED
     ↓
AVAILABLE
```

Maintenance can interrupt the lifecycle:

```text
AVAILABLE
     ↓
IN_MAINTENANCE
     ↓
AVAILABLE
```

Other states:

```text
AVAILABLE
   ↓
DAMAGED

AVAILABLE / IN_USE
   ↓
LOST

AVAILABLE / DAMAGED / IN_MAINTENANCE
   ↓
RETIRED
```

The application must use controlled transitions rather than allowing arbitrary status changes.

---

# 3. Asset Data

Every asset should have, at minimum:

```text
Internal ID (UUID, not shown to users)
Public asset code
Name
Category
Serial Number
Department
Registered Building
Registered Room
Status
Purchase Date
Warranty Until
Description
Created By
Created At
Updated At
```

Example:

```text
Public asset code:
AST-2026-00142

Name:
Epson Projector P-104

Category:
Projector

Serial Number:
EP-ABC-12345

Department:
Computer Science

Registered Location:
Vyas → VY001

Status:
AVAILABLE

Warranty Until:
2028-01-15
```

---

# 4. Asset Identity

Every asset has exactly **two** identifiers — not three:

## Internal ID

An internal UUID primary key. Never shown to users.

Used only for foreign keys and internal joins/queries.

## Public asset code

A single human-readable identifier, generated once at creation and used consistently everywhere:

```text
AST-2026-00142
```

Used in:

- Admin tables
- Reports
- Asset labels
- Human communication
- The public QR URL
- Search

The public route is:

```text
/asset/[publicCode]
```

There is no separate third "Asset ID" concept — the public asset code is the only human-facing identifier. Do not expose the internal UUID unnecessarily.

---

# 5. Asset Creation

Only Admin can create assets.

The create form should include:

### Required

- Asset name
- Category
- Registered building
- Registered room

### Recommended

- Serial number
- Department
- Purchase date
- Warranty end date
- Description
- Image

The form must validate:

```text
Building selected
      ↓
Room selected
      ↓
Room belongs to building
```

The asset should initially be:

```text
AVAILABLE
```

unless the workflow explicitly requires another initial state.

---

# 6. Asset Creation Workflow

```text
Admin
 ↓
Assets
 ↓
Add Asset
 ↓
Fill form
 ↓
Select registered building
 ↓
Select registered room
 ↓
Validate location relationship
 ↓
Save asset
 ↓
Generate stable asset/public identifier
 ↓
Create audit record
 ↓
Show asset details
```

The QR can then be generated for the new asset.

---

# 7. Registered Location

Each asset has a permanent/normal location:

```text
registeredBuildingId
registeredRoomId
```

Example:

```text
Projector P-104
Registered:
Vyas → VY001
```

This is the asset's home/storage location.

It should not change simply because someone temporarily uses the asset elsewhere.

---

# 8. Temporary Usage Location

When an asset is assigned/requested, the assignment stores:

```text
usageBuildingId
usageRoomId
```

Example:

```text
Asset:
Projector P-104

Registered:
Vyas → VY001

Current use:
Vivekananda → VK404
```

This is one of the most important rules in the application.

Never overwrite:

```text
assets.registeredBuildingId
assets.registeredRoomId
```

just because an asset is being used elsewhere.

---

# 9. Building → Room Selector

Use two dependent dropdowns.

Example:

```text
Building:
[Vyas ▼]

Room:
[VY001 ▼]
[VY101 ▼]
[VY201 ▼]
```

If the building changes:

```text
Building:
[Vivekananda ▼]
```

then:

```text
Room:
[VK301 ▼]
[VK404 ▼]
[VK405 ▼]
```

Rules:

1. Room is disabled until building is selected.
2. Building selection determines room options.
3. Changing building resets the room.
4. Only active rooms should normally be selectable.
5. Backend validates room/building relationship.
6. Invalid combinations are rejected.

Create a reusable component for this because it will be used for:

- Asset registered location
- Asset usage location
- Other future campus-location forms

---

# 10. Asset Detail Page

The asset detail page should show clear sections.

Suggested layout:

```text
┌──────────────────────────────────────┐
│ Epson Projector P-104                │
│ AST-2026-00142                       │
│                                      │
│ Status: AVAILABLE                    │
├──────────────────────────────────────┤
│ REGISTERED LOCATION                  │
│ Vyas → VY001                         │
├──────────────────────────────────────┤
│ DETAILS                              │
│ Category: Projector                  │
│ Serial: EP-ABC-12345                 │
│ Department: Computer Science         │
│ Warranty: 15 Jan 2028                │
├──────────────────────────────────────┤
│ ACTIONS                              │
│ [Request / Use Asset]                │
│ [Report Problem]                     │
└──────────────────────────────────────┘
```

Admin may see additional controls.

---

# 11. Public Asset Page

Public QR users should see only safe information.

Suggested:

```text
Projector P-104
AST-2026-00142

Status:
AVAILABLE

Location:
Vyas → VY001

Category:
Projector
```

Potential public image may be displayed.

Do not show:

- Private maintenance notes
- Personal assignment information
- Private documents
- Internal audit records
- Sensitive serial numbers unless intentionally approved

---

# 12. Asset Image

An asset may have a primary image.

Recommended behavior:

- Upload from admin asset form
- Validate file type/size
- Store in Azure Blob Storage (single generic `attachments` container)
- Store metadata in the `attachments` table, linked to the asset
- Display optimized image

Do not store binary image data directly in the `assets` table.

---

# 13. Asset Editing

Admin can edit:

- Name
- Category
- Serial number
- Department
- Registered building
- Registered room
- Purchase date
- Warranty
- Description
- Image

When changing registered location:

```text
Old:
Vyas → VY001

New:
Vyas → VY101
```

create an audit event.

Do not alter historical assignment usage locations.

---

# 14. Location Change Rules

Changing an asset's registered location is different from moving it temporarily for use.

### Registered location change

Admin operation:

```text
Vyas → VY001
        ↓
Vyas → VY101
```

This changes the asset's home location.

### Temporary use

Assignment:

```text
Registered:
Vyas → VY001

Usage:
Vivekananda → VK404
```

This does not change the asset's home location.

The UI should make this distinction obvious.

---

# 15. Asset Status

Use the controlled statuses (matching the `asset_status` enum in `03-database-schema.md` §10 — "in use" is `IN_USE`, deliberately not `ASSIGNED`, which is a maintenance-request status):

```text
AVAILABLE
IN_USE
IN_MAINTENANCE
LOST
DAMAGED
RETIRED
```

Display statuses clearly and consistently.

Do not allow arbitrary free-text status values.

---

# 16. Status Transition Rules

Recommended transitions:

```text
AVAILABLE
   ├──→ IN_USE
   ├──→ IN_MAINTENANCE   (a reported problem takes the asset out of service)
   ├──→ DAMAGED
   ├──→ LOST
   └──→ RETIRED

IN_USE
   ├──→ AVAILABLE
   ├──→ IN_MAINTENANCE
   ├──→ LOST
   └──→ DAMAGED

DAMAGED
   └──→ IN_MAINTENANCE   (DAMAGED is never directly requestable or manually
                           flipped back to AVAILABLE — it must go through
                           the maintenance workflow)

IN_MAINTENANCE
   ├──→ AVAILABLE         (maintenance resolves: repaired)
   └──→ RETIRED           (maintenance resolves: unrepairable/scrapped)

LOST
   └──→ RETIRED / AVAILABLE only through authorized recovery workflow

RETIRED
   └──→ no normal operational transitions (row is permanently deleted 7
        days later by a daily pg_cron job — see 03-database-schema.md)
```

So the only path out of `DAMAGED` is through the maintenance workflow: `DAMAGED → IN_MAINTENANCE → (AVAILABLE | RETIRED)`. `RETIRED` remains the single terminal "scrapped/disposed/decommissioned" state — no separate status is needed for it.

The exact recovery flow can be simplified for the MVP, but arbitrary status editing must not be allowed for ordinary users.

---

# 17. Request Eligibility

An asset can normally be requested only when:

```text
status = AVAILABLE
```

It should not normally be requestable when:

```text
IN_MAINTENANCE
LOST
DAMAGED
RETIRED
```

A `DAMAGED` asset is never directly requestable, just like `IN_MAINTENANCE`/`LOST`/`RETIRED` — it must be routed through the maintenance workflow before it can become `AVAILABLE` again.

An already `ASSIGNED` asset should not receive another active assignment.

---

# 18. Request Asset Workflow

From the asset page:

```text
[Request / Use Asset]
```

opens a form.

Example:

```text
Asset:
Projector P-104

Registered:
Vyas → VY001

Where will you use it?

Building:
[Vivekananda ▼]

Room:
[VK404 ▼]

Expected return:
[Optional date/time]

Notes:
[Optional]

[Submit Request]
```

The user must be authenticated.

---

# 19. Request Validation

Before creating the assignment:

```text
1. User is authenticated.
2. User is active.
3. Asset exists.
4. Asset is requestable.
5. Building exists.
6. Room exists.
7. Room belongs to building.
8. No active assignment exists.
9. Create assignment.
10. Update asset status if required.
11. Create audit record.
```

This validation must not rely solely on browser code.

---

# 20. Assignment Record

An active assignment should contain:

```text
Asset
User
Usage Building
Usage Room
Status
Assigned At
Expected Return
```

Example:

```text
Projector P-104
Assigned to:
Student A

Usage:
Vivekananda → VK404

Status:
ACTIVE

Assigned:
14 Aug 2026 12:00
```

---

# 21. Returning an Asset

Provide an explicit return action where appropriate.

Example:

```text
[Return Asset]
```

Workflow:

```text
Active assignment
      ↓
Return
      ↓
returned_at = now()
status = RETURNED
      ↓
asset status = AVAILABLE
      ↓
audit event
```

Do not automatically change the registered location.

---

# 22. Transfer Workflow

A transfer means changing responsibility/assignment.

Example:

```text
Student A
   ↓
Student B
```

Do not overwrite the old assignment.

Instead:

```text
Assignment A
status = RETURNED / TRANSFERRED

Assignment B
status = ACTIVE
```

This preserves history.

Only authorized roles should perform transfers.

---

# 23. Asset History

Asset detail should expose a history section for authorized users.

Possible entries:

```text
14 Aug 2026
Assigned to Student A
Usage: Vivekananda / VK404

13 Aug 2026
Maintenance resolved

10 Aug 2026
Registered location changed
Vyas / VY001 → Vyas / VY101
```

History should be derived from assignments, maintenance, and audit records rather than stored as a manually edited text field.

---

# 24. Asset Search

The asset list must support search.

Search by:

```text
Public asset code
Name (required: free-text search, not just exact match)
Serial Number
Category
```

Free-text search by asset Name is a required capability, not just a structured filter — on Postgres this is straightforward via `ILIKE` or a text-search index, and should not be deferred or simplified away.

Example:

```text
Search:
[projector................]
```

Results:

```text
P-104 Projector
P-107 Projector
P-112 Projector
```

Do not load the entire asset database into the browser for search.

Use server/database queries.

---

# 25. Asset Filtering

Provide filters:

```text
Status
Category
Department
Building
```

Example:

```text
Status:
[AVAILABLE ▼]

Building:
[Vyas ▼]

Category:
[Projector ▼]
```

Filters should be composable.

---

# 26. Pagination

Asset lists must be paginated.

Example:

```text
Showing 1–20 of 142

[Previous] [1] [2] [3] ... [Next]
```

Do not fetch hundreds/thousands of records unnecessarily.

The exact page size may be adjusted based on UI.

---

# 27. Sorting

Useful sorting options:

```text
Name
Asset ID
Created date
Updated date
Status
Warranty date
```

Do not implement every possible sort if it complicates the UI.

Default sorting should be useful and predictable.

---

# 28. Admin Asset List

Recommended columns:

```text
Asset ID
Name
Category
Registered Location
Status
Department
Warranty
Actions
```

Example:

```text
AST-2026-00142
Projector P-104
Projector
Vyas / VY001
AVAILABLE
Computer Science
2028-01-15
[View]
```

---

# 29. Asset QR Management

Each asset must have QR controls.

Admin should be able to:

```text
View QR
Download QR
Print QR
```

The QR should encode:

```text
https://<production-domain>/asset/<publicCode>
```

The production domain should come from configuration rather than being hardcoded.

For local development, use the configured local/application base URL.

---

# 30. QR Generation

Use a maintained QR library compatible with Next.js.

The QR must:

- Be deterministic for the same public URL
- Be readable by standard phone cameras
- Have sufficient error correction
- Have adequate dimensions for printing
- Include a quiet zone
- Not include unnecessary information

---

# 31. QR Download

Provide a convenient download option.

Recommended:

```text
PNG
```

Optionally support:

```text
SVG
```

if the chosen library makes this simple and reliable.

Do not add complex PDF label generation unless required later.

---

# 32. QR Print View

A simple print-friendly layout may include:

```text
[QR CODE]

Projector P-104
AST-2026-00142
```

The printed QR should not include private data.

---

# 33. QR Stability

Once generated, an asset QR should remain valid even if:

- Registered room changes
- Department changes
- Asset status changes
- Asset is temporarily assigned elsewhere
- Asset is returned

The QR points to the asset identity, not to its current state.

---

# 34. QR Security

Scanning does not:

- Assign asset
- Move asset
- Change status
- Authenticate user
- Reveal private data

The user must explicitly perform an authorized action after scanning.

---

# 35. Asset Maintenance Integration

The asset page should provide:

```text
[Report Problem]
```

This should create a maintenance request associated with the asset.

Authorized users may also see:

```text
Maintenance History
```

The asset module should not duplicate maintenance records.

Use relationships.

---

# 36. Warranty Information

Show warranty information where relevant.

Example:

```text
Warranty:
Until 15 Jan 2028
```

If warranty has expired:

```text
Warranty:
Expired
```

Do not create a complex warranty management subsystem in the MVP.

---

# 37. Asset Dashboard Metrics

Admin dashboard should derive:

```text
Total Assets
Available
Assigned
In Maintenance
Damaged
Lost
Retired
```

Use database aggregation rather than fetching all assets and counting them in the browser.

---

# 38. Asset Category Handling

For the MVP, category can be a controlled text/select list.

Example:

```text
Projector
Laptop
Desktop
Camera
Oscilloscope
Arduino Kit
Raspberry Pi
Printer
Networking Equipment
Other
```

If categories become admin-managed later, create a separate table.

Do not prematurely build a category management subsystem.

---

# 39. Department Handling

Department may initially be a controlled text/select field.

Examples:

```text
Computer Science
Electronics
Mechanical
Civil
Administration
Library
```

The exact institutional department list should be configurable/seeded rather than deeply hardcoded into business logic.

---

# 40. Asset Form Validation

Validate:

### Name

- Required
- Reasonable maximum length

### Category

- Required
- Valid allowed value

### Serial

- Optional if not available
- Validate uniqueness if required

### Building

- Required where location is mandatory

### Room

- Required where location is mandatory
- Must belong to selected building

### Dates

- Valid dates
- Warranty date should not normally precede purchase date

### Description

- Reasonable maximum length

---

# 41. Asset Form UX

Use:

- Clear labels
- Inline validation
- Loading state
- Submit disabled while processing
- Success feedback
- Error feedback
- Confirmation for destructive actions

When building changes:

```text
Room selection resets
```

When editing an existing asset:

```text
Existing room remains selected
```

until building is intentionally changed.

---

# 42. Optimistic UI

Do not use aggressive optimistic updates for security-sensitive state transitions.

For example:

```text
Assign Asset
```

should wait for server/database confirmation before showing:

```text
IN_USE
```

This prevents UI/database disagreement.

---

# 43. Concurrency

Two users could attempt to request the same asset simultaneously.

The database/application must prevent:

```text
User A → ACTIVE assignment
User B → ACTIVE assignment
```

for the same asset.

The application now runs on real PostgreSQL, so this is a genuinely usable, correct mechanism (not a leftover from an earlier design):

- A **partial unique index** on the assignments table — e.g. a unique index on `assetId` filtered to `WHERE status = 'ACTIVE'` — that lets Postgres itself guarantee only one active assignment can exist per asset at a time. A second concurrent insert attempting to create another active assignment for the same asset fails at the database level, regardless of application-layer timing.
- Transactional logic where needed, wrapping the eligibility check and assignment insert in the same transaction.
- Final database validation — never trust client-side eligibility checks alone.

The partial unique index is the actual concurrency guarantee; application-layer checks are a UX convenience on top of it. The UI alone cannot solve concurrency.

---

# 44. Asset Deletion

Do not provide normal hard-delete UI for operational assets.

Instead:

```text
Retire Asset
```

Confirmation:

```text
Are you sure you want to retire this asset?

This will prevent future assignments while preserving its history.

[Cancel] [Retire Asset]
```

---

# 45. Asset Detail Permissions

### Public

Safe asset information.

### Member

Asset information needed to request/report.

### Technician

Asset information needed for maintenance.

### Admin

Full authorized asset information and management controls.

---

# 46. Asset Management Components

Suggested reusable components:

```text
AssetCard
AssetTable
AssetStatusBadge
AssetForm
AssetDetails
AssetLocationDisplay
BuildingRoomSelector
AssetSearch
AssetFilters
AssetHistory
AssetQRCode
QRCodeActions
AssignmentPanel
```

Names can be adjusted to match the project's actual component architecture.

---

# 47. Suggested Asset Routes

```text
/asset/[publicCode]
```

Public QR page.

```text
/assets
```

Authenticated asset list.

```text
/assets/[id]
```

Authenticated asset details.

```text
/admin/assets
```

Admin asset management.

```text
/admin/assets/new
```

Create asset.

```text
/admin/assets/[id]/edit
```

Edit asset.

The exact routing structure may use route groups, but URLs should remain intuitive.

---

# 48. Asset API/Data Operations

Prefer direct Next.js Route Handler queries protected by API/Function authorization for straightforward operations.

Potential operations:

```text
listAssets()
getAsset()
createAsset()
updateAsset()
retireAsset()
getAssetHistory()
searchAssets()
getAssetMetrics()
```

For sensitive workflows such as assignment/transfer/status transitions, use secure server-side workflow logic rather than trusting generic client updates.

---

# 49. Asset Audit Events

At minimum audit:

```text
ASSET_CREATED
ASSET_UPDATED
ASSET_REGISTERED_LOCATION_CHANGED
ASSET_ASSIGNED
ASSET_RETURNED
ASSET_TRANSFERRED
ASSET_STATUS_CHANGED
ASSET_RETIRED
QR_GENERATED
```

Avoid generating redundant audit records for harmless UI actions.

---

# 50. Asset Management Testing

Claude Code should test:

### Create

- Admin can create.
- Member cannot.
- Invalid building/room rejected.
- Duplicate public asset code rejected.

### View

- Public safe page works.
- Private fields remain protected.

### Edit

- Admin can edit.
- Member cannot.
- Location relationship remains valid.

### Request

- Available asset can be requested.
- Maintenance asset cannot.
- Retired asset cannot.
- Duplicate active assignment prevented.

### Return

- Active assignment can be returned.
- Asset becomes available.
- History preserved.

### Transfer

- Old assignment preserved.
- New assignment created.

### Retire

- Asset no longer requestable.
- History remains.

### QR

- QR opens correct asset.
- QR remains valid after location/status changes.

---

# 51. Asset Management Definition of Done

The asset module is complete when:

- Admin can create assets.
- Assets have stable IDs.
- Assets have QR identities.
- Assets have registered building/room.
- Building → room dropdown works.
- Invalid building/room combinations are rejected.
- Assets can be edited.
- Assets can be searched.
- Assets can be filtered.
- Assets can be paginated.
- Assets can be assigned.
- Assignment usage location is separate from registered location.
- Assets can be returned.
- Transfers preserve history.
- Asset status is controlled.
- Retired assets remain historically traceable.
- QR can be generated/downloaded/printed.
- QR public page works.
- Maintenance can be initiated from an asset.
- Important asset operations are audited.
- Concurrent assignment conflicts are prevented.
- Role/API/Function authorization restrictions work.

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

