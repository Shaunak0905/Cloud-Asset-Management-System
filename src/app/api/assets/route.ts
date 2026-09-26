import { NextRequest, NextResponse } from "next/server";
import { requireUser, requireRole } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { assetCreateSchema, parseAssetListQuery } from "@/lib/validation/assets";
import { listAssets, createAsset } from "@/lib/data/assets";

// Any authenticated user can search/browse (docs/04 #7). Retired assets are
// hidden unless explicitly filtered for, except for admins.
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const query = parseAssetListQuery(req.nextUrl.searchParams);
    const result = await listAssets(user, query, { hideRetired: user.role !== "ADMIN" });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    requireRole(user, ["ADMIN"]);
    const input = assetCreateSchema.parse(await req.json());
    const asset = await createAsset(user, input);
    return NextResponse.json({ asset }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
