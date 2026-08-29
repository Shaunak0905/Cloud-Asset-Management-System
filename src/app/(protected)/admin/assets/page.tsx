import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { listAssets } from "@/lib/data/assets";
import { StatusBadge } from "@/components/assets/StatusBadge";

export default async function AdminAssetsPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const { items: assets, total } = await listAssets({ pageSize: 50 });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
            Assets
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {total} total
          </p>
        </div>
        <Link
          href="/admin/assets/new"
          className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-950"
        >
          New asset
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-950 dark:text-zinc-500">
            <tr>
              <th className="px-4 py-2 font-medium">Public code</th>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 font-medium">Location</th>
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
                    href={`/admin/assets/${asset.id}/edit`}
                    className="font-medium text-zinc-950 hover:underline dark:text-zinc-50"
                  >
                    {asset.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                  {asset.category}
                </td>
                <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                  {asset.registeredBuilding.code} / {asset.registeredRoom.code}
                </td>
                <td className="px-4 py-2">
                  <StatusBadge status={asset.status} />
                </td>
              </tr>
            ))}
            {assets.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-zinc-500 dark:text-zinc-500">
                  No assets yet — create one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
