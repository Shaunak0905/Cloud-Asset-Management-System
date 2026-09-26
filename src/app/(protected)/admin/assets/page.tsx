import Link from "next/link";
import { requirePageUser } from "@/lib/auth/session";
import { listAssets, listAssetDepartments } from "@/lib/data/assets";
import { listBuildingsWithRooms } from "@/lib/data/buildings";
import { parseAssetListQuery } from "@/lib/validation/assets";
import { AssetFilters } from "@/components/assets/AssetFilters";
import { AssetTable } from "@/components/assets/AssetTable";
import { Pagination } from "@/components/ui/Pagination";

export default async function AdminAssetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePageUser(["ADMIN"]);
  const query = parseAssetListQuery(await searchParams);

  const [result, buildings, departments] = await Promise.all([
    listAssets(user, query),
    listBuildingsWithRooms(user),
    listAssetDepartments(user),
  ]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
            Manage assets
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Every asset, including retired ones awaiting purge.
          </p>
        </div>
        <Link
          href="/admin/assets/new"
          className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-950"
        >
          New asset
        </Link>
      </div>

      <div className="mt-6">
        <AssetFilters
          basePath="/admin/assets"
          query={query}
          buildings={buildings}
          departments={departments}
        />
      </div>

      <div className="mt-4">
        <AssetTable
          assets={result.items}
          variant="admin"
          emptyMessage="No assets match — adjust the filters or create one."
        />
      </div>

      <Pagination
        basePath="/admin/assets"
        params={query}
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
      />
    </div>
  );
}
