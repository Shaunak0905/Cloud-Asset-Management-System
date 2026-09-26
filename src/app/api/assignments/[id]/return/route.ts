import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { returnAssignment } from "@/lib/data/assignments";

// Assignee or ADMIN — checked inside return_assignment(), which reads the
// caller's identity from the RLS session rather than trusting a parameter.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const id = z.string().uuid().parse((await params).id);
    const assignment = await returnAssignment(user, id);
    return NextResponse.json({ assignment });
  } catch (error) {
    return handleApiError(error);
  }
}
