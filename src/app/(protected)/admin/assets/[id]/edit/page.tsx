import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { getAssetById } from "@/lib/data/assets";
import { listBuildingsWithRooms } from "@/lib/data/buildings";
import { AssetForm } from "@/components/assets/AssetForm";
import { StatusBadge } from "@/components/assets/StatusBadge";
import { RetireAssetButton } from "@/components/assets/RetireAssetButton";

export default async function EditAssetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const { id } = await params;
  const [asset, buildings] = await Promise.all([
    getAssetById(id),
    listBuildingsWithRooms(),
  ]);
  if (!asset) notFound();

  const canRetire = asset.status !== "RETIRED";

  return (
    <div className="p-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
          {asset.name}
        </h1>
        <StatusBadge status={asset.status} />
      </div>
      <p className="mt-1 font-mono text-xs text-zinc-500 dark:text-zinc-500">
        {asset.publicCode}
      </p>

      <div className="mt-6">
        <AssetForm
          mode="edit"
          assetId={asset.id}
          buildings={buildings}
          initialValues={{
            name: asset.name,
            category: asset.category,
            serialNumber: asset.serialNumber ?? "",
            department: asset.department ?? "",
            registeredBuildingId: asset.registeredBuildingId,
            registeredRoomId: asset.registeredRoomId,
            purchaseDate: asset.purchaseDate
              ? asset.purchaseDate.toISOString().slice(0, 10)
              : "",
            warrantyUntil: asset.warrantyUntil
              ? asset.warrantyUntil.toISOString().slice(0, 10)
              : "",
            description: asset.description ?? "",
          }}
        />
      </div>

      {canRetire && (
        <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            Danger zone
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Retiring is the only path out of DAMAGED/IN_MAINTENANCE/LOST
            besides making the asset AVAILABLE again through the maintenance
            workflow (Week 3).
          </p>
          <div className="mt-3">
            <RetireAssetButton assetId={asset.id} />
          </div>
        </div>
      )}
    </div>
  );
}
