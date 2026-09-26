import { withRlsContext } from "@/lib/db/rls";
import { writeAuditLog } from "@/lib/data/audit";
import type { CurrentUser } from "@/lib/auth/session";
import type { BuildingCreateInput, RoomCreateInput } from "@/lib/validation/buildings";

// Every query runs inside withRlsContext: the app connects as the RLS-subject
// app_user role, so a query with no RLS identity set matches no policy and
// returns nothing (docs/04-rls-security-policies.md #6).

export async function listBuildingsWithRooms(actor: CurrentUser) {
  return withRlsContext(actor.id, actor.role, (tx) =>
    tx.building.findMany({
      where: { isActive: true },
      include: { rooms: { where: { isActive: true }, orderBy: { code: "asc" } } },
      orderBy: { name: "asc" },
    }),
  );
}

export type BuildingWithRooms = Awaited<ReturnType<typeof listBuildingsWithRooms>>[number];

export async function createBuilding(actor: CurrentUser, input: BuildingCreateInput) {
  return withRlsContext(actor.id, actor.role, async (tx) => {
    const building = await tx.building.create({ data: input });
    await writeAuditLog(tx, actor, {
      entityType: "building",
      entityId: building.id,
      entityNameSnapshot: building.name,
      action: "BUILDING_CREATED",
      metadata: { code: building.code },
    });
    return building;
  });
}

export async function createRoom(actor: CurrentUser, input: RoomCreateInput) {
  return withRlsContext(actor.id, actor.role, async (tx) => {
    const room = await tx.room.create({ data: input });
    await writeAuditLog(tx, actor, {
      entityType: "room",
      entityId: room.id,
      entityNameSnapshot: room.name,
      action: "ROOM_CREATED",
      metadata: { code: room.code, buildingId: room.buildingId },
    });
    return room;
  });
}
