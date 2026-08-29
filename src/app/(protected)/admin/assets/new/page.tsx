import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { listBuildingsWithRooms } from "@/lib/data/buildings";
import { AssetForm } from "@/components/assets/AssetForm";

export default async function NewAssetPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const buildings = await listBuildingsWithRooms();

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
        New asset
      </h1>
      {buildings.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          Add at least one building and room first — see{" "}
          <a href="/admin/buildings" className="underline">
            Buildings &amp; Rooms
          </a>
          .
        </p>
      ) : (
        <div className="mt-6">
          <AssetForm mode="create" buildings={buildings} />
        </div>
      )}
    </div>
  );
}
