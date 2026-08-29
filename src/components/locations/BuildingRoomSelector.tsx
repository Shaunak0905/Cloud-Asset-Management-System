"use client";

type RoomOption = { id: string; code: string; name: string };
type BuildingOption = { id: string; code: string; name: string; rooms: RoomOption[] };

/**
 * The reusable building -> room picker flagged as critical in
 * docs/10-frontend-architecture.md #17. Dynamic filtering: changing the
 * building always resets the room selection, since rooms belong to exactly
 * one building (docs/03-database-schema.md #7).
 */
export function BuildingRoomSelector({
  buildings,
  buildingId,
  roomId,
  onBuildingChange,
  onRoomChange,
  required = true,
}: {
  buildings: BuildingOption[];
  buildingId: string;
  roomId: string;
  onBuildingChange: (id: string) => void;
  onRoomChange: (id: string) => void;
  required?: boolean;
}) {
  const rooms = buildings.find((b) => b.id === buildingId)?.rooms ?? [];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Building
        </label>
        <select
          required={required}
          value={buildingId}
          onChange={(e) => {
            onBuildingChange(e.target.value);
            onRoomChange("");
          }}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">Select a building</option>
          {buildings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Room
        </label>
        <select
          required={required}
          value={roomId}
          disabled={!buildingId}
          onChange={(e) => onRoomChange(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">
            {buildingId ? "Select a room" : "Select a building first"}
          </option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.code})
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
