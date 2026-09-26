import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth/session";
import { getAssetByPublicCode } from "@/lib/data/assets";
import { getVisibleActiveAssignment, isOverdue } from "@/lib/data/assignments";
import { listBuildingsWithRooms } from "@/lib/data/buildings";
import { formatDateTime } from "@/lib/utils/format";
import { StatusBadge } from "@/components/assets/StatusBadge";
import { STATUS_MESSAGES } from "@/components/assets/statusMessages";
import { RequestAssetForm } from "@/components/assignments/RequestAssetForm";
import { ReturnAssignmentButton } from "@/components/assignments/ReturnAssignmentButton";

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ publicCode: string }>;
}) {
  const user = await requirePageUser();
  const { publicCode } = await params;

  const asset = await getAssetByPublicCode(user, publicCode);
  if (!asset) notFound();

  // RLS scoping: a MEMBER only sees the active assignment if it's theirs; an
  // ADMIN always does (docs/04 #8, assignments).
  const [activeAssignment, buildings] = await Promise.all([
    getVisibleActiveAssignment(user, asset.id),
    asset.status === "AVAILABLE" ? listBuildingsWithRooms(user) : Promise.resolve([]),
  ]);
  const heldByMe = activeAssignment?.userId === user.id;

  return (
    <div className="p-6">
      <Link href="/assets" className="text-sm text-zinc-600 hover:underline dark:text-zinc-400">
        ← Browse assets
      </Link>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">{asset.name}</h1>
        <StatusBadge status={asset.status} />
        {user.role === "ADMIN" && (
          <Link
            href={`/admin/assets/${asset.publicCode}/edit`}
            className="text-sm text-zinc-600 underline dark:text-zinc-400"
          >
            Edit
          </Link>
        )}
      </div>
      <p className="mt-1 font-mono text-xs text-zinc-500">{asset.publicCode}</p>

      <dl className="mt-6 grid max-w-xl grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-zinc-500">Category</dt>
          <dd className="text-zinc-950 dark:text-zinc-50">{asset.category}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Department</dt>
          <dd className="text-zinc-950 dark:text-zinc-50">{asset.department ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Registered location</dt>
          <dd className="text-zinc-950 dark:text-zinc-50">
            {asset.registeredBuilding.name} / {asset.registeredRoom.code}
          </dd>
        </div>
        {asset.currentUsageBuilding && asset.currentUsageRoom && (
          <div>
            <dt className="text-zinc-500">Currently in use at</dt>
            <dd className="text-zinc-950 dark:text-zinc-50">
              {asset.currentUsageBuilding.name} / {asset.currentUsageRoom.code}
            </dd>
          </div>
        )}
        {asset.serialNumber && (
          <div>
            <dt className="text-zinc-500">Serial number</dt>
            <dd className="font-mono text-zinc-950 dark:text-zinc-50">{asset.serialNumber}</dd>
          </div>
        )}
      </dl>
      {asset.description && (
        <p className="mt-4 max-w-xl text-sm text-zinc-700 dark:text-zinc-300">{asset.description}</p>
      )}

      <div className="mt-8 max-w-xl rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        {activeAssignment ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                {heldByMe ? "You have this asset" : `Checked out by ${activeAssignment.user.fullName}`}
                {isOverdue(activeAssignment) && (
                  <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950 dark:text-red-300">
                    Overdue
                  </span>
                )}
              </p>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                Since {formatDateTime(activeAssignment.requestedAt)}
                {activeAssignment.expectedReturnAt && (
                  <> · due {formatDateTime(activeAssignment.expectedReturnAt)}</>
                )}
              </p>
            </div>
            <ReturnAssignmentButton
              assignmentId={activeAssignment.id}
              label={heldByMe ? "Return asset" : "Mark returned"}
            />
          </div>
        ) : asset.status === "AVAILABLE" ? (
          buildings.length > 0 ? (
            <RequestAssetForm publicCode={asset.publicCode} buildings={buildings} />
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No buildings are set up yet, so there&apos;s nowhere to use this asset.
            </p>
          )
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {STATUS_MESSAGES[asset.status]} It can&apos;t be requested right now.
          </p>
        )}
      </div>
    </div>
  );
}
