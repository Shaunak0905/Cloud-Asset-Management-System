import { auth } from "@/lib/auth/auth";

// Placeholder landing point after login. docs/10-frontend-architecture.md #9-12
// specs three distinct dashboards (Admin/Technician/Member) — full metrics
// land in Week 4 per docs/16-implementation-roadmap.md; this stub keeps the
// auth flow end-to-end testable in the meantime.
export default async function DashboardPage() {
  const session = await auth();

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
        Welcome, {session?.user?.name ?? session?.user?.email}
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Role-specific dashboards (asset counts, maintenance backlog, etc.)
        arrive in Week 4. For now, use the sidebar to manage buildings, rooms,
        and assets.
      </p>
    </div>
  );
}
