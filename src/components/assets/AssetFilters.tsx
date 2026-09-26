"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ASSET_CATEGORIES, ASSET_STATUSES, type AssetListQuery } from "@/lib/validation/assets";
import { withParams } from "@/lib/utils/url";

type BuildingOption = { id: string; name: string };

const selectClass =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";

/**
 * Search + composable filters (docs/06-asset-management.md #24-25). State
 * lives in the URL so results are shareable and survive refresh
 * (docs/10-frontend-architecture.md #40). Dropdowns apply immediately; the
 * search box applies on submit so it doesn't query on every keystroke. Any
 * change resets to page 1.
 */
export function AssetFilters({
  basePath,
  query,
  buildings,
  departments,
  statuses = ASSET_STATUSES,
}: {
  basePath: string;
  query: AssetListQuery;
  buildings: BuildingOption[];
  departments: string[];
  statuses?: readonly string[];
}) {
  const router = useRouter();
  const [q, setQ] = useState(query.q ?? "");

  function apply(overrides: Partial<Record<keyof AssetListQuery, string | undefined>>) {
    router.push(withParams(basePath, { ...query, page: undefined }, overrides));
  }

  const hasFilters = !!(query.q || query.status || query.category || query.department || query.buildingId);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply({ q: q.trim() || undefined });
        }}
        className="flex min-w-[14rem] flex-1 gap-2"
      >
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, code, or serial…"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-950"
        >
          Search
        </button>
      </form>

      <select
        aria-label="Status"
        value={query.status ?? ""}
        onChange={(e) => apply({ status: e.target.value || undefined })}
        className={selectClass}
      >
        <option value="">All statuses</option>
        {statuses.map((s) => (
          <option key={s} value={s}>
            {s.replace("_", " ")}
          </option>
        ))}
      </select>

      <select
        aria-label="Category"
        value={query.category ?? ""}
        onChange={(e) => apply({ category: e.target.value || undefined })}
        className={selectClass}
      >
        <option value="">All categories</option>
        {ASSET_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <select
        aria-label="Building"
        value={query.buildingId ?? ""}
        onChange={(e) => apply({ buildingId: e.target.value || undefined })}
        className={selectClass}
      >
        <option value="">All buildings</option>
        {buildings.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>

      {departments.length > 0 && (
        <select
          aria-label="Department"
          value={query.department ?? ""}
          onChange={(e) => apply({ department: e.target.value || undefined })}
          className={selectClass}
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      )}

      {hasFilters && (
        <button
          type="button"
          onClick={() => {
            setQ("");
            router.push(basePath);
          }}
          className="px-2 py-2 text-sm font-medium text-zinc-600 hover:underline dark:text-zinc-400"
        >
          Clear
        </button>
      )}
    </div>
  );
}
