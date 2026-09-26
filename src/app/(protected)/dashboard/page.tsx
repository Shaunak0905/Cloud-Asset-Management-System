import Link from "next/link";
import { requirePageUser } from "@/lib/auth/session";

// Placeholder landing point after login. docs/10-frontend-architecture.md #9-12
// specs three distinct dashboards (Admin/Technician/Member) — full metrics
// land in Week 4 per docs/16-implementation-roadmap.md.
export default async function DashboardPage() {
  const user = await requirePageUser();

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
        Welcome, {user.fullName}
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Role-specific dashboards arrive in Week 4. In the meantime:
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/assets"
          className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-950"
        >
          Browse assets
        </Link>
        <Link
          href="/assignments"
          className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
        >
          My assignments
        </Link>
      </div>
    </div>
  );
}
