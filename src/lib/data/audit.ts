import type { Prisma } from "@prisma/client";
import type { CurrentUser } from "@/lib/auth/session";

type AuditEvent = {
  entityType: string;
  entityId: string;
  entityNameSnapshot?: string;
  entityPublicCodeSnapshot?: string;
  action: string;
  metadata?: Prisma.InputJsonValue;
};

/**
 * Writes one audit_log row inside the caller's transaction, per
 * docs/03-database-schema.md #17-18. Always called with the already-validated
 * actor from requireUser() — never a client-supplied id (docs/04-rls-security-policies.md #10).
 */
export async function writeAuditLog(
  tx: Prisma.TransactionClient,
  actor: CurrentUser,
  event: AuditEvent,
) {
  await tx.auditLog.create({
    data: {
      entityType: event.entityType,
      entityId: event.entityId,
      entityNameSnapshot: event.entityNameSnapshot,
      entityPublicCodeSnapshot: event.entityPublicCodeSnapshot,
      action: event.action,
      actorId: actor.id,
      actorNameSnapshot: actor.fullName,
      metadata: event.metadata,
    },
  });
}
