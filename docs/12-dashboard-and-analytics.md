# Dashboard & Analytics
## Cloud-Based Campus Asset QR & Maintenance Management System

> **Status:** Implementation-ready dashboard specification  
> **Audience:** Claude Code / student development team  
> **Source of truth:** `docs/00-project-context.md` through `docs/11-server-side-logic-edge-functions.md`
>
> Dashboards are operational views, not a separate analytics platform. The MVP should use Next.js Route Handlers/Server Components with Prisma/Postgres aggregation queries and Next.js rendering without paid BI or analytics services.

---

# 1. Dashboard Goal

The application has three primary dashboard experiences:

```text
ADMIN
TECHNICIAN
MEMBER
```

All three dashboards share the same visual design system and component library (KPI cards, tables, badges, layout). What differs intentionally is content depth: Admin's dashboard is the most detailed, Technician's is a focused work queue, and Member's is the simplest of the three. Consistent look-and-feel across all three should not be sacrificed just because their content depth differs.

and one public experience:

```text
PUBLIC QR ASSET PAGE
```

Each dashboard should answer:

```text
What is happening?
What needs attention?
What can I do next?
```

Do not overload dashboards with decorative charts.

---

# 2. Dashboard Principles

Every dashboard should:

- Load quickly
- Show actionable information first
- Use database aggregation where possible
- Avoid downloading entire datasets
- Respect Route Handler authorization
- Respect user role
- Work on mobile/tablet/desktop
- Provide links to detailed records

---

# 3. Admin Dashboard

The Admin dashboard is the primary operational overview.

Recommended sections:

```text
1. Asset Overview
2. Maintenance Overview
3. Assignment Overview
4. Recent Activity
5. Attention Required
```

---

# 4. Admin KPI Cards

Recommended:

```text
Total Assets
Available
Assigned
In Maintenance
Damaged
Lost
Retired
```

Example:

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

Do not create a separate card for every possible metric if it makes the dashboard cluttered.

---

# 5. Asset Distribution

A simple chart may show:

```text
Available
Assigned
Maintenance
Damaged
Lost
Retired
```

A doughnut/pie chart is acceptable for a high-level status distribution.

However:

> The numbers must also be visible as text.

Do not rely solely on chart colors.

---

# 6. Asset Category Distribution

Optional chart:

```text
Projector
Laptop
Desktop
Camera
Oscilloscope
Networking Equipment
Other
```

Useful for understanding the asset inventory.

If the inventory is small, replace the chart with a compact table.

---

# 7. Building Distribution

Useful admin metric:

```text
Assets by Building
```

Example:

```text
Vyas          52
Vivekananda   38
Other         52
```

This can help identify asset concentration.

---

# 8. Maintenance KPIs

Recommended:

```text
Open
Assigned
In Progress
Critical
Resolved This Month
```

Example:

```text
Open: 8
Critical: 2
In Progress: 5
Resolved This Month: 31
```

---

# 9. Maintenance Status Chart

Show:

```text
OPEN
ASSIGNED
IN_PROGRESS
RESOLVED
CANCELLED
```

A bar chart is often easier to read than a pie chart when there are multiple states.

---

# 10. Maintenance Priority Chart

Optional:

```text
LOW
MEDIUM
HIGH
CRITICAL
```

This helps admins identify workload severity.

Do not create the chart if there is insufficient data.

---

# 11. Technician Workload

Admin may see:

```text
Technician
Open
In Progress
Resolved
```

Example:

```text
Technician A   3 open   1 active
Technician B   5 open   2 active
Technician C   1 open   0 active
```

This should help with technician assignment.

Avoid making this a punitive productivity score.

---

# 12. Recent Maintenance

Show recent requests:

```text
MR-2026-0017
Projector P-104
HIGH
IN_PROGRESS
14 Aug 2026
```

Include:

```text
[View]
```

Default to a small number such as:

```text
5–10
```

and provide:

```text
View all
```

---

# 13. Attention Required

This should be one of the most useful dashboard sections.

Examples:

```text
2 Critical maintenance requests
3 Unassigned high-priority requests
5 Assets overdue for return
```

Only implement metrics that the database schema and requirements actually support.

Do not invent operational metrics.

---

# 14. Overdue Assignments

If expected return dates are implemented:

```text
Expected return < current time
AND
assignment still active
```

then count:

```text
Overdue Assignments
```

Example:

```text
Projector P-104
Expected return:
13 Aug 2026
Status:
ACTIVE
```

This is useful for Admin and the responsible user.

---

# 15. Warranty Overview — Deferred / Post-MVP

Warranty-reminder metrics and automation are explicitly out of scope for the MVP (see the scope cuts in `00-project-context.md`).

If purchase/warranty dates are captured on the asset record, a filtered asset view (e.g. `/assets?warrantyExpiring=true`) may be added later, but no dashboard KPI card, chart, or automated reminder for warranty status should be built now.

---

# 16. Admin Recent Activity

Show selected audit/activity events:

```text
Admin created asset AST-001
Technician B resolved MR-017
Member A requested Projector P-104
Admin assigned MR-018 to Technician C
```

Keep this concise.

Do not expose sensitive audit details to users who cannot access the audit system.

---

# 17. Admin Dashboard Data Strategy

Do not fetch:

```text
SELECT * FROM assets
```

just to count statuses.

Use aggregation.

Conceptually:

```text
COUNT(*)
GROUP BY status
```

Similarly:

```text
COUNT(*)
GROUP BY category
```

and:

```text
COUNT(*)
GROUP BY building
```

---

# 18. Dashboard Aggregation Options

For simple metrics use:

```text
Prisma aggregate/count/groupBy queries against Postgres
```

For repeated complex metrics, consider:

```text
SQL views
```

or:

```text
Postgres functions/server-side workflow
```

Do not introduce an analytics warehouse.

---

# 19. Technician Dashboard

The technician dashboard answers:

```text
What maintenance work do I need to do?
```

Primary sections:

```text
My Open Requests
Critical/High Priority
In Progress
Recently Resolved
```

---

# 20. Technician KPI Cards

Recommended:

```text
Assigned
In Progress
High/Critical
Resolved This Month
```

Example:

```text
Assigned: 7
In Progress: 2
High/Critical: 3
Resolved: 18
```

---

# 21. Technician Priority Queue

The main technician list should prioritize:

```text
CRITICAL
HIGH
MEDIUM
LOW
```

within reasonable recency rules.

Example:

```text
CRITICAL  Projector P-104
IN_PROGRESS

HIGH      Laptop L-204
ASSIGNED

MEDIUM    Camera C-021
ASSIGNED
```

---

# 22. Technician Request Card

Display:

```text
Request Number
Asset Name
Asset ID
Priority
Status
Location
Reported At
```

Action:

```text
[Open Request]
```

Avoid showing unnecessary administrative fields.

---

# 23. Technician Maintenance Timeline

Inside a request:

```text
Reported
   ↓
Assigned
   ↓
Started
   ↓
Diagnosis
   ↓
Repair
   ↓
Resolved
```

The timeline should be based on actual database history, not hardcoded fake stages.

---

# 24. Member Dashboard

The user dashboard should focus on:

```text
My Assets
My Active Assignments
My Maintenance Reports
```

Optional:

```text
Recently Used Assets
```

---

# 25. User KPI Cards

Recommended:

```text
Active Assets
Open Reports
Overdue Returns
```

Example:

```text
Active Assets: 2
Open Reports: 1
Overdue: 0
```

Keep this dashboard simple.

---

# 26. My Assignments

Show:

```text
Asset
Usage Location
Assignment Status
Expected Return
```

Example:

```text
Projector P-104
Vivekananda / VK404
ACTIVE
Return: 15 Aug 2026
```

The usage location must be the assignment location, not the asset's registered/home location.

---

# 27. My Maintenance Reports

Show:

```text
Request Number
Asset
Priority
Status
Created
```

Example:

```text
MR-2026-0017
Projector P-104
HIGH
IN_PROGRESS
14 Aug 2026
```

---

# 28. Public QR Page Is Not a Dashboard

The public QR page should remain focused.

It should show:

```text
Asset
Status
Registered Location
Safe details
Available actions
```

Do not show:

```text
Admin metrics
Technician workload
Private history
User assignments
Audit logs
```

---

# 29. Dashboard Date Filters

Date filters are optional.

If implemented:

```text
Today
7 days
30 days
This month
Custom
```

Use database filtering.

Do not load all historical records into the browser.

---

# 30. Dashboard Charts

Use a lightweight chart library only if needed.

Possible choices include:

```text
Recharts
```

or another compatible React chart library.

Do not add a heavy BI framework.

---

# 31. Chart Accessibility

Charts must have:

- Visible labels
- Accessible summaries
- Text alternatives where useful

Example:

```text
Asset Status Distribution

Available: 91
Assigned: 32
Maintenance: 12
Damaged: 5
Lost: 2
Retired: 0
```

A screen-reader user should not be forced to interpret a graphic.

---

# 32. Dashboard Responsiveness

### Desktop

Use:

```text
Grid of KPI cards
Charts side-by-side
Tables
```

### Tablet

Use:

```text
2-column cards
Stacked sections
```

### Mobile

Use:

```text
1-column cards
Scrollable/stacked lists
Compact charts
```

Do not attempt to squeeze desktop dashboards into tiny screens.

---

# 33. Dashboard Loading

Each section should handle loading independently where practical.

Example:

```text
Asset metrics loading...
Maintenance metrics loading...
Recent requests loading...
```

Avoid blocking the entire dashboard for one slow widget unless the page genuinely depends on it.

---

# 34. Dashboard Empty State

Example:

```text
No maintenance requests yet.

Once a request is reported, it will appear here.
```

For a new system:

```text
No assets have been registered yet.
[Add Asset]
```

where the user has permission.

---

# 35. Dashboard Error State

If one metric fails:

```text
Unable to load maintenance metrics.
[Retry]
```

Do not make the entire dashboard unusable if unrelated sections still work.

---

# 36. Refresh Strategy

MVP:

```text
Normal page refresh
```

is sufficient.

Optional:

```text
Refresh button
```

for admin/technician dashboards.

Do not implement aggressive polling.

Example of what NOT to do:

```text
Fetch every 2 seconds forever
```

---

# 38. Dashboard Metrics Definitions

Every metric must have a precise definition.

Example:

### Total Assets

```text
COUNT of all non-deleted asset records
```

### Available

```text
assets.status = AVAILABLE
```

### Assigned

```text
assets.status = ASSIGNED
```

### In Maintenance

```text
assets.status = IN_MAINTENANCE
```

### Open Maintenance

```text
maintenance_requests.status = OPEN
```

### In Progress

```text
maintenance_requests.status = IN_PROGRESS
```

### Critical

```text
maintenance_requests.priority = CRITICAL
AND
request is active
```

---

# 39. Resolved This Month

Definition:

```text
status = RESOLVED
AND
resolved_at is within current calendar month
```

Use database date filtering.

Do not calculate in the client.

---

# 40. Overdue Return

Definition:

```text
assignment.status = ACTIVE
AND
expected_return < current timestamp
```

If `expected_return` is null:

```text
Not overdue
```

unless institutional rules define otherwise.

---

# 41. Active Asset Assignment

Definition:

```text
assignment.status = ACTIVE
```

The exact enum/status naming must match the database schema.

---

# 42. Dashboard Data API

Possible data functions:

```text
getAdminDashboardMetrics()
getTechnicianDashboardMetrics()
getUserDashboardMetrics()
getRecentMaintenance()
getRecentActivity()
getAssetStatusDistribution()
getMaintenanceStatusDistribution()
```

These should return only required fields.

---

# 43. Admin Dashboard Query Example

Conceptually:

```text
Asset status counts
Maintenance status counts
Maintenance priority counts
Recent requests
Recent audit events
Overdue assignments
```

Do not return every asset.

---

# 44. Technician Dashboard Query Example

Conceptually:

```text
Current technician ID
        ↓
Assigned maintenance requests
        ↓
Filter active statuses
        ↓
Sort by priority
        ↓
Paginate
```

The database/Route Handler authorization must enforce that the technician sees only authorized requests.

---

# 45. User Dashboard Query Example

Conceptually:

```text
Current user ID
        ↓
Active assignments
        ↓
User's maintenance requests
        ↓
Overdue assignments
```

Do not trust a user ID supplied by the browser.

Use:

```text
authenticated Entra ID user ID
```

---

# 46. Dashboard Security

Dashboard queries must respect:

```text
Authentication
Role
Route Handler authorization
```

Example:

```text
Member opens /admin
```

must fail even if the student manually knows the route.

---

# 47. Dashboard Performance

Use:

```text
Aggregated SQL
Pagination
Selective columns
Server-side filtering
```

Avoid:

```text
Fetch all records
→ JavaScript reduce()
→ chart
```

for production-sized data.

---

# 48. Dashboard Caching

Caching may be used carefully for non-sensitive/static data.

Do not cache user-specific information in a way that could expose it to another user.

Be especially careful with:

```text
User dashboard
Technician dashboard
Private maintenance data
```

---

# 49. Dashboard Audit Information

Admin may see selected recent audit events.

Do not use the dashboard as a replacement for the full audit-log page.

Provide:

```text
Recent Activity
[View All Audit Logs]
```

---

# 50. Dashboard Export

CSV/PDF export is optional.

Do not implement a reporting/export engine in the MVP unless required.

If later added:

```text
Admin
 ↓
Export filtered dataset
 ↓
Server-side generation
```

must respect permissions.

---

# 51. Dashboard Attention Badges

Not to be confused with the deferred in-app notifications feature (see scope cuts in `00-project-context.md`) — these are ordinary count queries rendered as clickable badges, not a notification/alerting system.

Optional in-app indicators:

```text
Critical maintenance: 2
Unassigned requests: 3
Overdue returns: 5
```

These should link to filtered pages.

Example:

```text
[2 Critical]
      ↓
/admin/maintenance?priority=CRITICAL
```

---

# 52. Dashboard UX Rule

Every KPI should answer:

```text
"So what?"
```

Example:

Bad:

```text
42
```

Good:

```text
42 Assets
```

Better:

```text
42 Assets
[View Assets]
```

---

# 53. Dashboard Navigation

KPI cards should be clickable only when the destination is meaningful.

Example:

```text
In Maintenance: 12
```

clicks to:

```text
/assets?status=IN_MAINTENANCE
```

or:

```text
/maintenance?status=...
```

depending on the intended view.

---

# 54. Admin Dashboard Suggested Layout

```text
┌────────────────────────────────────────────────────┐
│ Dashboard                                           │
├────────────┬────────────┬────────────┬─────────────┤
│Total Assets│ Available  │ Assigned   │ Maintenance │
│    142     │     91     │     32     │      12     │
├────────────┴────────────┴────────────┴─────────────┤
│                                                    │
│ Asset Status              Maintenance Status       │
│ [Chart]                   [Chart]                  │
│                                                    │
├────────────────────────────────────────────────────┤
│ Attention Required                                 │
│ • 2 critical requests                              │
│ • 3 unassigned high priority requests              │
├────────────────────────────────────────────────────┤
│ Recent Maintenance                                 │
│ MR-017  Projector P-104  HIGH  IN_PROGRESS         │
│ MR-018  Laptop L-204     MED   ASSIGNED            │
└────────────────────────────────────────────────────┘
```

---

# 55. Technician Dashboard Suggested Layout

```text
┌─────────────────────────────────────────────┐
│ Technician Dashboard                        │
├────────────┬────────────┬────────────────────┤
│ Assigned   │ In Progress│ High/Critical     │
│     7      │      2     │        3           │
├────────────┴────────────┴────────────────────┤
│ Priority Queue                               │
│                                             │
│ CRITICAL  Projector P-104  IN_PROGRESS      │
│ HIGH      Laptop L-204     ASSIGNED         │
│ HIGH      Camera C-021     ASSIGNED         │
│                                             │
│ [View All]                                  │
└─────────────────────────────────────────────┘
```

---

# 56. User Dashboard Suggested Layout

```text
┌─────────────────────────────────────┐
│ My Dashboard                        │
├──────────────┬──────────────┬───────┤
│Active Assets │Open Reports  │Overdue│
│      2       │      1       │   0   │
├──────────────┴──────────────┴───────┤
│ My Assets                            │
│                                     │
│ Projector P-104                     │
│ Vivekananda / VK404                 │
│ Expected return: 15 Aug             │
│                                     │
├─────────────────────────────────────┤
│ My Maintenance Reports              │
│ MR-017   HIGH   IN_PROGRESS         │
└─────────────────────────────────────┘
```

---

# 57. Dashboard Implementation Order

Claude Code should implement in this order:

```text
1. Shared dashboard layout
2. Role-based routing
3. Admin KPI metrics
4. Technician dashboard
5. User dashboard
6. Recent maintenance
7. Attention-required section
8. Optional charts
9. Responsive layout
10. Dashboard testing
```

Do not start with charts.

Start with useful data and navigation.

---

# 58. Definition of Done

Dashboards are complete when:

- Admin sees asset metrics.
- Admin sees maintenance metrics.
- Admin can navigate from metrics to detailed views.
- Technician sees assigned work.
- Technician sees priority.
- Member sees active assignments.
- Member sees their maintenance requests.
- Dashboard metrics are database-derived.
- User-specific dashboards use authenticated identity.
- Route Handler authorization protects dashboard data.
- Lists are paginated.
- Loading states exist.
- Empty states exist.
- Error states exist.
- Mobile layouts work.
- Charts, if used, have accessible text summaries.
- No paid analytics service is required.
- No excessive polling is used.

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

