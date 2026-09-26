import { NextRequest, NextResponse } from "next/server";
import { requireUser, requireRole } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { listAssignments } from "@/lib/data/assignments";

// ?scope=all is admin-only; everyone else gets their own assignments.
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const scope = req.nextUrl.searchParams.get("scope") === "all" ? "all" : "mine";
    if (scope === "all") requireRole(user, ["ADMIN"]);
    const assignments = await listAssignments(user, { scope });
    return NextResponse.json({ assignments });
  } catch (error) {
    return handleApiError(error);
  }
}
