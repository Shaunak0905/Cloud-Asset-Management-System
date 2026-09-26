import Link from "next/link";
import { isOverdue, type AssignmentWithDetails } from "@/lib/data/assignments";
import { formatDateTime } from "@/lib/utils/format";
import { ReturnAssignmentButton } from "@/components/assignments/ReturnAssignmentButton";

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  RETURNED: "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

/**
 * Shared by "My assignments" and the admin all-active view. Rows keep
 * rendering from the snapshot columns even after the asset itself has been
 * purged by the retention job (docs/03-database-schema.md #11).
 */
export function AssignmentList({
  assignments,
  showUser,
  returnLabel,
  emptyMessage,
}: {
  assignments: AssignmentWithDetails[];
  showUser: boolean;
  returnLabel?: string;
  emptyMessage: string;
}) {
  if (assignments.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-500">{emptyMessage}</p>;
  }

  return (
    <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-900 dark:border-zinc-800 dark:bg-zinc-950">
      {assignments.map((a) => {
        const overdue = isOverdue(a);
        return (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {a.assetId ? (
                  <Link
                    href={`/assets/${a.assetPublicCodeSnapshot}`}
                    className="font-medium text-zinc-950 hover:underline dark:text-zinc-50"
                  >
                    {a.assetNameSnapshot}
                  </Link>
                ) : (
                  <span className="font-medium text-zinc-950 dark:text-zinc-50">
                    {a.assetNameSnapshot}{" "}
                    <span className="text-xs font-normal text-zinc-500">(removed)</span>
                  </span>
                )}
                <span className="font-mono text-xs text-zinc-500">{a.assetPublicCodeSnapshot}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[a.status] ?? STATUS_STYLES.RETURNED}`}
                >
                  {a.status}
                </span>
                {overdue && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950 dark:text-red-300">
                    Overdue
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                {showUser && <>{a.user.fullName} · </>}
                {a.usageBuilding && a.usageRoom
                  ? `Using at ${a.usageBuilding.name} / ${a.usageRoom.code}`
                  : "Usage location removed"}
                {" · "}since {formatDateTime(a.requestedAt)}
                {a.expectedReturnAt && <> · due {formatDateTime(a.expectedReturnAt)}</>}
                {a.returnedAt && <> · returned {formatDateTime(a.returnedAt)}</>}
              </p>
            </div>
            {a.status === "ACTIVE" && (
              <ReturnAssignmentButton assignmentId={a.id} label={returnLabel} />
            )}
          </li>
        );
      })}
    </ul>
  );
}
