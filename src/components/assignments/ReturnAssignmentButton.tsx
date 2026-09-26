"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReturnAssignmentButton({
  assignmentId,
  label = "Return",
}: {
  assignmentId: string;
  label?: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReturn() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/return`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Return failed");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Return failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-end">
      <button
        type="button"
        onClick={handleReturn}
        disabled={submitting}
        className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
      >
        {submitting ? "Returning…" : label}
      </button>
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
