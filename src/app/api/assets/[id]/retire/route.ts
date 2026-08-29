import { NextRequest, NextResponse } from "next/server";
import { requireUser, requireRole } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { retireAsset } from "@/lib/data/assets";

// Dedicated action endpoint rather than a generic status field on PATCH
// /api/assets/[id]: retiring an asset is a specific, audited workflow
// transition (docs/03-database-schema.md #10, #19), not an arbitrary field edit.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    requireRole(user, ["ADMIN"]);
    const { id } = await params;
    const asset = await retireAsset(user, id);
    return NextResponse.json({ asset });
  } catch (error) {
    return handleApiError(error);
  }
}
