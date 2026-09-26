import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth/session";
import { getAssetByPublicCode, DIRECTLY_RETIRABLE_STATUSES } from "@/lib/data/assets";
import { listBuildingsWithRooms } from "@/lib/data/buildings";
import { AssetForm } from "@/components/assets/AssetForm";
import { StatusBadge } from "@/components/assets/StatusBadge";
import { RetireAssetButton } from "@/components/assets/RetireAssetButton";
import { AssetQrCard } from "@/components/qr/AssetQrCard";

export default async function EditAssetPage({
  params,
}: {
  params: Promise<{ publicCode: string }>;
}) {
  const user = await requirePageUser(["ADMIN"]);
  const { publicCode } = await params;
  const [asset, buildings] = await Promise.all([
    getAssetByPublicCode(user, publicCode),
    listBuildingsWithRooms(user),
  ]);
  if (!asset) notFound();

  const canRetire = DIRECTLY_RETIRABLE_STATUSES.includes(asset.status);

  return (
    <div className="p-6">
      <Link
        href="/admin/assets"
        className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
      >
        ← All assets
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
          {asset.name}
        </h1>
        <StatusBadge status={asset.status} />
      </div>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Registered at {asset.registeredBuilding.name} / {asset.registeredRoom.code}
        {asset.currentUsageBuilding && asset.currentUsageRoom && (
          <>
            {" · "}in use at {asset.currentUsageBuilding.name} / {asset.currentUsageRoom.code}
          </>
        )}
        {" · "}
        <Link href={`/assets/${asset.publicCode}`} className="underline">
          View as member
        </Link>
      </p>

      <div className="mt-6 max-w-xl">
        <AssetQrCard publicCode={asset.publicCode} />
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">Details</h2>
        <div className="mt-3">
          <AssetForm
            mode="edit"
            publicCode={asset.publicCode}
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
      </div>

      {asset.status !== "RETIRED" && (
        <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            Danger zone
          </h2>
          {canRetire ? (
            <>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Retiring is terminal: the asset is permanently deleted 7 days
                later, with its history kept in the audit log.
              </p>
              <div className="mt-3">
                <RetireAssetButton publicCode={asset.publicCode} />
              </div>
            </>
          ) : (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Only AVAILABLE or LOST assets can be retired directly.{" "}
              {asset.status === "IN_USE"
                ? "This one is checked out — it has to be returned first."
                : "This one has to go through the maintenance workflow, which can resolve it to AVAILABLE or RETIRED."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
