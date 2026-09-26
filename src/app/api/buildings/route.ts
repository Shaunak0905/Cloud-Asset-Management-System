import { NextRequest, NextResponse } from "next/server";
import { requireUser, requireRole } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { buildingCreateSchema } from "@/lib/validation/buildings";
import { listBuildingsWithRooms, createBuilding } from "@/lib/data/buildings";

// buildings are reference data: any authenticated user may read, only ADMIN
// may write (docs/04-rls-security-policies.md #7-8).
export async function GET() {
  try {
    const user = await requireUser();
    const buildings = await listBuildingsWithRooms(user);
    return NextResponse.json({ buildings });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    requireRole(user, ["ADMIN"]);
    const input = buildingCreateSchema.parse(await req.json());
    const building = await createBuilding(user, input);
    return NextResponse.json({ building }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
