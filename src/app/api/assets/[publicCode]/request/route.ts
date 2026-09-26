import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { assetRequestSchema } from "@/lib/validation/assets";
import { requestAsset } from "@/lib/data/assignments";

// Any active authenticated user may request an asset for themselves
// (docs/04 #7). Eligibility (AVAILABLE, room-in-building, no active
// assignment) is enforced inside request_asset() under a row lock.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ publicCode: string }> },
) {
  try {
    const user = await requireUser();
    const { publicCode } = await params;
    const input = assetRequestSchema.parse(await req.json());
    const assignment = await requestAsset(user, publicCode, input);
    return NextResponse.json({ assignment }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
