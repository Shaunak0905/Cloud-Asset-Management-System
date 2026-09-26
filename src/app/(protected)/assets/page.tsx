import { requirePageUser } from "@/lib/auth/session";
import { listAssets, listAssetDepartments } from "@/lib/data/assets";
import { listBuildingsWithRooms } from "@/lib/data/buildings";
import { ASSET_STATUSES, parseAssetListQuery } from "@/lib/validation/assets";
import { AssetFilters } from "@/components/assets/AssetFilters";
import { AssetTable } from "@/components/assets/AssetTable";
import { Pagination } from "@/components/ui/Pagination";

// Retired assets are just awaiting purge — members don't need them in search.
const BROWSE_STATUSES = ASSET_STATUSES.filter((s) => s !== "RETIRED");

export default async function BrowseAssetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePageUser();
  const query = parseAssetListQuery(await searchParams);
  if (query.status === "RETIRED") query.status = undefined;

  const [result, buildings, departments] = await Promise.all([
    listAssets(user, query, { hideRetired: true }),
    listBuildingsWithRooms(user),
    listAssetDepartments(user),
  ]);

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">Browse assets</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Find equipment and request it for use. Scanning an asset&apos;s QR sticker
        takes you straight to it.
      </p>

      <div className="mt-6">
        <AssetFilters
          basePath="/assets"
          query={query}
          buildings={buildings}
          departments={departments}
          statuses={BROWSE_STATUSES}
        />
      </div>

      <div className="mt-4">
        <AssetTable
          assets={result.items}
          variant="browse"
          emptyMessage="No assets match your search."
        />
      </div>

      <Pagination
        basePath="/assets"
        params={query}
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
      />
    </div>
  );
}
