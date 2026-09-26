import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getPublicAsset } from "@/lib/data/publicAssets";
import { getOptionalUser } from "@/lib/auth/session";
import { StatusBadge } from "@/components/assets/StatusBadge";
import { STATUS_MESSAGES } from "@/components/assets/statusMessages";

// Deduped between generateMetadata and the page for the same request.
const loadAsset = cache(getPublicAsset);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ publicCode: string }>;
}): Promise<Metadata> {
  const asset = await loadAsset((await params).publicCode);
  return { title: asset ? `${asset.name} · Campus Asset Management` : "Asset not found" };
}

/**
 * What a phone camera opens when it scans a QR sticker (docs/07-qr-system.md
 * #15-23). Public: shows only the safe projection from get_public_asset().
 * Scanning never changes state — requesting happens on the authenticated
 * detail page, behind sign-in.
 */
export default async function PublicAssetPage({
  params,
}: {
  params: Promise<{ publicCode: string }>;
}) {
  const { publicCode } = await params;
  const [asset, user] = await Promise.all([loadAsset(publicCode), getOptionalUser()]);

  if (!asset) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-12 dark:bg-black">
        <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-950">
          <h1 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">Asset not found</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            This QR code doesn&apos;t match a registered asset. It may have been
            retired and removed from the system.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  const detailPath = `/assets/${asset.publicCode}`;
  const available = asset.status === "AVAILABLE";

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-12 dark:bg-black">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="font-mono text-xs text-zinc-500">{asset.publicCode}</p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">{asset.name}</h1>
        <div className="mt-3">
          <StatusBadge status={asset.status} />
        </div>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{STATUS_MESSAGES[asset.status]}</p>

        <dl className="mt-6 space-y-3 text-sm">
          <div>
            <dt className="text-zinc-500">Category</dt>
            <dd className="text-zinc-950 dark:text-zinc-50">{asset.category}</dd>
          </div>
          {asset.department && (
            <div>
              <dt className="text-zinc-500">Department</dt>
              <dd className="text-zinc-950 dark:text-zinc-50">{asset.department}</dd>
            </div>
          )}
          <div>
            <dt className="text-zinc-500">Home location</dt>
            <dd className="text-zinc-950 dark:text-zinc-50">{asset.registeredLocation}</dd>
          </div>
        </dl>

        {asset.status !== "RETIRED" && (
          <Link
            href={user ? detailPath : `/login?callbackUrl=${encodeURIComponent(detailPath)}`}
            className="mt-6 block rounded-full bg-zinc-950 px-6 py-3 text-center text-sm font-medium text-white dark:bg-white dark:text-zinc-950"
          >
            {user
              ? available
                ? "Request / use this asset"
                : "View details"
              : available
                ? "Sign in to request this asset"
                : "Sign in for details"}
          </Link>
        )}
      </div>
    </div>
  );
}
