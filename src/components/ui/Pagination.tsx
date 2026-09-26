import Link from "next/link";
import { withParams, type QueryParams } from "@/lib/utils/url";

// docs/06-asset-management.md #26: "Showing 1–20 of 142" + prev/next.
export function Pagination({
  basePath,
  params,
  page,
  pageSize,
  total,
}: {
  basePath: string;
  params: QueryParams;
  page: number;
  pageSize: number;
  total: number;
}) {
  if (total === 0) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const hasPrev = page > 1;
  const hasNext = last < total;

  const linkClass =
    "rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900";
  const disabledClass =
    "rounded-full border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-400 dark:border-zinc-800 dark:text-zinc-600";

  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Showing {first}–{last} of {total}
      </p>
      <div className="flex gap-2">
        {hasPrev ? (
          <Link href={withParams(basePath, params, { page: page - 1 })} className={linkClass}>
            Previous
          </Link>
        ) : (
          <span className={disabledClass}>Previous</span>
        )}
        {hasNext ? (
          <Link href={withParams(basePath, params, { page: page + 1 })} className={linkClass}>
            Next
          </Link>
        ) : (
          <span className={disabledClass}>Next</span>
        )}
      </div>
    </div>
  );
}
