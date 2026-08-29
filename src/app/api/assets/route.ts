import { NextRequest, NextResponse } from "next/server";
import { requireUser, requireRole } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { assetCreateSchema } from "@/lib/validation/assets";
import { listAssets, createAsset } from "@/lib/data/assets";
import type { AssetStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const params = req.nextUrl.searchParams;
    const result = await listAssets({
      page: params.has("page") ? Number(params.get("page")) : undefined,
      pageSize: params.has("pageSize") ? Number(params.get("pageSize")) : undefined,
      status: (params.get("status") as AssetStatus | null) ?? undefined,
      q: params.get("q") ?? undefined,
    });
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
