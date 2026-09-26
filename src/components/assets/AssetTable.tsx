import Link from "next/link";
import type { AssetStatus } from "@prisma/client";
import { StatusBadge } from "@/components/assets/StatusBadge";

type AssetRow = {
  id: string;
  publicCode: string;
  name: string;
  category: string;
  department: string | null;
  status: AssetStatus;
  warrantyUntil: Date | null;
  registeredBuilding: { code: string };
  registeredRoom: { code: string };
  currentUsageBuilding: { code: string } | null;
  currentUsageRoom: { code: string } | null;
};

/**
 * `admin` links to the edit page and adds the department/warranty columns
 * from docs/06-asset-management.md #28; `browse` links to the member detail
 * page.
 */
export function AssetTable({
  assets,
  variant,
  emptyMessage,
}: {
  assets: AssetRow[];
  variant: "admin" | "browse";
  emptyMessage: string;
}) {
  const href = (code: string) =>
    variant === "admin" ? `/admin/assets/${code}/edit` : `/assets/${code}`;
  const colCount = variant === "admin" ? 7 : 5;

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-950 dark:text-zinc-500">
          <tr>
            <th className="px-4 py-2 font-medium">Code</th>
            <th className="px-4 py-2 font-medium">Name</th>
            <th className="px-4 py-2 font-medium">Category</th>
            <th className="px-4 py-2 font-medium">Location</th>
            {variant === "admin" && <th className="px-4 py-2 font-medium">Department</th>}
            {variant === "admin" && <th className="px-4 py-2 font-medium">Warranty</th>}
            <th className="px-4 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
          {assets.map((asset) => (
            <tr key={asset.id} className="bg-white dark:bg-zinc-950">
              <td className="px-4 py-2 font-mono text-xs text-zinc-500 dark:text-zinc-500">
                {asset.publicCode}
              </td>
              <td className="px-4 py-2">
                <Link
                  href={href(asset.publicCode)}
                  className="font-medium text-zinc-950 hover:underline dark:text-zinc-50"
                >
                  {asset.name}
                </Link>
              </td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{asset.category}</td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                {asset.registeredBuilding.code} / {asset.registeredRoom.code}
                {asset.currentUsageBuilding && asset.currentUsageRoom && (
                  <span className="block text-xs text-blue-700 dark:text-blue-400">
                    In use at {asset.currentUsageBuilding.code} / {asset.currentUsageRoom.code}
                  </span>
                )}
              </td>
              {variant === "admin" && (
                <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                  {asset.department ?? "—"}
                </td>
              )}
              {variant === "admin" && (
                <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                  {asset.warrantyUntil ? asset.warrantyUntil.toISOString().slice(0, 10) : "—"}
                </td>
              )}
              <td className="px-4 py-2">
                <StatusBadge status={asset.status} />
              </td>
            </tr>
          ))}
          {assets.length === 0 && (
            <tr>
              <td
                colSpan={colCount}
                className="px-4 py-6 text-center text-zinc-500 dark:text-zinc-500"
              >
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
