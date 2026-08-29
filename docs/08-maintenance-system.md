# Maintenance Management System
## Cloud-Based Campus Asset QR & Maintenance Management System

> **Status:** Implementation-ready maintenance subsystem specification  
> **Audience:** Claude Code / student development team  
> **Source of truth:** `docs/00-project-context.md` through `docs/07-qr-system.md`
>
> This document defines the complete maintenance workflow from problem reporting through technician assignment, repair, resolution, history, and asset-state recovery.

---

# 1. Maintenance Goal

The maintenance module connects physical asset problems to a controlled digital workflow.

Core lifecycle:

```text
Asset
  ↓
Problem Report
  ↓
Maintenance Request
  ↓
Technician Assignment
  ↓
Diagnosis
  ↓
Repair
  ↓
Resolution
  ↓
Maintenance History
  ↓
Asset Operational Again
```

The system must preserve the history of repairs instead of simply overwriting the current asset state.

---

# 2. Who Can Report a Problem?

Authenticated:

```text
MEMBER
TECHNICIAN
ADMIN
```

may report a problem if the application workflow permits the role.

For the standard MVP:

- Member: Yes
- Technician: Yes
- Admin: Yes

Public/anonymous users:

```text
No
```

A public QR page may display a:

```text
Login to report a problem
```

action.

---

# 3. Starting a Maintenance Report

A user can report a problem from:

```text
Asset public/detail page
```

Example:

```text
Projector P-104
AST-2026-00142

[Report Problem]
```

The system already knows the asset.

The user should not need to manually enter an asset ID.

---

# 4. Maintenance Report Form

Required:

```text
Problem description
Priority
```

Optional:

```text
Photo
Additional notes
```

Example:

```text
Asset:
Projector P-104

Problem:
Projector powers on but displays no image.

Priority:
HIGH

Photo:
[Upload]

[Submit Report]
```

---

# 5. Reporter Identity

The reporter must come from the authenticated session.

Correct:

```text
authenticated Entra ID user ID
      ↓
users.id
      ↓
maintenanceRequests.reportedBy
```

Never trust:

```text
reportedBy
```

from a browser form.

---

# 6. Maintenance Request Creation

When the report is submitted:

```text
1. Verify authentication.
2. Verify active user.
3. Verify asset exists.
4. Validate description.
5. Validate priority.
6. Create maintenance request.
7. Set status = OPEN.
8. Create audit event.
9. Optionally update asset status.
10. Show confirmation.
```

---

# 7. Initial Maintenance Status

Every new request starts as:

```text
OPEN
```

Example:

```text
MR-2026-0017

Asset:
AST-2026-00142

Priority:
HIGH

Status:
OPEN
```

Do not allow the user to create a request directly as:

```text
RESOLVED
```

or:

```text
IN_PROGRESS
```

---

# 8. Maintenance Request Number

Every request should have a human-readable identifier.

Example:

```text
MR-2026-0017
```

This is useful for:

- Admin communication
- Technician communication
- Dashboards
- Reports
- Audit records

The database UUID remains the internal identifier.

---

# 9. Maintenance Priority

Use:

```text
LOW
MEDIUM
HIGH
CRITICAL
```

Suggested meaning:

### LOW

Minor issue that does not significantly affect use.

### MEDIUM

Issue affects functionality but work may continue or workaround exists.

### HIGH

Asset is significantly impaired and should be repaired soon.

### CRITICAL

Asset is unusable or presents an important operational/safety concern.

The application should not automatically infer priority from free text.

---

# 10. Asset State When Maintenance Is Reported

This is the actual, decided behavior — not one of several options:

> **Reporting a maintenance issue immediately sets the asset's status to `IN_MAINTENANCE`, as soon as the maintenance request is created — not just when a technician starts working on it.**

```text
Member/Technician/Admin reports a problem
      ↓
Maintenance request created (status = OPEN)
      ↓
Asset status = IN_MAINTENANCE   (immediately, in the same operation)
      ↓
Asset removed from the available pool — no new requests/assignments possible
```

This is a deliberate simplification for the MVP: there is no intermediate "reported but still in service" state. The moment a problem is reported, the asset is presumed out of service until the maintenance workflow resolves it (to `AVAILABLE` or `RETIRED`). This keeps the request-eligibility rule simple (`AVAILABLE` is the only requestable status) and avoids a second asset-level flag to track "is this actually out of service yet."

---

# 11. Maintenance Status Lifecycle

Primary workflow:

```text
OPEN
 ↓
ASSIGNED
 ↓
IN_PROGRESS
 ↓
RESOLVED
```

Cancellation:

```text
OPEN → CANCELLED
ASSIGNED → CANCELLED
```

Do not permit arbitrary transitions.

---

# 12. Status Meanings

## OPEN

Problem has been reported but no technician has been assigned.

## ASSIGNED

A technician has been assigned.

## IN_PROGRESS

Technician is actively working on the issue.

## RESOLVED

Repair/work is complete and the request has been closed successfully.

## CANCELLED

Request was cancelled by an authorized user.

---

# 13. Admin Maintenance Dashboard

Admin should see:

```text
Open
Assigned
In Progress
Resolved
Cancelled
```

Useful summary cards:

```text
Open Requests
High Priority
Critical
In Progress
Resolved This Month
```

The MVP should avoid overly complex analytics.

---

# 14. Technician Dashboard

Technician should see:

```text
My Assigned Requests
```

with:

```text
Request Number
Asset
Priority
Status
Reported Date
Location
```

Example:

```text
MR-2026-0017
Projector P-104
HIGH
ASSIGNED
14 Aug 2026
Vyas / VY001
```

---

# 15. Maintenance Request Detail

Suggested layout:

```text
┌──────────────────────────────────────┐
│ MR-2026-0017                         │
│ Projector P-104                      │
│                                      │
│ Priority: HIGH                      │
│ Status: IN_PROGRESS                 │
├──────────────────────────────────────┤
│ REPORTED BY                          │
│ Student A                            │
├──────────────────────────────────────┤
│ PROBLEM                              │
│ Projector powers on but...           │
├──────────────────────────────────────┤
│ TECHNICIAN                           │
│ Technician B                         │
├──────────────────────────────────────┤
│ REPAIR                               │
│ Replace HDMI interface...            │
├──────────────────────────────────────┤
│ [Update Status] [Resolve]            │
└──────────────────────────────────────┘
```

Sensitive fields should be role-restricted.

---

# 16. Technician Assignment

Admin selects a technician.

Example:

```text
Assign Technician

[Technician B ▼]

[Assign]
```

The dropdown should contain only users whose:

```text
role = TECHNICIAN
isActive = true
```

The client must not be allowed to assign arbitrary user IDs without server-side validation.

---

# 17. Assignment Workflow

```text
OPEN
 ↓
Admin selects technician
 ↓
assignedTo = technician
 ↓
status = ASSIGNED
 ↓
assignedAt = now()
 ↓
Audit event
```

---

# 18. Technician Starting Work

Technician opens the request:

```text
[Start Work]
```

Workflow:

```text
ASSIGNED
 ↓
IN_PROGRESS
 ↓
updatedAt = now()
 ↓
Audit event
```

Only the assigned technician or authorized Admin should perform this transition.

---

# 19. Repair Notes

During repair, technician may add:

```text
Diagnosis
Repair notes
Parts replaced
Testing notes
Additional comments
```

For the MVP these can be represented through:

- `maintenance_history.notes`
- `maintenance_requests.resolution_notes`

Do not create a large multi-table repair system unless required.

---

# 20. Maintenance History

History should be append-oriented.

Example:

```text
14 Aug 2026 12:10
INSPECTION
Technician B
Found damaged HDMI interface.

14 Aug 2026 13:20
PART_REPLACEMENT
Technician B
HDMI interface replaced.

14 Aug 2026 14:00
TESTING
Technician B
Projector tested successfully.

14 Aug 2026 14:05
RESOLUTION
Technician B
Asset returned to operational state.
```

This gives the asset a useful repair history.

---

# 21. History and Current Request

The current maintenance request represents:

```text
What is happening now?
```

Maintenance history represents:

```text
What happened during the lifecycle of this maintenance event?
```

Do not replace the history with the latest request row.

---

# 22. Maintenance Evidence

Technicians may upload:

```text
Repair photo
Before/after image
Service report
Replacement-part documentation
```

Files belong in Azure Blob Storage (the single generic `attachments` container).

Metadata belongs in:

```text
attachments
```

linked to:

```text
maintenanceRequestId
```

---

# 23. File Upload Workflow

```text
Technician
 ↓
Select file
 ↓
Authentication check
 ↓
Authorization check
 ↓
Validate MIME type
 ↓
Validate size
 ↓
Upload to private Storage bucket
 ↓
Create attachments record
```

If upload fails:

```text
Do not create a fake database metadata row.
```

---

# 24. Allowed Maintenance File Types

Recommended MVP:

### Images

```text
image/jpeg
image/png
image/webp
```

### Documents

```text
application/pdf
```

Additional formats may be added later if institutionally required.

Do not accept arbitrary executable file types.

---

# 25. File Size

Define a reasonable maximum.

Example MVP policy:

```text
10 MB per file
```

The exact limit may be adjusted according to Azure/storage constraints.

The UI should tell users the accepted file types and size limit.

---

# 26. Resolving Maintenance

Only the assigned technician or Admin should normally resolve a request.

Resolution requires:

```text
Resolution notes
```

Optionally:

```text
Evidence
Parts replaced
```

The system then:

```text
status = RESOLVED
resolvedAt = now()
```

and creates maintenance history.

---

# 27. Asset Status After Resolution

A maintenance request (whether the asset entered maintenance as `DAMAGED` or was placed into `IN_MAINTENANCE` directly by a problem report) resolves the asset to exactly one of two terminal outcomes:

```text
Repair successful
→ AVAILABLE

Asset beyond repair (unrepairable / "scrapped")
→ RETIRED
```

Do not blindly mark every resolved request as `AVAILABLE` — the technician/admin must explicitly choose the outcome.

When an asset is set to `RETIRED`:

- A `retiredAt` timestamp is recorded on the asset row.
- The asset row is **permanently deleted 7 days later** by a daily `pg_cron` job. See `03-database-schema.md` for the retention-job mechanism.
- Because the asset row will eventually be deleted, `maintenance_history` (and `assignment_history`/`audit_log`) retain a **denormalized snapshot** of the asset's name and public code at the time of each event, so this history stays readable after the source asset row is gone.

---

# 28. Maintenance Resolution Workflow

```text
Technician
 ↓
Open request
 ↓
Review asset/problem
 ↓
Start work
 ↓
IN_PROGRESS
 ↓
Perform repair
 ↓
Add notes/evidence
 ↓
Resolve
 ↓
RESOLVED
 ↓
Create maintenance history
 ↓
Determine asset status
 ↓
Audit event
```

---

# 29. Cancellation

Authorized Admin may cancel an inappropriate/duplicate request.

Example:

```text
OPEN
 ↓
CANCEL
 ↓
CANCELLED
```

The cancellation should preserve:

- Reporter
- Asset
- Description
- Original timestamp
- Cancellation time
- Actor
- Reason where appropriate

Do not delete the request.

---

# 30. Duplicate Maintenance Requests

The system should avoid accidental duplicate reports where practical.

For example, before creating a new request, show:

```text
This asset already has an open maintenance request.

MR-2026-0017
Status: IN_PROGRESS

Continue creating another report?
```

This is optional UX protection.

The backend must still support legitimate multiple historical maintenance requests.

---

# 31. Maintenance and Assignment Interaction

If an assigned asset develops a problem:

```text
Asset
ASSIGNED
     ↓
Maintenance report
     ↓
IN_MAINTENANCE
```

The system must define what happens to the assignment.

Recommended:

- Do not silently delete the assignment.
- Preserve assignment history.
- If the asset must be returned for repair, close/return the assignment through the appropriate workflow.
- Create a maintenance request linked to the asset.

The exact institutional workflow may be simplified for MVP.

---

# 32. Maintenance and Asset Request Eligibility

While an active maintenance workflow has taken the asset out of service:

```text
Asset status = IN_MAINTENANCE
```

the request button should be unavailable.

Example:

```text
Asset P-104

Status:
IN MAINTENANCE

[Request Asset]  ← disabled/hidden

[Report Problem] ← optional depending on role
```

---

# 33. Maintenance History on Asset Page

Authorized users should be able to see:

```text
Maintenance History

14 Aug 2026
HDMI interface replaced
Resolved

02 Jul 2026
Lamp replaced
Resolved

15 Mar 2026
Power issue repaired
Resolved
```

Members/public users should receive only the level of maintenance information intentionally approved by the product requirements.

---

# 34. Technician Permissions

Technicians may:

- View assigned requests
- View relevant asset information
- Update assigned requests
- Add maintenance notes
- Upload authorized evidence
- Move assigned requests to permitted statuses
- Resolve assigned requests

Technicians must not:

- Change user roles
- Delete assets
- Modify arbitrary building/room records
- View unrelated sensitive audit data
- Reassign themselves to arbitrary requests
- Modify another technician's request unless explicitly authorized

---

# 35. Admin Permissions

Admins may:

- View all maintenance requests
- Assign technicians
- Reassign where necessary
- Update/cancel requests
- View maintenance history
- Manage asset state
- Review evidence
- Access relevant audit logs

---

# 36. Reporter Permissions

Member reporter may:

- Create a maintenance request
- View their own request
- View appropriate status
- View resolution information where allowed

They must not:

- Assign technicians
- Change request to RESOLVED
- Edit another user's request
- Delete historical maintenance records

---

# 37. Maintenance Notifications

Notifications are optional for MVP.

If implemented:

```text
New maintenance assigned
        ↓
Technician notification

Maintenance resolved
        ↓
Reporter notification
```

Prefer in-app notifications first.

Do not introduce paid SMS services.

---

# 38. Deferred: Notification & Reminder Automation

**Out of scope for the 1-month MVP.** Notification-driven and reminder-driven workflows (assignment notifications, resolution notifications, maintenance reminders, warranty reminders) are deferred, not built in this phase.

If revisited in a later phase, these would be plain Next.js Route Handlers for request/response CRUD, plus a scheduled Postgres job (`pg_cron`, following the same pattern as the `RETIRED`-asset retention job) for anything that needs to run on a timer rather than in response to a user action — not a separate Azure Functions project.

> Do not build a Route Handler merely to perform normal CRUD that ordinary API/Function authorization can already handle.

---

# 39. Maintenance Security

All maintenance operations require:

```text
Authentication
+
Role/ownership validation
+
API/Function authorization
+
Input validation
```

Never trust:

```text
reportedBy
assignedTo
assetId
status
```

from the client without authorization/validation.

---

# 40. Maintenance Search

Admin/technician views may search by:

```text
Request Number
Asset ID
Asset Name
```

Filters:

```text
Status
Priority
Technician
Date
```

Do not load all historical maintenance records into the browser.

---

# 41. Maintenance Pagination

Maintenance lists must be paginated.

Example:

```text
Showing 1–20 of 87
```

Default page size can be:

```text
20
```

---

# 42. Maintenance Sorting

Useful options:

```text
Newest
Oldest
Priority
Status
Recently Updated
```

Default:

```text
Newest first
```

for admin requests.

Technician dashboard can prioritize:

```text
CRITICAL
HIGH
MEDIUM
LOW
```

where appropriate.

---

# 43. Maintenance Metrics

Admin dashboard may show:

```text
Open Requests
Critical Requests
In Progress
Resolved This Month
Average Resolution Time
```

Average resolution time is optional for MVP.

If implemented, calculate from:

```text
resolvedAt - createdAt
```

Do not calculate it by loading all requests into the browser.

---

# 44. Maintenance Request Detail Data

A request detail query may combine:

```text
maintenance_requests
+
asset
+
reporter profile (safe fields)
+
assigned technician (safe fields)
+
maintenance history
+
documents
```

Avoid N+1 queries where possible.

---

# 45. Maintenance Components

Suggested components:

```text
MaintenanceRequestForm
MaintenanceRequestCard
MaintenanceTable
MaintenanceStatusBadge
MaintenancePriorityBadge
TechnicianSelector
MaintenanceTimeline
MaintenanceHistory
MaintenanceFileUpload
MaintenanceDetails
ResolutionForm
```

---

# 46. Suggested Routes

Public:

```text
/asset/[publicCode]
```

Authenticated:

```text
/maintenance
/maintenance/new
/maintenance/[id]
```

Technician:

```text
/technician
/technician/maintenance
/technician/maintenance/[id]
```

Admin:

```text
/admin/maintenance
/admin/maintenance/[id]
```

Exact route grouping may vary.

---

# 47. Maintenance Data Operations

Potential operations:

```text
createMaintenanceRequest()
getMaintenanceRequest()
listMaintenanceRequests()
assignTechnician()
startMaintenance()
addMaintenanceHistory()
uploadMaintenanceEvidence()
resolveMaintenance()
cancelMaintenance()
```

These must respect API/Function authorization and workflow validation.

---

# 48. State Transition Validation

Never implement:

```text
UPDATE maintenance_requests
SET status = clientProvidedStatus
```

without checking whether the transition is valid.

Example:

```text
OPEN → IN_PROGRESS
```

should not be directly available to a student.

Example:

```text
ASSIGNED → IN_PROGRESS
```

should be available to the assigned technician.

---

# 49. Maintenance Audit Events

At minimum:

```text
MAINTENANCE_CREATED
MAINTENANCE_ASSIGNED
MAINTENANCE_STARTED
MAINTENANCE_STATUS_CHANGED
MAINTENANCE_HISTORY_ADDED
MAINTENANCE_RESOLVED
MAINTENANCE_CANCELLED
MAINTENANCE_EVIDENCE_UPLOADED
```

Audit actor must come from authenticated identity.

---

# 50. Maintenance Testing

Claude Code must test:

### Reporting

- Member can report.
- Public cannot report without authentication.
- Reporter identity cannot be forged.

### Assignment

- Admin can assign technician.
- Member cannot assign technician.
- Non-technician cannot be selected.

### Workflow

```text
OPEN
→ ASSIGNED
→ IN_PROGRESS
→ RESOLVED
```

works correctly.

Invalid transitions fail.

### Resolution

- Assigned technician can resolve.
- Unauthorized technician cannot resolve another technician's request.
- Resolution notes are stored.
- History is created.
- Asset state is updated correctly.

### Files

- Authorized upload works.
- Invalid file type rejected.
- Oversized file rejected.
- Private file is not publicly accessible.

### Security

- Member cannot read unrelated requests.
- Technician cannot access admin-only operations.
- Public cannot read maintenance details.

---

# 51. Example End-to-End Scenario

```text
1. Member scans projector QR.
2. Public asset page opens.
3. Member logs in.
4. Member reports:
   "Projector has no display."
5. Priority = HIGH.
6. Maintenance request MR-2026-0017 created (status = OPEN).
7. Asset immediately enters IN_MAINTENANCE (at request creation, not later).
8. Admin sees request.
9. Admin assigns Technician B.
10. Status becomes ASSIGNED.
11. Technician opens request.
12. Status becomes IN_PROGRESS.
13. Technician diagnoses HDMI issue.
14. Technician replaces component.
15. Technician uploads repair photo.
16. Technician adds repair notes.
17. Technician resolves request.
18. Maintenance history is recorded.
19. Asset becomes AVAILABLE (repaired) or RETIRED (unrepairable).
20. Reporter can see the updated status.
21. Audit log contains important events.
```

---

# 52. Maintenance Definition of Done

The maintenance module is complete when:

- Authenticated users can report asset problems.
- Reporter identity comes from Auth.
- Requests have unique request numbers.
- Priority is controlled.
- Status transitions are controlled.
- Admin can assign technicians.
- Only valid technicians can be assigned.
- Technicians can process assigned work.
- Repair notes can be recorded.
- Evidence files can be uploaded securely.
- Requests can be resolved.
- Maintenance history is preserved.
- Asset state is updated appropriately.
- Duplicate/conflicting assignments are handled.
- Unauthorized users cannot access private maintenance data.
- Important actions are audited.
- Search/filter/pagination work.
- Maintenance can be accessed from the asset/QR workflow.

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

