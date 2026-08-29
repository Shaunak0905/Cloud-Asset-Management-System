import type { AssetStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { withRlsContext } from "@/lib/db/rls";
import { writeAuditLog } from "@/lib/data/audit";
import type { CurrentUser } from "@/lib/auth/session";
import type { AssetCreateInput, AssetUpdateInput } from "@/lib/validation/assets";

const ASSET_INCLUDE = {
  registeredBuilding: true,
  registeredRoom: true,
} satisfies Prisma.AssetInclude;

export type ListAssetsParams = {
  page?: number;
  pageSize?: number;
  status?: AssetStatus;
  q?: string;
};

export async function listAssets(params: ListAssetsParams = {}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 25));

  const where: Prisma.AssetWhereInput = {
    ...(params.status ? { status: params.status } : {}),
    ...(params.q ? { name: { contains: params.q, mode: "insensitive" } } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.asset.findMany({
      where,
      include: ASSET_INCLUDE,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.asset.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

export async function getAssetById(id: string) {
  return prisma.asset.findUnique({ where: { id }, include: ASSET_INCLUDE });
}

export async function createAsset(actor: CurrentUser, input: AssetCreateInput) {
  return withRlsContext(actor.id, actor.role, async (tx) => {
    // Concurrency-safe, per-year-reset code from the counter function
    // (prisma/migrations/0001_init/migration.sql), per docs/03-database-schema.md #9.
    const [{ code: publicCode }] = await tx.$queryRaw<{ code: string }[]>`
      SELECT next_public_code('asset', 'AST', 5) AS code
    `;

    const asset = await tx.asset.create({
      data: {
        publicCode,
        name: input.name,
        category: input.category,
        serialNumber: input.serialNumber,
        department: input.department,
        registeredBuildingId: input.registeredBuildingId,
        registeredRoomId: input.registeredRoomId,
        purchaseDate: input.purchaseDate ? new Date(input.purchaseDate) : undefined,
        warrantyUntil: input.warrantyUntil ? new Date(input.warrantyUntil) : undefined,
        description: input.description,
        createdBy: actor.id,
      },
      include: ASSET_INCLUDE,
    });

    await writeAuditLog(tx, actor, {
      entityType: "asset",
      entityId: asset.id,
      entityNameSnapshot: asset.name,
      entityPublicCodeSnapshot: asset.publicCode,
      action: "ASSET_CREATED",
    });

    return asset;
  });
}

export async function updateAsset(
  actor: CurrentUser,
  id: string,
  input: AssetUpdateInput,
) {
  return withRlsContext(actor.id, actor.role, async (tx) => {
    const before = await tx.asset.findUniqueOrThrow({ where: { id } });

    const registeredLocationChanged =
      (input.registeredBuildingId && input.registeredBuildingId !== before.registeredBuildingId) ||
      (input.registeredRoomId && input.registeredRoomId !== before.registeredRoomId);

    const asset = await tx.asset.update({
      where: { id },
      data: {
        name: input.name,
        category: input.category,
        serialNumber: input.serialNumber,
        department: input.department,
        registeredBuildingId: input.registeredBuildingId,
        registeredRoomId: input.registeredRoomId,
        purchaseDate: input.purchaseDate ? new Date(input.purchaseDate) : undefined,
        warrantyUntil: input.warrantyUntil ? new Date(input.warrantyUntil) : undefined,
        description: input.description,
      },
      include: ASSET_INCLUDE,
    });

    await writeAuditLog(tx, actor, {
      entityType: "asset",
      entityId: asset.id,
      entityNameSnapshot: asset.name,
      entityPublicCodeSnapshot: asset.publicCode,
      action: registeredLocationChanged
        ? "ASSET_REGISTERED_LOCATION_CHANGED"
        : "ASSET_UPDATED",
    });

    return asset;
  });
}

/**
 * Sets an asset to RETIRED and stamps retiredAt, per docs/03-database-schema.md
 * #10/#19 — the only route out of DAMAGED/IN_MAINTENANCE/LOST besides AVAILABLE.
 * The pg_cron job (same doc, #19) hard-deletes the row 7 days later.
 */
export async function retireAsset(actor: CurrentUser, id: string) {
  return withRlsContext(actor.id, actor.role, async (tx) => {
    const asset = await tx.asset.update({
      where: { id },
      data: { status: "RETIRED", retiredAt: new Date() },
      include: ASSET_INCLUDE,
    });

    await writeAuditLog(tx, actor, {
      entityType: "asset",
      entityId: asset.id,
      entityNameSnapshot: asset.name,
      entityPublicCodeSnapshot: asset.publicCode,
      action: "ASSET_RETIRED",
    });

    return asset;
  });
}
