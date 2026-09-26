import Link from "next/link";
import { requirePageUser } from "@/lib/auth/session";
import { listAssignments } from "@/lib/data/assignments";
import { AssignmentList } from "@/components/assignments/AssignmentList";

export default async function AssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const user = await requirePageUser();
  const isAdmin = user.role === "ADMIN";
  const view = isAdmin && (await searchParams).view === "all" ? "all" : "mine";

  const assignments =
    view === "all"
      ? await listAssignments(user, { scope: "all", status: "ACTIVE" })
      : await listAssignments(user, { scope: "mine" });

  const active = assignments.filter((a) => a.status === "ACTIVE");
  const past = assignments.filter((a) => a.status !== "ACTIVE");

  const tabClass = (on: boolean) =>
    `rounded-full px-3 py-1.5 text-sm font-medium ${
      on
        ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"
        : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
    }`;

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
        {view === "all" ? "All active assignments" : "My assignments"}
      </h1>

      {isAdmin && (
        <div className="mt-4 flex gap-2">
          <Link href="/assignments" className={tabClass(view === "mine")}>
            Mine
          </Link>
          <Link href="/assignments?view=all" className={tabClass(view === "all")}>
            All active
          </Link>
        </div>
      )}

      {view === "all" ? (
        <div className="mt-6">
          <AssignmentList
            assignments={active}
            showUser
            returnLabel="Mark returned"
            emptyMessage="Nothing is checked out right now."
          />
        </div>
      ) : (
        <>
          <h2 className="mt-6 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            Checked out
          </h2>
          <div className="mt-3">
            <AssignmentList
              assignments={active}
              showUser={false}
              returnLabel="Return asset"
              emptyMessage="You don't have anything checked out. Browse assets to request one."
            />
          </div>

          {past.length > 0 && (
            <>
              <h2 className="mt-8 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                History
              </h2>
              <div className="mt-3">
                <AssignmentList
                  assignments={past}
                  showUser={false}
                  emptyMessage=""
                />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
