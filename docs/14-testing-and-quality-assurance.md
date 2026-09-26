# Testing & Quality Assurance
## Cloud-Based Campus Asset QR & Maintenance Management System

> **Status:** Implementation-ready QA specification  
> **Audience:** Claude Code / student development team  
> **Source of truth:** `docs/00-project-context.md` through `docs/13-audit-logging.md`
>
> The testing strategy must verify both normal functionality and security boundaries. A workflow is not considered complete merely because the happy-path UI works.

---

# 1. QA Goal

The system must be tested across:

```text
Frontend
Backend/server-side logic
Database
Route Handler authorization
Storage
Authentication
QR
Asset lifecycle
Assignment lifecycle
Maintenance lifecycle
Audit logging
Responsive UI
```

The highest priority is:

```text
Correctness
+
Security
+
Data integrity
+
Usability
```

---

# 2. Testing Philosophy

Use multiple layers:

```text
Unit Tests
     ↓
Component Tests
     ↓
Integration Tests
     ↓
Database/Route Handler authorization Tests
     ↓
End-to-End Tests
     ↓
Manual Acceptance Testing
```

Do not rely on one layer.

---

# 3. Test Environments

Use separate environments where practical:

```text
Local Development
      ↓
Preview/Staging
      ↓
Production
```

Never perform destructive testing against production data.

---

# 4. Test Data

Create controlled test accounts:

```text
admin@test
technician@test
member@test
```

Create test assets:

```text
Asset A
Asset B
Asset C
```

Create test locations:

```text
Vyas
  VY001
  VY101

Vivekananda
  VK301
  VK404
```

Create test maintenance requests.

Do not use real institutional personal information in automated tests.

---

# 5. Test Roles

Every important workflow should be tested with:

```text
ADMIN
TECHNICIAN
MEMBER
UNAUTHENTICATED
```

Expected permissions must be explicit.

---

# 6. Unit Testing

Unit tests should cover deterministic functions.

Examples:

```text
QR URL generation
File validation
Status transition validation
Priority validation
Building/room filtering
Date formatting
Asset status helpers
```

Example:

```text
generateAssetQrUrl("AST123")
```

must always return the expected URL structure.

---

# 7. QR URL Unit Tests

Test:

```text
public ID exists
```

Result:

```text
https://<app-domain>/asset/<public-id>
```

Test that:

- Public ID is used.
- Internal database UUID is not exposed unnecessarily.
- URL is stable.
- Different assets generate different URLs.

---

# 8. Building/Room Unit Tests

Given:

```text
Building = Vyas
```

expected rooms:

```text
VY001
VY101
...
```

Given:

```text
Building = Vivekananda
```

expected rooms:

```text
VK301
VK404
...
```

When building changes:

```text
selectedRoom = null
```

The room from the previous building must not remain selected.

---

# 9. File Validation Unit Tests

Test:

```text
JPEG <= limit
PNG <= limit
WEBP <= limit
PDF <= limit
```

must pass.

Test:

```text
EXE
JS
HTML
unknown
```

must fail.

Test:

```text
valid type + oversized
```

must fail.

---

# 10. Status Transition Unit Tests

Create explicit valid/invalid transition tests.

Example:

```text
OPEN → ASSIGNED       VALID
ASSIGNED → IN_PROGRESS VALID
IN_PROGRESS → RESOLVED VALID
OPEN → RESOLVED       INVALID
RESOLVED → IN_PROGRESS INVALID
```

Exact transitions must match the maintenance specification.

---

# 11. Component Testing

Test reusable components independently.

Important components:

```text
BuildingRoomSelector
StatusBadge
PriorityBadge
FileUploader
AssetCard
MaintenanceCard
MaintenanceTimeline
TechnicianSelector
AssetForm
MaintenanceForm
```

---

# 12. BuildingRoomSelector Component Test

Test:

```text
Initial state
Building selection
Room loading/filtering
Building change
Room reset
Loading state
Error state
Disabled state
Validation error
```

Example:

```text
Select Vyas
→ VY001 appears

Select Vivekananda
→ VY001 disappears
→ VK404 appears
```

---

# 13. Form Testing

Every major form should test:

```text
Valid submission
Missing required fields
Invalid values
Loading state
Server error
Success state
Double submission
```

Important forms:

```text
Asset creation
Asset editing
Asset request
Maintenance report
Technician assignment
Maintenance resolution
User role change
```

---

# 14. Authentication Tests

Test:

```text
Login succeeds with valid credentials
Login fails with invalid credentials
Logout ends session
Unauthenticated user cannot access protected routes
Authenticated user can access permitted routes
```

Also test session persistence according to the chosen Azure/Next.js auth implementation.

---

# 15. Route Protection Tests

Test direct URL access.

Examples:

```text
Member → /admin
```

must be denied.

```text
Technician → /admin/users
```

must be denied.

```text
Public → /maintenance
```

must be denied.

```text
Public → /asset/<public-id>
```

should work for safe public asset information.

---

# 16. Route Handler Authorization Testing

Route Handler authorization is a critical security layer.

Test database access using different authenticated roles.

Example matrix:

| Operation | Admin | Technician | Member | Public |
|---|---:|---:|---:|---:|
| Read safe asset | Yes | Yes | Yes | Limited |
| Create asset | Yes | No | No | No |
| Edit asset | Yes | Limited/No | No | No |
| Create maintenance | Yes | Yes | Yes | No |
| Assign technician | Yes | No | No | No |
| Resolve own assigned maintenance | Yes | Yes | No | No |
| Read audit logs | Yes | No | No | No |
| Change roles | Yes | No | No | No |

The exact permissions must follow the final product specification.

---

# 17. Route Handler Authorization Negative Tests

Do not only test what users CAN do.

Test what they CANNOT do.

Examples:

```text
Member reads another user's private maintenance request
→ DENIED

Technician updates another technician's request
→ DENIED

Member changes asset status
→ DENIED

Technician changes role
→ DENIED

Public reads maintenance documents
→ DENIED
```

---

# 17A. RLS Direct-Database Query Test

The security model has two layers: app-layer authorization in Route Handlers, and real Postgres Row-Level Security (RLS) policies as defense-in-depth (see `04-rls-security-policies.md`). Testing only the Route Handler layer verifies the app-layer check, but not the database-layer one.

At least once per role, verify RLS independently of the app:

```text
Connect directly to Postgres as the authenticated role's mapped database role
      ↓
Bypass the Next.js Route Handler entirely (raw SQL / psql / a test script using Prisma with SET LOCAL ROLE)
      ↓
Attempt a cross-role query, e.g.:
Member role attempts SELECT * FROM audit_log
Technician role attempts SELECT * FROM maintenance_requests WHERE assigned_to <> current_user_id
      ↓
Expected: Postgres itself denies or filters the rows — not merely the app
```

This confirms RLS is actually enforced by the database, not just assumed to be configured. Do not treat a passing app-layer test as proof that RLS is also correctly configured — test each layer independently.

---

# 18. Identity Forgery Tests

Attempt:

```text
reported_by = another user
```

Result:

```text
Rejected
```

Attempt:

```text
actor_id = admin
```

Result:

```text
Rejected/ignored
```

Attempt:

```text
assigned_to = arbitrary user
```

Result:

```text
Validated against technician role
```

---

# 19. Asset Creation Tests

Admin:

```text
Create asset
```

Expected:

```text
Asset exists
Registered building correct
Registered room correct
Status correct
QR/public ID created
Audit event created
```

Non-admin:

```text
Create asset
```

Expected:

```text
Denied
```

---

# 20. Asset Editing Tests

Test:

```text
Change asset name
Change category
Change department
Change registered building
Change registered room
```

Expected:

```text
Database updated
Audit generated
```

When registered building changes:

```text
Room must belong to new building
```

Invalid combination must be rejected.

---

# 21. Asset Location Tests

Critical distinction:

```text
Registered Location
```

vs

```text
Usage Location
```

Test:

```text
Asset registered:
Vyas / VY001

User requests:
Vivekananda / VK404
```

Expected:

```text
Asset registered location remains:
Vyas / VY001

Assignment usage location:
Vivekananda / VK404
```

The request must NOT overwrite the registered location.

---

# 22. Asset Request Tests

### Available asset

```text
AVAILABLE
→ request
→ successful assignment
```

### Assigned asset

```text
IN_USE
→ request
→ rejected
```

### Maintenance asset

```text
IN_MAINTENANCE
→ request
→ rejected
```

### Retired asset

```text
RETIRED
→ request
→ rejected
```

---

# 22A. Asset Retention Test (7-Day Hard-Delete)

Verify the `pg_cron` retention rule described in `03-database-schema.md` and `13-audit-logging.md`:

```text
Create a test asset
      ↓
Retire it (status = RETIRED, retiredAt = now())
      ↓
Manipulate the test fixture's retiredAt to be > 7 days in the past
      ↓
Manually invoke (or wait for) the retention job
      ↓
Expected: the asset row no longer exists in `assets`
```

Do not wait 7 real days for this test — back-date `retiredAt` in the fixture instead.

Also verify, after the hard-delete:

```text
audit_log rows referencing the deleted asset
      ↓
Still queryable
      ↓
Still show the asset's name and public code (from the denormalized snapshot columns, not a join to `assets`)
```

```text
maintenance_history rows referencing the deleted asset
      ↓
Still queryable, same denormalized-snapshot expectation
```

```text
Public QR page for the deleted asset's public code
      ↓
Friendly "this asset is no longer in service" message, not a raw 404/500
```

A RETIRED asset that has not yet reached the 7-day mark must NOT be deleted — test that boundary too (`retiredAt` = 6 days ago should still exist; `retiredAt` = 8 days ago should not).

---

# 23. Asset Request Concurrency Test

This is important.

Simulate:

```text
User A → request asset
User B → request same asset
```

at approximately the same time.

Expected:

```text
Exactly one active assignment
```

The other request should fail cleanly.

This must be enforced by the database, not only the UI.

---

# 24. Assignment Location Tests

Test:

```text
Building = Vyas
Room = VY001
```

and:

```text
Building = Vivekananda
Room = VK404
```

The selected room must belong to the selected building.

Attempt:

```text
Building = Vyas
Room = VK404
```

Expected:

```text
Rejected
```

---

# 25. Assignment Return Tests

Active assignment:

```text
ACTIVE
```

Return:

```text
RETURNED
```

Expected:

```text
returned_at set
asset status updated appropriately
audit event created
```

Attempt to return:

```text
another user's assignment
```

Expected:

```text
Denied
```

---

# 26. Maintenance Reporting Tests

Authenticated user:

```text
Create maintenance request
```

Expected:

```text
Request created
status = OPEN
reporter = authenticated user
asset linked
audit created
```

Attempt:

```text
anonymous user
```

Expected:

```text
Denied
```

---

# 27. Maintenance Assignment Tests

Admin:

```text
OPEN
→ assign technician
→ ASSIGNED
```

Expected:

```text
technician valid
status changed
assignment timestamp stored
audit created
```

Attempt to assign:

```text
student
```

Expected:

```text
Rejected
```

---

# 28. Maintenance Workflow Tests

Valid:

```text
OPEN
→ ASSIGNED
→ IN_PROGRESS
→ RESOLVED
```

Invalid:

```text
OPEN
→ RESOLVED
```

unless the final specification explicitly permits it.

Also test:

```text
CANCELLED
```

from permitted states.

---

# 29. Technician Authorization Tests

Technician A:

```text
assigned_to = A
```

can:

```text
start
update
resolve
```

Technician B:

```text
assigned_to = A
```

cannot perform those operations unless Admin privileges are explicitly defined.

---

# 30. Maintenance Resolution Tests

Resolve request.

Expected:

```text
status = RESOLVED
resolved_at populated
resolution notes populated
history entry created
asset final status updated
audit event created
```

If resolution fails halfway:

```text
No inconsistent partial state
```

---

# 31. Maintenance Evidence Tests

Authorized technician:

```text
upload JPG
```

Expected:

```text
Storage object exists
Metadata row exists
Correct request relationship
Audit event
```

Invalid:

```text
EXE
```

Expected:

```text
Rejected
```

Oversized:

```text
Rejected
```

Unauthorized technician:

```text
Cannot upload to another technician's request
```

---

# 32. Storage Security Tests

Attempt:

```text
Public → private maintenance image
```

Expected:

```text
Denied
```

Attempt:

```text
Member → internal maintenance PDF
```

Expected:

```text
Denied
```

Attempt:

```text
Unauthenticated → private object
```

Expected:

```text
Denied
```

---

# 33. Signed URL Tests

Test:

```text
Authorized user requests URL
→ temporary URL returned
```

Unauthorized:

```text
→ denied
```

Expired URL:

```text
→ no longer usable
```

Do not store signed URLs as permanent document identity.

---

# 34. QR Tests

Test:

```text
Generate QR
Scan QR
Open URL
Load correct asset
```

Test reprinting:

```text
Generate QR
Generate again
```

Expected:

```text
Same public asset URL
Same asset identity
```

Test invalid QR:

```text
/asset/nonexistent
```

Expected:

```text
Asset not found
```

---

# 35. QR Public Information Tests

Public QR page must expose only intended safe information.

Test that it does NOT expose:

```text
Reporter identity
Technician notes
Private maintenance documents
Audit logs
Other users' assignments
Internal secrets
```

---

# 36. Dashboard Tests

Admin:

```text
Correct counts
```

Technician:

```text
Only own assigned maintenance
```

Member:

```text
Only own assignments/reports
```

Public:

```text
No protected dashboard
```

---

# 37. Dashboard Metric Accuracy

Create known test data.

Example:

```text
100 assets
60 available
20 assigned
10 maintenance
5 damaged
5 lost
```

Dashboard must show exactly:

```text
100
60
20
10
5
5
```

Do not manually calculate expected values from UI screenshots; verify against known database fixtures.

---

# 38. Maintenance Metric Accuracy

Create:

```text
5 OPEN
3 ASSIGNED
4 IN_PROGRESS
10 RESOLVED
```

Dashboard must match.

Critical count should exclude resolved critical requests if the metric definition says active critical requests only.

---

# 39. Overdue Test

Create:

```text
Assignment expected_return = yesterday
status = ACTIVE
```

Expected:

```text
Overdue = 1
```

Create:

```text
expected_return = tomorrow
status = ACTIVE
```

Expected:

```text
Overdue = 0
```

Returned assignment:

```text
status = RETURNED
```

must not count as overdue.

---

# 40. Audit Tests

For every important operation:

```text
Operation
↓
Audit event
```

Examples:

```text
Create asset → ASSET_CREATED
Assign asset → ASSET_ASSIGNED
Return asset → ASSET_RETURNED
Report maintenance → MAINTENANCE_CREATED
Assign technician → MAINTENANCE_ASSIGNED
Start repair → MAINTENANCE_STARTED
Resolve → MAINTENANCE_RESOLVED
Change role → ROLE_CHANGED
```

---

# 41. Audit Integrity Tests

Attempt:

```text
Member inserts fake audit record
```

Expected:

```text
Denied
```

Attempt:

```text
Member claims actor_id = Admin
```

Expected:

```text
Denied/ignored
```

Attempt:

```text
Normal user updates audit record
```

Expected:

```text
Denied
```

Attempt:

```text
Normal user deletes audit record
```

Expected:

```text
Denied
```

---

# 42. Cross-Entity Integrity Tests

Test:

```text
Maintenance request asset = Asset A
```

and ensure:

```text
History
Documents
Audit
```

reference the correct maintenance/asset relationship.

Attempt to attach:

```text
Asset B document
```

to:

```text
Asset A maintenance request
```

Expected:

```text
Rejected
```

---

# 43. Authentication Session Tests

Test:

```text
Login
Refresh browser
Navigate
Logout
```

Expected session behavior should remain consistent with the chosen Microsoft Entra ID implementation.

Also test:

```text
Expired/invalid session
```

protected routes should not continue exposing private data.

---

# 44. Error Handling Tests

Simulate:

```text
Database unavailable
Storage unavailable
Network failure
Invalid input
Permission denied
Asset already assigned
Missing asset
```

Expected:

```text
Friendly user message
```

Not:

```text
SQL stack trace
```

---

# 45. Double Submission Tests

For actions such as:

```text
Create asset
Request asset
Report maintenance
Resolve maintenance
```

rapidly click submit multiple times.

Expected:

```text
One valid operation
```

where the operation should be idempotent/guarded.

Disable buttons while a request is processing.

Database constraints remain the final protection.

---

# 46. File Upload Failure Tests

Simulate:

```text
Storage succeeds
Database metadata insertion fails
```

Expected:

```text
Cleanup/recovery mechanism
```

Simulate:

```text
Storage fails
```

Expected:

```text
No fake metadata record
```

UI:

```text
Upload failed. Please try again.
```

---

# 47. Responsive Testing

Test at minimum:

```text
Mobile
Tablet
Desktop
```

Important mobile workflows:

```text
Scan QR
View asset
Select building
Select room
Request asset
Report maintenance
```

Important desktop workflows:

```text
Admin asset table
Maintenance management
Audit logs
Dashboard
```

---

# 48. Accessibility Testing

Test:

```text
Keyboard navigation
Tab order
Focus visibility
Labels
Form errors
Dialog behavior
Screen-reader-friendly status information
```

Ensure:

```text
Color is not the only status indicator.
```

---

# 49. Browser Testing

Test major supported browsers.

At minimum:

```text
Chrome
Edge
Firefox
```

Safari may be tested if available/required.

The critical QR/mobile flow should be tested on a real mobile device where possible.

---

# 50. Performance Testing

Measure important operations:

```text
QR page load
Asset list load
Dashboard load
Maintenance detail load
File upload
```

Avoid arbitrary performance targets until realistic data volumes are known.

Focus first on:

```text
No unnecessary large queries
Pagination
Optimized images
Reasonable client bundle
```

---

# 51. Database Performance Tests

Test with realistic-ish data volume.

Example:

```text
1,000 assets
10,000 maintenance records
10,000 audit records
```

Verify:

```text
Asset search remains usable
Maintenance list remains usable
Audit list remains usable
Dashboard aggregation remains reasonable
```

Do not assume a prototype with 20 records will behave the same at scale.

---

# 52. Route Handler Authorization Performance

Route Handler authorization policies should be tested for:

```text
Correctness
Query behavior
Reasonable performance
```

Avoid unnecessarily complex policy subqueries if a simpler relationship can enforce the same rule.

---

# 53. Security Checklist

Before deployment verify:

```text
[ ] Route Handler authorization enabled
[ ] Storage policies configured
[ ] No server-only privileged credential key in client
[ ] No secrets in Git
[ ] Environment variables configured
[ ] Protected routes protected
[ ] Role checks server-side
[ ] Client input validated server-side
[ ] Audit actor derived from auth
[ ] Private files protected
[ ] Public QR exposes only safe data
[ ] SQL injection not possible through query construction
[ ] XSS-safe rendering
```

---

# 54. Environment Variable Testing

Verify:

```text
NEXT_PUBLIC_API_BASE_URL
NEXT_PUBLIC_AZURE_CLIENT_ID
```

are configured correctly.

If a server-only secret exists, such as:

```text
DATABASE_URL
ENTRA_CLIENT_SECRET
```

verify it is not exposed through:

```text
NEXT_PUBLIC_*
```

or client bundles.

---

# 55. Deployment Smoke Test

After deployment:

```text
1. Open application.
2. Login.
3. Open dashboard.
4. Create/read test asset if appropriate.
5. Open QR URL.
6. Submit test maintenance request.
7. Verify technician workflow.
8. Verify audit event.
9. Verify file access.
10. Logout.
```

Use a controlled test account.

---

# 56. Production Smoke Test

Immediately after deployment, verify:

```text
Auth works
Database works
Storage works
QR works
Route Handler authorization works
Admin route works
Technician route works
User route works
```

Do not assume local success guarantees production configuration is correct.

---

# 57. Regression Testing

Whenever a major feature changes:

```text
Run full critical workflow suite
```

Critical suite:

```text
Login
→ QR
→ Asset request
→ Return
→ Maintenance report
→ Technician assignment
→ Repair
→ Resolution
→ Audit
```

---

# 58. Critical End-to-End Test

Complete scenario:

```text
ADMIN creates asset
      ↓
QR generated
      ↓
Member scans QR
      ↓
Member logs in
      ↓
Member selects:
Vivekananda / VK404
      ↓
Assignment created
      ↓
Asset remains registered at original location
      ↓
Member reports problem
      ↓
Maintenance request created
      ↓
Admin assigns technician
      ↓
Technician starts work
      ↓
Technician uploads evidence
      ↓
Technician resolves
      ↓
Maintenance history created
      ↓
Asset state updated
      ↓
Audit events exist
```

This is the most important end-to-end test.

---

# 59. Failure End-to-End Test

Test:

```text
Two users request same asset
```

Expected:

```text
One succeeds
One receives unavailable/conflict result
```

Then:

```text
No duplicate active assignments
```

---

# 60. Security End-to-End Test

Test:

```text
Member
 ↓
Attempts /admin
 ↓
Denied

Member
 ↓
Attempts audit API/data operation
 ↓
Denied

Technician
 ↓
Attempts another technician's maintenance
 ↓
Denied

Public
 ↓
Attempts private storage object
 ↓
Denied
```

---

# 61. Test Naming

Use descriptive test names.

Good:

```text
allows_admin_to_create_asset
```

```text
prevents_student_from_assigning_technician
```

```text
rejects_room_from_different_building
```

Bad:

```text
test1
test2
works
```

---

# 62. Test Fixtures

Create reusable fixtures for:

```text
users
assets
buildings
rooms
assignments
maintenance requests
documents
```

Do not repeat setup logic in every test.

---

# 63. Test Isolation

Tests should not depend on:

```text
Another test running first
```

Each test should create/clean its own controlled data where appropriate.

Do not let one test silently change the result of another.

---

# 64. Seed Data

Development seed data can include:

```text
Buildings
Rooms
Asset categories
Test assets
Test users
```

Do not put real production users/passwords in seed files.

---

# 65. Acceptance Testing

Before declaring the MVP complete, a non-developer should be able to perform:

```text
1. Scan QR.
2. Understand asset.
3. Login.
4. Request asset.
5. Choose building.
6. Choose room.
7. Submit.
8. Report problem.
9. Admin assigns technician.
10. Technician resolves.
```

without developer assistance.

---

# 66. Acceptance Criteria — QR

Pass when:

```text
QR scans from a phone
→ correct asset opens
```

and:

```text
Reprinted QR
→ same asset
```

---

# 67. Acceptance Criteria — Location

Pass when:

```text
Asset registered:
Vyas / VY001
```

can be used at:

```text
Vivekananda / VK404
```

without changing its registered location.

---

# 68. Acceptance Criteria — Maintenance

Pass when:

```text
Report
→ Assign
→ Start
→ Repair
→ Resolve
```

creates the expected records and state changes.

---

# 69. Acceptance Criteria — Security

Pass when:

```text
Unauthorized users
```

cannot bypass restrictions by:

```text
Direct URL
Client modification
Modified request payload
Forged IDs
```

---

# 70. Acceptance Criteria — Audit

Pass when important actions produce:

```text
Correct action
Correct actor
Correct entity
Correct timestamp
```

and users cannot modify/delete the audit record.

---

# 71. Acceptance Criteria — Storage

Pass when:

```text
Authorized upload
→ stored
→ metadata linked
→ authorized viewing works
```

and:

```text
Unauthorized viewing
→ denied
```

---

# 72. QA Priority

When development time is limited, test in this order:

```text
P0 — Security
P0 — Data integrity
P0 — Authentication/Route Handler authorization
P0 — Asset request concurrency
P0 — Maintenance workflow

P1 — QR
P1 — Storage
P1 — Audit

P1 — Responsive UX
P2 — Charts
P2 — Optional Realtime
P2 — Nice-to-have analytics
```

Security and integrity take priority over visual polish.

---

# 73. Bugs That Block Release

The following are release blockers:

```text
Authentication bypass
Route Handler authorization bypass
Private file exposure
server-only privileged credential key exposure
Duplicate active assignment
Incorrect asset location mutation
Unauthorized maintenance resolution
Forged audit actor
Broken QR identity
Data loss
```

---

# 74. Bugs That Do Not Necessarily Block MVP

Examples:

```text
Minor spacing issue
Chart animation issue
Non-critical typography inconsistency
Optional Realtime delay
Non-essential dashboard visualization
```

These can be fixed after core functionality is secure.

---

# 75. Claude Code Testing Instructions

Claude Code must:

1. Implement the feature.
2. Add relevant tests.
3. Run the tests.
4. Fix failures.
5. Re-run the relevant suite.
6. Report remaining failures honestly.
7. Never claim a feature is tested if it was not executed.

Do not remove tests simply because they fail.

---

# 76. Claude Code Security Instructions

Claude Code must not:

- Disable Route Handler authorization to make a feature work.
- Expose server-only privileged credential credentials.
- Bypass authentication.
- Trust browser-supplied actor IDs.
- Trust browser-supplied roles.
- Trust browser-supplied ownership.
- Make private buckets public merely to fix UI access.
- Remove constraints to fix concurrency errors.
- Delete audit records to simplify tests.

If a security rule blocks functionality, fix the implementation rather than weakening the security boundary.

---

# 77. Definition of Done

The QA subsystem is complete when:

- Unit tests cover core deterministic logic.
- Components have meaningful tests.
- Authentication is tested.
- Protected routes are tested.
- Route Handler authorization is tested positively and negatively.
- Storage policies are tested.
- Asset lifecycle is tested.
- Location separation is tested.
- Asset request concurrency is tested.
- Maintenance lifecycle is tested.
- Technician authorization is tested.
- File upload/security is tested.
- QR identity is tested.
- Dashboards are tested against known data.
- Audit integrity is tested.
- Error states are tested.
- Responsive behavior is tested.
- Critical end-to-end workflow passes.
- Production smoke test is documented.
- Release blockers have been checked.

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

