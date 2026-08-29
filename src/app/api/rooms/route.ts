import { NextRequest, NextResponse } from "next/server";
import { requireUser, requireRole } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { roomCreateSchema } from "@/lib/validation/buildings";
import { createRoom } from "@/lib/data/buildings";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    requireRole(user, ["ADMIN"]);
    const input = roomCreateSchema.parse(await req.json());
    const room = await createRoom(user, input);
    return NextResponse.json({ room }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
