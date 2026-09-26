"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BuildingRoomSelector } from "@/components/locations/BuildingRoomSelector";

type RoomOption = { id: string; code: string; name: string };
type BuildingOption = { id: string; code: string; name: string; rooms: RoomOption[] };

/**
 * docs/06-asset-management.md #18: where will you use it, optional expected
 * return, optional notes. The usage location is separate from the asset's
 * registered home and never overwrites it (#8, docs/03 #12).
 */
export function RequestAssetForm({
  publicCode,
  buildings,
}: {
  publicCode: string;
  buildings: BuildingOption[];
}) {
  const router = useRouter();
  const [buildingId, setBuildingId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [expectedReturn, setExpectedReturn] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/assets/${publicCode}/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usageBuildingId: buildingId,
          usageRoomId: roomId,
          // datetime-local has no timezone; convert in the browser, where the
          // user's timezone is known, before it reaches the (UTC) server.
          expectedReturnAt: expectedReturn ? new Date(expectedReturn).toISOString() : undefined,
          notes: notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Request failed");
      }
      router.push("/assignments");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Where will you use it?
      </p>
      <BuildingRoomSelector
        buildings={buildings}
        buildingId={buildingId}
        roomId={roomId}
        onBuildingChange={setBuildingId}
        onRoomChange={setRoomId}
      />
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Expected return <span className="font-normal text-zinc-500">(optional)</span>
        </label>
        <input
          type="datetime-local"
          value={expectedReturn}
          onChange={(e) => setExpectedReturn(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 sm:w-auto"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Notes <span className="font-normal text-zinc-500">(optional)</span>
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          maxLength={1000}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-zinc-950 px-6 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-950"
      >
        {submitting ? "Submitting…" : "Request / use this asset"}
      </button>
    </form>
  );
}
