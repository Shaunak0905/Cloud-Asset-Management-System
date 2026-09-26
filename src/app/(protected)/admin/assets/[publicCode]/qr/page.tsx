import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth/session";
import { getAssetByPublicCode } from "@/lib/data/assets";
import { getAssetQrDataUrl } from "@/lib/qr";
import { PrintButton } from "@/components/qr/PrintButton";

// docs/07-qr-system.md #14: a print-friendly sticker label — QR, public code,
// asset name, nothing sensitive. The sidebar hides itself when printing.
export default async function AssetQrPrintPage({
  params,
}: {
  params: Promise<{ publicCode: string }>;
}) {
  const user = await requirePageUser(["ADMIN"]);
  const { publicCode } = await params;
  const asset = await getAssetByPublicCode(user, publicCode);
  if (!asset) notFound();

  const dataUrl = await getAssetQrDataUrl(asset.publicCode);

  return (
    <div className="p-6 print:p-0">
      <div className="flex items-center gap-3 print:hidden">
        <Link
          href={`/admin/assets/${asset.publicCode}/edit`}
          className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
        >
          ← Back to asset
        </Link>
        <PrintButton />
      </div>

      <div className="mt-6 inline-flex flex-col items-center rounded-xl border-2 border-dashed border-zinc-300 bg-white p-6 text-black print:mt-0 print:border-solid print:border-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={dataUrl} alt={`QR code for ${asset.publicCode}`} width={220} height={220} />
        <p className="mt-2 font-mono text-base font-semibold">{asset.publicCode}</p>
        <p className="text-sm">{asset.name}</p>
      </div>
    </div>
  );
}
