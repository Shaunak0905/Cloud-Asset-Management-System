import type { AssetStatus, Prisma } from "@prisma/client";
import { withRlsContext } from "@/lib/db/rls";
import { writeAuditLog } from "@/lib/data/audit";
import { DomainError } from "@/lib/api/errors";
import type { CurrentUser } from "@/lib/auth/session";
import type {
  AssetCreateInput,
  AssetListQuery,
  AssetUpdateInput,
} from "@/lib/validation/assets";

// Every query runs inside withRlsContext — see the note in buildings.ts.
// Assets are addressed by publicCode everywhere outside this file: the
// internal UUID is never put in a URL (docs/03-database-schema.md #9).

const ASSET_INCLUDE = {
  registeredBuilding: true,
  registeredRoom: true,
  currentUsageBuilding: true,
  currentUsageRoom: true,
} satisfies Prisma.AssetInclude;

export const ASSET_PAGE_SIZE = 20;

function buildAssetWhere(
  query: AssetListQuery,
  opts: { hideRetired?: boolean },
): Prisma.AssetWhereInput {
  const where: Prisma.AssetWhereInput = {};

  if (query.status) where.status = query.status;
  else if (opts.hideRetired) where.status = { not: "RETIRED" };

  if (query.category) where.category = query.category;
  if (query.department) where.department = query.department;
  if (query.buildingId) where.registeredBuildingId = query.buildingId;

  // Free-text search over name (trigram-indexed, docs/03 #21), public code and
  // serial number (docs/06-asset-management.md #24).
  if (query.q) {
    where.OR = [
      { name: { contains: query.q, mode: "insensitive" } },
      { publicCode: { contains: query.q, mode: "insensitive" } },
      { serialNumber: { contains: query.q, mode: "insensitive" } },
    ];
  }

  return where;
}

export async function listAssets(
  actor: CurrentUser,
  query: AssetListQuery,
  opts: { hideRetired?: boolean } = {},
) {
  const page = query.page ?? 1;
  const where = buildAssetWhere(query, opts);

  return withRlsContext(actor.id, actor.role, async (tx) => {
    // Sequential, not Promise.all: both run on the one transaction connection.
    const items = await tx.asset.findMany({
      where,
      include: ASSET_INCLUDE,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * ASSET_PAGE_SIZE,
      take: ASSET_PAGE_SIZE,
    });
    const total = await tx.asset.count({ where });
    return { items, total, page, pageSize: ASSET_PAGE_SIZE };
  });
}

/** Distinct departments in use, for the department filter dropdown. */
export async function listAssetDepartments(actor: CurrentUser): Promise<string[]> {
  return withRlsContext(actor.id, actor.role, async (tx) => {
    const rows = await tx.asset.findMany({
      where: { department: { not: null } },
      distinct: ["department"],
      select: { department: true },
      orderBy: { department: "asc" },
    });
    return rows.map((r) => r.department).filter((d): d is string => !!d);
  });
}

export async function getAssetByPublicCode(actor: CurrentUser, publicCode: string) {
  return withRlsContext(actor.id, actor.role, (tx) =>
    tx.asset.findUnique({ where: { publicCode }, include: ASSET_INCLUDE }),
  );
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
  publicCode: string,
  input: AssetUpdateInput,
) {
  return withRlsContext(actor.id, actor.role, async (tx) => {
    const before = await tx.asset.findUnique({ where: { publicCode } });
    if (!before) throw new DomainError("Asset not found.", 404);

    const registeredLocationChanged =
      (input.registeredBuildingId && input.registeredBuildingId !== before.registeredBuildingId) ||
      (input.registeredRoomId && input.registeredRoomId !== before.registeredRoomId);

    const asset = await tx.asset.update({
      where: { publicCode },
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
      metadata: registeredLocationChanged
        ? {
            fromBuildingId: before.registeredBuildingId,
            fromRoomId: before.registeredRoomId,
            toBuildingId: asset.registeredBuildingId,
            toRoomId: asset.registeredRoomId,
          }
        : undefined,
    });

    return asset;
  });
}

/**
 * Statuses an admin may retire directly (docs/06-asset-management.md #16).
 * IN_USE must be returned first (otherwise the active assignment would be
 * orphaned when the retention job purges the row), DAMAGED must go through
 * maintenance, and IN_MAINTENANCE -> RETIRED happens via maintenance
 * resolution (Week 3), not this action.
 */
export const DIRECTLY_RETIRABLE_STATUSES: AssetStatus[] = ["AVAILABLE", "LOST"];

/**
 * Sets an asset to RETIRED and stamps retiredAt, per docs/03-database-schema.md
 * #10/#19. The pg_cron job (same doc, #19) hard-deletes the row 7 days later.
 */
export async function retireAsset(actor: CurrentUser, publicCode: string) {
  return withRlsContext(actor.id, actor.role, async (tx) => {
    // Conditional update so the status check and the write can't race.
    const { count } = await tx.asset.updateMany({
      where: { publicCode, status: { in: DIRECTLY_RETIRABLE_STATUSES } },
      data: { status: "RETIRED", retiredAt: new Date() },
    });

    if (count === 0) {
      const exists = await tx.asset.findUnique({ where: { publicCode }, select: { id: true } });
      if (!exists) throw new DomainError("Asset not found.", 404);
      throw new DomainError(
        "Only AVAILABLE or LOST assets can be retired directly. Return it or resolve its maintenance first.",
        409,
      );
    }

    const asset = await tx.asset.findUniqueOrThrow({
      where: { publicCode },
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
