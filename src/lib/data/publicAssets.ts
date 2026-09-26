import type { AssetStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export type PublicAssetView = {
  publicCode: string;
  name: string;
  category: string;
  department: string | null;
  status: AssetStatus;
  registeredLocation: string;
};

// Same character set next_public_code() produces (e.g. AST-2026-00142). Rejecting
// anything else up front keeps junk out of the query and the logs.
const PUBLIC_CODE_PATTERN = /^[A-Z]{2,5}-\d{4}-\d{3,6}$/;

/**
 * The public QR page's only data path (docs/07-qr-system.md #17-18). Runs
 * without an RLS identity — the visitor is anonymous — through the
 * get_public_asset() SECURITY DEFINER function, which can only ever return
 * the public-safe columns. Returns null for an unknown or already-purged code.
 */
export async function getPublicAsset(publicCode: string): Promise<PublicAssetView | null> {
  const code = publicCode.trim().toUpperCase();
  if (!PUBLIC_CODE_PATTERN.test(code)) return null;

  const [row] = await prisma.$queryRaw<
    {
      public_code: string;
      name: string;
      category: string;
      department: string | null;
      status: AssetStatus;
      building_name: string;
      room_name: string;
      room_code: string;
    }[]
  >`SELECT * FROM get_public_asset(${code})`;

  if (!row) return null;

  return {
    publicCode: row.public_code,
    name: row.name,
    category: row.category,
    department: row.department,
    status: row.status,
    registeredLocation: `${row.building_name} / ${row.room_code}`,
  };
}
