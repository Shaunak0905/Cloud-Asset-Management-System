# QR Code System
## Cloud-Based Campus Asset QR & Maintenance Management System

> **Status:** Implementation-ready QR subsystem specification  
> **Audience:** Claude Code / student development team  
> **Source of truth:** `docs/00-project-context.md` through `docs/06-asset-management.md`
>
> The QR code is the bridge between the physical asset and its cloud-based digital record.

---

# 1. QR System Goal

Every managed physical asset must have a unique QR code.

The QR provides a simple physical-to-digital workflow:

```text
Physical Asset
      ↓
QR Sticker
      ↓
Phone Camera
      ↓
Asset URL
      ↓
Cloud Asset Record
```

The QR must be:

- Stable
- Unique
- Printable
- Scan-friendly
- Safe
- Independent of the asset's temporary usage location
- Independent of the asset's current status

---

# 2. Core QR Principle

The QR identifies **the asset**, not:

- The current user
- The current room
- The asset status
- The maintenance request
- The assignment
- The authentication session

Therefore:

> **Scanning a QR only identifies the physical asset. It does not perform an operational state change.**

---

# 3. QR URL

The QR should encode a URL such as:

```text
https://<production-domain>/asset/<publicCode>
```

Example:

```text
https://asset-campus.example.com/asset/AST-2026-00142
```

The actual production domain must come from configuration.

Do not hardcode the production domain throughout the codebase.

---

# 4. Public Asset Code

Every asset must have a stable, human-readable `publicCode`. This is the single public identifier used everywhere — QR URL, UI display, and search. It is one of exactly two identifiers on an asset (the other being the internal UUID primary key, which is never shown to users).

Example:

```text
AST-2026-00142
```

The QR uses:

```text
/asset/AST-2026-00142
```

The internal UUID primary key should not be exposed unnecessarily.

---

# 5. Public Asset Code Requirements

The `publicCode` must be:

- Unique
- Stable
- Non-null
- URL-safe
- Persisted with the asset
- Never casually changed

If the public asset code changes, previously printed QR codes would stop working.

Therefore:

> **Do not regenerate/change an asset's `publicCode` after QR issuance.**

---

# 6. QR Lifecycle

The intended lifecycle is:

```text
Admin creates asset
      ↓
Asset receives publicCode
      ↓
QR generated
      ↓
QR printed
      ↓
QR attached to physical asset
      ↓
Users scan QR
      ↓
Asset page opens
```

If the asset is edited:

```text
Name changed
Location changed
Status changed
Warranty changed
```

the QR remains valid.

---

# 7. QR Generation Timing

QR generation can occur:

### Option A — Immediately after asset creation

```text
Create asset
   ↓
Asset saved
   ↓
QR available
```

### Option B — On demand

```text
Asset exists
   ↓
Admin clicks Generate QR
   ↓
QR generated
```

Recommended implementation:

> Generate the QR on demand from the stable public URL, rather than storing a QR image permanently unless there is a real operational reason to do so.

This reduces unnecessary storage.

---

# 8. QR Does Not Need Database Storage

The QR image itself does not need to be stored in Postgres.

The database needs:

```text
publicCode
```

The application can generate:

```text
QR(public URL)
```

whenever the admin requests it.

If a permanent printable artifact is later required, the generated image can be downloaded/printed.

---

# 9. QR Generation Library

Use a maintained, lightweight QR-code package compatible with:

- React
- Next.js
- TypeScript

The exact npm package may be selected by Claude Code based on current compatibility.

Do not build a QR encoder manually.

---

# 10. QR Quality Requirements

Generated QR codes must:

- Be readable by normal smartphone cameras
- Have sufficient resolution
- Have a clear white/quiet border
- Use appropriate error correction
- Avoid unnecessary decorative elements
- Maintain sufficient contrast
- Remain scannable when printed

Do not place text, logos, gradients, or decorative overlays inside the QR unless testing confirms reliable scanning.

For the MVP, prioritize readability over aesthetics.

---

# 11. Recommended QR Output

Support:

```text
PNG
```

Optional:

```text
SVG
```

PNG is sufficient for the MVP.

If SVG is implemented, ensure the generated SVG is safe and renders correctly when printed.

---

# 12. QR Display

The asset management UI should provide a QR section.

Example:

```text
┌───────────────────────────────┐
│         QR CODE               │
│                               │
│       █ ███ █ ███ █           │
│       █ █   █ █   █           │
│       █ ███ █ ███ █           │
│                               │
│ AST-2026-00142                │
│                               │
│ [Download] [Print]            │
└───────────────────────────────┘
```

The QR should be visually separated from destructive controls.

---

# 13. QR Download

Admin should be able to download the QR.

Recommended behavior:

```text
[Download QR]
      ↓
PNG file
      ↓
asset-qr-AST-2026-00142.png
```

The filename should be deterministic and safe.

Do not include:

- user data
- access tokens
- private metadata

in the filename.

---

# 14. QR Print

Provide a simple print-friendly view.

Suggested printed label:

```text
┌────────────────────────────┐
│                            │
│          QR CODE           │
│                            │
│       AST-2026-00142       │
│       Projector P-104      │
│                            │
└────────────────────────────┘
```

The label may include:

- Asset ID
- Asset name

It must not include sensitive information.

---

# 15. QR Scanning

The application does NOT need to implement its own camera scanner for the MVP.

The user's normal phone camera can scan the QR.

Workflow:

```text
Phone Camera
    ↓
Recognizes QR URL
    ↓
Browser opens URL
    ↓
Next.js asset route
```

This is simpler and avoids unnecessary camera permissions and browser compatibility issues.

---

# 16. Optional In-App Scanner

An in-app camera scanner is explicitly optional.

Do not implement it in the initial MVP unless requested.

If added later, it must:

- Request camera permission clearly
- Work on mobile browsers
- Gracefully handle denied permission
- Open the detected asset URL
- Not bypass authentication
- Not modify asset state simply because scanning succeeded

---

# 17. Public Asset Route

The QR opens:

```text
/asset/[publicCode]
```

Example:

```text
/asset/AST-2026-00142
```

The route:

1. Receives public ID.
2. Validates it.
3. Queries safe asset information.
4. Handles missing assets.
5. Renders the public asset page.

---

# 18. Public Asset Query

Do not use:

```text
SELECT *
```

for the public QR page.

Return only safe fields.

Example:

```text
publicCode
name
category
status
department
registered building
registered room
public image
```

The exact safe-field list must remain consistent with the API/Function authorization/public-data design.

---

# 19. Invalid QR / Missing Asset

If the URL contains an unknown public ID:

```text
/asset/DOES-NOT-EXIST
```

show:

```text
Asset Not Found

The QR code does not correspond to a registered asset.

[Back to Home]
```

Do not show raw database errors.

---

# 20. Retired Asset QR

A retired asset may still have a valid QR.

The public page should show:

```text
Projector P-104

Status:
RETIRED

This asset is no longer available for use.
```

The QR should not suddenly become a broken link just because the asset was retired.

---

# 21. Lost Asset QR

A lost asset may still be accessible through its QR.

Example:

```text
Status:
LOST
```

Do not expose private investigation notes.

Do not allow normal users to request it.

---

# 22. Maintenance Asset QR

If:

```text
status = IN_MAINTENANCE
```

the public page may show:

```text
Status:
Currently under maintenance
```

but must not reveal:

- Technician identity
- Internal repair notes
- Private documents
- Internal maintenance comments

---

# 23. QR + Authentication

Public information:

```text
Scan
 ↓
Asset page
```

Protected actions:

```text
Request Asset
Report Problem
View private information
```

require authentication.

Example:

```text
Public user:
[Login to request/use asset]

Authenticated Member:
[Request / Use Asset]
[Report Problem]
```

---

# 24. QR + Role

Role controls what actions are available.

### Public

```text
View public asset
```

### Member

```text
View
Request/use
Report problem
```

### Technician

```text
View
Maintenance-related actions
```

### Admin

```text
View
Edit
Generate QR
Manage
```

The UI must not be the only authorization layer.

---

# 25. QR Request Workflow

Scanning alone does NOT create an assignment.

Correct:

```text
Scan
 ↓
Asset page
 ↓
Request / Use Asset
 ↓
Select Building
 ↓
Select Room
 ↓
Submit
 ↓
Server validation
 ↓
Assignment created
```

Incorrect:

```text
Scan
 ↓
Automatically assign asset
```

---

# 26. QR and Usage Location

The QR does not contain location information.

Example:

```text
QR
 ↓
P-104
```

Database:

```text
Registered:
Vyas → VY001
```

Assignment:

```text
Current use:
Vivekananda → VK404
```

The QR remains unchanged.

---

# 27. QR and Asset Movement

Suppose:

```text
Projector P-104
Registered:
Vyas → VY001
```

The projector moves to:

```text
Vivekananda → VK404
```

The QR does not change.

The assignment records:

```text
usageBuildingId = Vivekananda
usageRoomId = VK404
```

This is a core requirement.

---

# 28. QR Reprinting

If a QR sticker is damaged:

```text
Admin opens asset
      ↓
QR
      ↓
Print again
```

The regenerated QR must encode the same public URL.

Do not generate a new public ID simply because a QR sticker is being reprinted.

---

# 29. QR Replacement

The correct replacement workflow is:

```text
Existing public ID
        ↓
Same URL
        ↓
New QR image
        ↓
New physical sticker
```

This preserves historical links and previously printed references.

---

# 30. QR URL Stability

The following must continue to work after ordinary asset changes:

```text
/asset/AST-2026-00142
```

even when:

```text
Name changes
Registered location changes
Department changes
Status changes
Warranty changes
Assignments change
Maintenance occurs
```

---

# 31. QR Public URL and Deployment

Use environment/configuration for the base URL.

Conceptually:

```text
APP_BASE_URL
```

or the appropriate Next.js/Azure Static Web Apps production URL configuration.

Do not hardcode:

```text
localhost:3000
```

into generated QR codes in production.

For local development, generated URLs may use the configured local application origin.

---

# 32. QR Generation Architecture

Recommended:

```text
Asset record
   ↓
publicCode
   ↓
buildPublicAssetUrl(publicCode)
   ↓
QR generation component
   ↓
PNG/SVG output
```

Create a reusable URL helper.

Example conceptual function:

```text
getAssetPublicUrl(publicCode)
```

This prevents different parts of the application from constructing inconsistent URLs.

---

# 33. QR Component Architecture

Suggested components:

```text
AssetQRCode
QRCodePreview
QRCodeDownloadButton
QRCodePrintButton
```

Suggested utility:

```text
getAssetPublicUrl()
```

The exact file structure may differ.

---

# 34. QR State

The QR component should not maintain a separate persistent "QR status".

The QR is derived from:

```text
asset.publicCode
```

If the asset exists and has a valid public asset code:

```text
QR can be generated
```

---

# 35. QR Error Handling

Handle:

```text
Missing public ID
Invalid public ID
QR library failure
Download failure
Print failure
Asset not found
```

User-facing errors should be simple.

Example:

```text
Unable to generate QR code.
Please try again.
```

Do not show stack traces.

---

# 36. QR Audit Events

Recommended audit events:

```text
QR_GENERATED
QR_DOWNLOADED
QR_PRINTED
```

However, avoid excessive auditing of harmless repeated downloads if it creates noisy logs.

At minimum, generating/issuing a QR can be audited if the project wants an issuance history.

---

# 37. QR Security Requirements

The QR system must never:

- Store secrets
- Store passwords
- Store access tokens
- Store server-only privileged credential keys
- Automatically authenticate users
- Automatically assign assets
- Automatically move assets
- Automatically change asset status
- Expose private maintenance data

---

# 38. QR Privacy

Anyone who physically sees/scans a QR may access its public page.

Therefore, public QR information must be intentionally limited.

Do not rely on the QR being hidden as a security mechanism.

---

# 39. QR Testing

Claude Code must test:

### Generation

- QR generates for valid asset.
- QR contains correct public URL.
- Same asset produces same URL.

### Scanning

- Standard phone camera opens the URL.
- Public asset page loads.
- Invalid ID produces useful error.

### Stability

After:

```text
Location change
Status change
Assignment
Return
Maintenance
```

the same QR still opens the same asset.

### Security

Public QR cannot expose:

- Private maintenance
- User assignment details
- Audit logs
- Private documents

### Permissions

Protected actions require appropriate authentication/role.

### Download

PNG downloads correctly.

### Print

Print view renders correctly.

---

# 40. QR Acceptance Scenarios

## Scenario A — Normal asset

```text
Asset:
Projector P-104
Status:
AVAILABLE

Scan
 ↓
Asset page
 ↓
Shows:
Projector P-104
AVAILABLE
Vyas / VY001
```

---

## Scenario B — Asset temporarily elsewhere

```text
Registered:
Vyas / VY001

Current usage:
Vivekananda / VK404
```

Scan:

```text
Same QR
 ↓
Same asset
```

The QR does not change.

---

## Scenario C — Asset under maintenance

```text
Scan
 ↓
Asset page
 ↓
Status = IN_MAINTENANCE
```

Request action is unavailable.

---

## Scenario D — Asset retired

```text
Scan
 ↓
Asset page
 ↓
Status = RETIRED
```

QR remains valid.

---

## Scenario E — Reprinted sticker

```text
Old QR damaged
 ↓
Admin opens asset
 ↓
Print QR
 ↓
New sticker
 ↓
Same public URL
```

---

# 41. QR Definition of Done

The QR subsystem is complete when:

- Every asset has a stable public ID.
- Public URL construction is centralized.
- QR can be generated from the public ID.
- QR opens the correct asset page.
- QR does not contain secrets.
- Public asset data is intentionally limited.
- Protected actions require authentication.
- QR remains stable across asset changes.
- QR can be downloaded.
- QR can be printed.
- Reprinting does not create a new asset identity.
- Retired/lost/maintenance assets retain working QR pages.
- QR scanning does not automatically mutate asset state.
- QR-related errors are handled cleanly.
- QR behavior is tested on normal smartphone scanning.

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

