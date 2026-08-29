# Storage & File Management
## Cloud-Based Campus Asset QR & Maintenance Management System

> **Status:** Implementation-ready Azure Blob Storage specification
> **Storage:** Azure Blob Storage (single generic `attachments` container)
> **Metadata:** Azure Database for PostgreSQL Flexible Server (via Prisma)
> **Security:** Next.js Route Handler authorization + private Blob container by default

---

# 1. Storage Goal

The storage system must support:

- Asset images
- Maintenance photographs
- Repair evidence
- Service reports
- Maintenance documents
- Future asset-related documents

Files must be:

- Organized
- Secure
- Associated with the correct record
- Accessible only to authorized users where appropriate
- Stored without exposing storage credentials

---

# 2. Storage Architecture

```text
Next.js Application
       ↓
Microsoft Entra ID (via Auth.js)
       ↓
Next.js Route Handler authorization
       ↓
Azure Blob Storage
       ↓
Private Blob object
```

Metadata:

```text
Blob Storage
    ↓
container + blob name
    ↓
attachments row
    ↓
Postgres (via Prisma)
```

The database stores the reference.

Blob Storage stores the binary file.

---

# 3. One Generic Blob Container

Do not split storage into per-purpose containers (e.g. separate `asset-images` / `maintenance-images` / `maintenance-documents` containers). Use **one** generic container:

```text
attachments
```

Every uploaded file — asset image, maintenance photo, service report, or any future document type — lands in this single container. What the file is *for* is expressed by the linked database row (the `attachments` table — see `03-database-schema.md`), not by which container it was uploaded into.

Each `attachments` row links to **exactly one** of:

- an asset, or
- a maintenance request

never both, never neither.

Keep the container private by default. Individual attachments can be marked public — see §7.

---

# 4. Attachment Path

Purpose:

Store any file (asset image, maintenance photo, service report, etc.) associated with either an asset or a maintenance request.

Suggested path, generic regardless of what the file is attached to:

```text
attachments/<uuid>.<safe-extension>
```

Do not use the original filename as the authoritative blob name. Do not encode the asset ID, maintenance request ID, or file purpose into the blob path — that information lives in the `attachments` table row, not the path.

---

# 5. Private By Default, With an Explicit Public Flag

QR pages are public.

Maintenance records may contain:

- Technician information
- Internal repair notes
- Service documents
- Institutional information
- Private images

Therefore:

```text
Public QR asset information
       ≠
Private Blob Storage
```

Every attachment is private by default. An attachment is exposed on the public QR page only when it is explicitly marked with an `isPublic = true` flag (see §7) — nothing is public by virtue of which container it happens to sit in, since there is only one container.

---

# 6. Public Asset Images — Serving Mechanism

If the public QR page genuinely requires an image, expose only a deliberately selected asset image — never a maintenance attachment.

Concrete mechanism (replaces any earlier vague "short-lived access mechanism" framing):

- The chosen attachment's row has `isPublic = true`.
- Public delivery goes through a dedicated public Route Handler endpoint, e.g.:

```text
GET /api/attachments/[id]/public
```

- That endpoint:
  1. Looks up the attachment by ID.
  2. Checks `isPublic === true`. If not public, returns 404 (do not leak existence of private attachments).
  3. Streams the blob content back to the client, or issues a short-lived redirect to a freshly generated short-lived SAS URL.
- **Never** permanently store a long-lived SAS URL as the attachment's public identity — the flag-and-endpoint pattern above is the only sanctioned way to serve a public attachment. The "no permanent SAS storage" principle from §12 applies here too.

---

# 7. File Metadata Table

Store metadata in the `attachments` table in Postgres (see `03-database-schema.md` for the full schema):

```text
id
assetId           (nullable)
maintenanceRequestId (nullable)
uploadedBy
blobContainer
blobName
originalFilename
mimeType
fileSizeBytes
isPublic
createdAt
```

Exactly one of `assetId` / `maintenanceRequestId` must be set — never both, never neither.

Binary contents must not be stored in Postgres.

---

# 8. Asset vs Maintenance Attachment

### Asset

```text
assetId = asset
maintenanceRequestId = null
```

Example:

```text
Projector photo
```

### Maintenance

```text
assetId = null
maintenanceRequestId = request
```

Example:

```text
Repair photograph
```

---

# 9. Upload Flow

```text
User selects file
       ↓
Frontend validates basic UX constraints
       ↓
Next.js Route Handler receives authenticated request
       ↓
Validate identity + role + target record
       ↓
Validate file metadata
       ↓
Generate safe blob name
       ↓
Upload to the single private attachments Blob container
       ↓
Write metadata row to Postgres (attachments table)
       ↓
Create audit event
       ↓
Return file metadata
```

Do not trust client-provided storage paths.

---

# 10. File Validation

Validate server-side:

```text
Allowed MIME types
Allowed extensions
Maximum file size
Filename length
Target asset/request
User authorization
```

Do not rely solely on the extension.

---

# 11. Blob Naming

Do not use:

```text
original-file-name.pdf
```

as the authoritative blob path.

Prefer generated names:

```text
<uuid>.<safe-extension>
```

or another collision-resistant strategy. This applies uniformly to every attachment in the single `attachments` container, regardless of whether it's an asset image or a maintenance document.

---

# 12. Authorized Downloads

For **private** attachments:

```text
User
 ↓
Next.js Route Handler
 ↓
Check authentication
 ↓
Check authorization
 ↓
Locate metadata (attachments row)
 ↓
Generate short-lived Blob access
 ↓
Browser receives temporary access
```

Do not expose Storage Account Keys.

Do not permanently store temporary SAS URLs as file identity — generate them on demand per request.

For **public** attachments (`isPublic = true`), use the dedicated public endpoint described in §6 instead — a normal unauthenticated `GET` to `/api/attachments/[id]/public`, not a stored SAS URL.

---

# 13. File Deletion

Deleting a file requires:

1. Authentication.
2. Authorization.
3. Locate metadata.
4. Delete Blob.
5. Delete/update the `attachments` row according to retention policy.
6. Create audit event.

If Blob deletion succeeds but metadata cleanup fails, the workflow must be retryable and observable.

---

# 14. Storage Limits

Do not hardcode cloud pricing or quota claims.

Keep file limits configurable. Since every attachment shares one container/table, limits can be expressed generically by file category rather than by the old per-container split:

```text
MAX_IMAGE_BYTES
MAX_DOCUMENT_BYTES
```

---

# 15. Secrets

Never expose:

```text
Storage Account Key
Connection String
SAS signing secret
```

to browser code.

Use managed identity or server-side credentials where supported.

---

# 16. Definition of Done

Storage is complete when:

- Asset images upload successfully.
- Maintenance evidence uploads successfully.
- All attachments go through the single `attachments` container/table, linked to exactly one of an asset or a maintenance request.
- Files are private by default; only attachments explicitly flagged `isPublic = true` are publicly reachable.
- Public attachments are served through `GET /api/attachments/[id]/public`, not permanently stored SAS URLs.
- Metadata is stored in Postgres.
- Blob names are generated safely.
- Private downloads require authorization and use short-lived access.
- Public pages cannot access private attachments.
- Temporary access expires.
- Storage credentials never reach the browser.
- Upload/delete actions are audited.
---

# Claude Code Execution Boundary

Claude Code implements application code and local project files. Azure resource creation, Azure Portal configuration, secrets, GitHub repository operations, commits/pushes, and deployment are performed by the human developer. Claude Code may provide exact manual instructions and configuration templates, but must not execute or claim completion of those operations.

