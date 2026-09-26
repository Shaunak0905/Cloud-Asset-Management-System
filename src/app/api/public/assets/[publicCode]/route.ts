import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/errors";
import { getPublicAsset } from "@/lib/data/publicAssets";

// Unauthenticated, safe-fields-only (docs/04-rls-security-policies.md #5).
// An unknown or purged code gets a friendly message, not a bare 404 body
// (docs/03-database-schema.md #19).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ publicCode: string }> },
) {
  try {
    const { publicCode } = await params;
    const asset = await getPublicAsset(publicCode);
    if (!asset) {
      return NextResponse.json(
        { error: "This asset is not registered or is no longer in service." },
        { status: 404 },
      );
    }
    return NextResponse.json({ asset });
  } catch (error) {
    return handleApiError(error);
  }
}
