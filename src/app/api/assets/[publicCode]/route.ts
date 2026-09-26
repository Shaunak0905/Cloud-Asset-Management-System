import { NextRequest, NextResponse } from "next/server";
import { requireUser, requireRole } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { assetUpdateSchema } from "@/lib/validation/assets";
import { getAssetByPublicCode, updateAsset } from "@/lib/data/assets";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ publicCode: string }> },
) {
  try {
    const user = await requireUser();
    const { publicCode } = await params;
    const asset = await getAssetByPublicCode(user, publicCode);
    if (!asset) return NextResponse.json({ error: "Not Found" }, { status: 404 });
    return NextResponse.json({ asset });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ publicCode: string }> },
) {
  try {
    const user = await requireUser();
    requireRole(user, ["ADMIN"]);
    const { publicCode } = await params;
    const input = assetUpdateSchema.parse(await req.json());
    const asset = await updateAsset(user, publicCode, input);
    return NextResponse.json({ asset });
  } catch (error) {
    return handleApiError(error);
  }
}
