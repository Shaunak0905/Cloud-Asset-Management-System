"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BuildingRoomSelector } from "@/components/locations/BuildingRoomSelector";
import { ASSET_CATEGORIES } from "@/lib/validation/assets";

type RoomOption = { id: string; code: string; name: string };
type BuildingOption = { id: string; code: string; name: string; rooms: RoomOption[] };

export type AssetFormValues = {
  name: string;
  category: string;
  serialNumber: string;
  department: string;
  registeredBuildingId: string;
  registeredRoomId: string;
  purchaseDate: string;
  warrantyUntil: string;
  description: string;
};

const EMPTY_VALUES: AssetFormValues = {
  name: "",
  category: "",
  serialNumber: "",
  department: "",
  registeredBuildingId: "",
  registeredRoomId: "",
  purchaseDate: "",
  warrantyUntil: "",
  description: "",
};

export function AssetForm({
  mode,
  assetId,
  initialValues,
  buildings,
}: {
  mode: "create" | "edit";
  assetId?: string;
  initialValues?: Partial<AssetFormValues>;
  buildings: BuildingOption[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<AssetFormValues>({
    ...EMPTY_VALUES,
    ...initialValues,
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof AssetFormValues>(key: K, value: AssetFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      name: values.name,
      category: values.category,
      serialNumber: values.serialNumber || undefined,
      department: values.department || undefined,
      registeredBuildingId: values.registeredBuildingId,
      registeredRoomId: values.registeredRoomId,
      purchaseDate: values.purchaseDate || undefined,
      warrantyUntil: values.warrantyUntil || undefined,
      description: values.description || undefined,
    };

    try {
      const url = mode === "create" ? "/api/assets" : `/api/assets/${assetId}`;
      const res = await fetch(url, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to save asset");
      }
      const { asset } = await res.json();
      router.push(`/admin/assets/${asset.id}/edit`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save asset");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Name
        </label>
        <input
          required
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Epson Projector P-104"
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Category
          </label>
          <select
            required
            value={values.category}
            onChange={(e) => set("category", e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">Select a category</option>
            {ASSET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Serial number
          </label>
          <input
            value={values.serialNumber}
            onChange={(e) => set("serialNumber", e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
      </div>

      <BuildingRoomSelector
        buildings={buildings}
        buildingId={values.registeredBuildingId}
        roomId={values.registeredRoomId}
        onBuildingChange={(id) => set("registeredBuildingId", id)}
        onRoomChange={(id) => set("registeredRoomId", id)}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Department
          </label>
          <input
            value={values.department}
            onChange={(e) => set("department", e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Purchased
            </label>
            <input
              type="date"
              value={values.purchaseDate}
              onChange={(e) => set("purchaseDate", e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Warranty until
            </label>
            <input
              type="date"
              value={values.warrantyUntil}
              onChange={(e) => set("warrantyUntil", e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Description
        </label>
        <textarea
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-zinc-950 px-6 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-950"
      >
        {submitting
          ? "Saving…"
          : mode === "create"
            ? "Create asset"
            : "Save changes"}
      </button>
    </form>
  );
}
