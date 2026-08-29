"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// docs/03-database-schema.md #10/#19: RETIRED is terminal and starts the
// 7-day pg_cron purge countdown, so this asks for confirmation rather than
// being a plain button.
export function RetireAssetButton({ assetId }: { assetId: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRetire() {
    if (
      !window.confirm(
        "Retire this asset? It will be permanently deleted 7 days after retirement (its history stays in the audit log).",
      )
    ) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/assets/${assetId}/retire`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to retire asset");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to retire asset");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleRetire}
        disabled={submitting}
        className="rounded-full border border-red-300 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50 dark:border-red-900 dark:text-red-400"
      >
        {submitting ? "Retiring…" : "Retire asset"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
