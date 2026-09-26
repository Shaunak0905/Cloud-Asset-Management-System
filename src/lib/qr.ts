import QRCode from "qrcode";

/**
 * The single place asset public URLs are built (docs/07-qr-system.md #32).
 * The base comes from configuration — never a hardcoded domain (#31) — so the
 * same code produces localhost URLs in dev and the real domain in production.
 */
export function getAssetPublicUrl(publicCode: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  return `${base}/asset/${encodeURIComponent(publicCode)}`;
}

/**
 * PNG data URL for an asset's QR, generated on demand rather than stored
 * (docs/07-qr-system.md #7-8). Medium error correction and a 4-module quiet
 * zone keep it reliably scannable from a printed sticker (#10).
 */
export async function getAssetQrDataUrl(publicCode: string): Promise<string> {
  return QRCode.toDataURL(getAssetPublicUrl(publicCode), {
    errorCorrectionLevel: "M",
    margin: 4,
    width: 512,
    color: { dark: "#000000", light: "#ffffff" },
  });
}

/** Deterministic, safe download filename (docs/07-qr-system.md #13). */
export function getAssetQrFilename(publicCode: string): string {
  return `asset-qr-${publicCode.replace(/[^A-Za-z0-9-]/g, "")}.png`;
}
