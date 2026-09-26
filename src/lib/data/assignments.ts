import type { AssignmentStatus, Prisma } from "@prisma/client";
import { withRlsContext } from "@/lib/db/rls";
import { writeAuditLog } from "@/lib/data/audit";
import { DomainError, isPrismaKnownError } from "@/lib/api/errors";
import type { CurrentUser } from "@/lib/auth/session";
import type { AssetRequestInput } from "@/lib/validation/assets";

// The request/return state changes run inside the request_asset() and
// return_assignment() SECURITY DEFINER functions (prisma/migrations/0002_*):
// a MEMBER has to move the asset to IN_USE, but `assets` UPDATE is admin-only
// under RLS. Those functions raise a stable token on each failure mode; this
// maps them to user-facing errors.
const FUNCTION_ERRORS: Record<string, [string, 400 | 403 | 404 | 409]> = {
  NOT_AUTHENTICATED: ["You need to sign in first.", 403],
  USER_INACTIVE: ["Your account is inactive.", 403],
  ASSET_NOT_FOUND: ["Asset not found.", 404],
  ASSET_NOT_AVAILABLE: ["This asset isn't available to request right now.", 409],
  ROOM_NOT_IN_BUILDING: ["That room isn't in the selected building.", 400],
  ASSIGNMENT_NOT_FOUND: ["Assignment not found.", 404],
  ASSIGNMENT_NOT_ACTIVE: ["This assignment has already been returned.", 409],
  NOT_ALLOWED: ["You can only return your own assignments.", 403],
};

function rethrowFunctionError(error: unknown): never {
  if (error instanceof Error) {
    for (const [token, [message, status]] of Object.entries(FUNCTION_ERRORS)) {
      if (new RegExp(`\\b${token}\\b`).test(error.message)) {
        throw new DomainError(message, status);
      }
    }
  }
  // uniq_active_assignment_per_asset — the FOR UPDATE lock should always win
  // first, but the constraint is the final backstop (docs/03 #11).
  if (isPrismaKnownError(error) && error.code === "P2002") {
    throw new DomainError(FUNCTION_ERRORS.ASSET_NOT_AVAILABLE[0], 409);
  }
  throw error;
}

const ASSIGNMENT_INCLUDE = {
  usageBuilding: true,
  usageRoom: true,
  user: { select: { fullName: true, email: true } },
} satisfies Prisma.AssignmentInclude;

/**
 * Self-service checkout (docs/06-asset-management.md #18-19). MVP decision:
 * requests are auto-approved — the assignment is ACTIVE immediately. The
 * PENDING/REJECTED statuses stay in the enum for a future approval flow.
 */
export async function requestAsset(
  actor: CurrentUser,
  publicCode: string,
  input: AssetRequestInput,
) {
  try {
    return await withRlsContext(actor.id, actor.role, async (tx) => {
      const [{ id }] = await tx.$queryRaw<{ id: string }[]>`
        SELECT request_asset(
          ${publicCode},
          ${input.usageBuildingId}::uuid,
          ${input.usageRoomId}::uuid,
          ${input.expectedReturnAt ? new Date(input.expectedReturnAt) : null}::timestamptz,
          ${input.notes ?? null}
        ) AS id
      `;

      const assignment = await tx.assignment.findUniqueOrThrow({
        where: { id },
        include: ASSIGNMENT_INCLUDE,
      });

      await writeAuditLog(tx, actor, {
        entityType: "asset",
        entityId: assignment.assetId!,
        entityNameSnapshot: assignment.assetNameSnapshot,
        entityPublicCodeSnapshot: assignment.assetPublicCodeSnapshot,
        action: "ASSET_ASSIGNED",
        metadata: {
          assignmentId: assignment.id,
          usageBuildingId: assignment.usageBuildingId,
          usageRoomId: assignment.usageRoomId,
        },
      });

      return assignment;
    });
  } catch (error) {
    rethrowFunctionError(error);
  }
}

/** Return (docs/06-asset-management.md #21). Assignee or ADMIN only. */
export async function returnAssignment(actor: CurrentUser, assignmentId: string) {
  try {
    return await withRlsContext(actor.id, actor.role, async (tx) => {
      // $executeRaw rather than $queryRaw: the function returns void, which
      // Prisma can't deserialize as a column.
      await tx.$executeRaw`SELECT return_assignment(${assignmentId}::uuid)`;

      const assignment = await tx.assignment.findUniqueOrThrow({
        where: { id: assignmentId },
        include: ASSIGNMENT_INCLUDE,
      });

      if (assignment.assetId) {
        await writeAuditLog(tx, actor, {
          entityType: "asset",
          entityId: assignment.assetId,
          entityNameSnapshot: assignment.assetNameSnapshot,
          entityPublicCodeSnapshot: assignment.assetPublicCodeSnapshot,
          action: "ASSET_RETURNED",
          metadata: { assignmentId: assignment.id, onBehalfOf: assignment.userId },
        });
      }

      return assignment;
    });
  } catch (error) {
    rethrowFunctionError(error);
  }
}

/**
 * "mine" is every user's own assignments; "all" is admin-only (enforced by the
 * caller at Layer 1 and by the assignments_select_own_or_admin RLS policy).
 */
export async function listAssignments(
  actor: CurrentUser,
  opts: { scope: "mine" | "all"; status?: AssignmentStatus },
) {
  return withRlsContext(actor.id, actor.role, (tx) =>
    tx.assignment.findMany({
      where: {
        ...(opts.scope === "mine" ? { userId: actor.id } : {}),
        ...(opts.status ? { status: opts.status } : {}),
      },
      include: ASSIGNMENT_INCLUDE,
      orderBy: { requestedAt: "desc" },
      take: 100,
    }),
  );
}

export type AssignmentWithDetails = Awaited<ReturnType<typeof listAssignments>>[number];

/**
 * The ACTIVE assignment on an asset, if the actor can see it. RLS scopes this
 * for free: a MEMBER only sees it if it's theirs, an ADMIN always does.
 */
export async function getVisibleActiveAssignment(actor: CurrentUser, assetId: string) {
  return withRlsContext(actor.id, actor.role, (tx) =>
    tx.assignment.findFirst({
      where: { assetId, status: "ACTIVE" },
      include: ASSIGNMENT_INCLUDE,
    }),
  );
}

export function isOverdue(assignment: { status: AssignmentStatus; expectedReturnAt: Date | null }) {
  return (
    assignment.status === "ACTIVE" &&
    assignment.expectedReturnAt !== null &&
    assignment.expectedReturnAt.getTime() < Date.now()
  );
}
