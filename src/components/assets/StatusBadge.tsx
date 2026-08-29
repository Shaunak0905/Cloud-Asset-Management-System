import type { AssetStatus } from "@prisma/client";

// docs/10-frontend-architecture.md #27.
const STYLES: Record<AssetStatus, string> = {
  AVAILABLE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  IN_USE: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  IN_MAINTENANCE: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  DAMAGED: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  LOST: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300",
  RETIRED: "bg-zinc-200 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-500",
};

export function StatusBadge({ status }: { status: AssetStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}
