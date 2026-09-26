import { requirePageUser } from "@/lib/auth/session";
import { listBuildingsWithRooms } from "@/lib/data/buildings";
import { CreateBuildingForm } from "@/components/locations/CreateBuildingForm";
import { CreateRoomForm } from "@/components/locations/CreateRoomForm";

export default async function AdminBuildingsPage() {
  const user = await requirePageUser(["ADMIN"]);
  const buildings = await listBuildingsWithRooms(user);

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
        Buildings &amp; Rooms
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        The registered-location hierarchy used everywhere assets are created,
        assigned, or moved.
      </p>

      <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
          Add a building
        </h2>
        <div className="mt-3">
          <CreateBuildingForm />
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {buildings.length === 0 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-500">
            No buildings yet — add one above.
          </p>
        )}
        {buildings.map((building) => (
          <div
            key={building.id}
            className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="flex items-baseline gap-2">
              <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                {building.name}
              </h3>
              <span className="text-xs text-zinc-500 dark:text-zinc-500">
                {building.code}
              </span>
            </div>

            <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-900">
              {building.rooms.map((room) => (
                <li
                  key={room.id}
                  className="flex items-center justify-between py-1.5 text-sm text-zinc-700 dark:text-zinc-300"
                >
                  <span>
                    {room.name}{" "}
                    <span className="text-xs text-zinc-500 dark:text-zinc-500">
                      ({room.code}
                      {room.floor != null ? `, floor ${room.floor}` : ""})
                    </span>
                  </span>
                </li>
              ))}
              {building.rooms.length === 0 && (
                <li className="py-1.5 text-sm text-zinc-500 dark:text-zinc-500">
                  No rooms yet.
                </li>
              )}
            </ul>

            <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-900">
              <CreateRoomForm buildingId={building.id} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
