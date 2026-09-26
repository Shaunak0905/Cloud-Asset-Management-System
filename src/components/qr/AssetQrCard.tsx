import Link from "next/link";
import { getAssetPublicUrl, getAssetQrDataUrl, getAssetQrFilename } from "@/lib/qr";

/**
 * docs/07-qr-system.md #12-14: preview, PNG download, and a link to the
 * print label. Rendered on the server so the QR is generated on demand from
 * the stable public URL — never stored.
 */
export async function AssetQrCard({ publicCode }: { publicCode: string }) {
  const dataUrl = await getAssetQrDataUrl(publicCode);
  const publicUrl = getAssetPublicUrl(publicCode);

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 sm:flex-row sm:items-start">
      {/* Plain <img>: a data URL has nothing for next/image to optimize. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={dataUrl}
        alt={`QR code for ${publicCode}`}
        width={160}
        height={160}
        className="rounded-lg bg-white"
      />
      <div className="min-w-0 text-center sm:text-left">
        <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">QR code</h2>
        <p className="mt-1 font-mono text-xs text-zinc-500 dark:text-zinc-500">{publicCode}</p>
        <p className="mt-1 break-all text-xs text-zinc-500 dark:text-zinc-500">{publicUrl}</p>
        <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
          Stays valid through renames, moves, and status changes. Reprinting
          produces the same code.
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
          <a
            href={dataUrl}
            download={getAssetQrFilename(publicCode)}
            className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-950"
          >
            Download PNG
          </a>
          <Link
            href={`/admin/assets/${publicCode}/qr`}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
          >
            Print label
          </Link>
        </div>
      </div>
    </div>
  );
}
