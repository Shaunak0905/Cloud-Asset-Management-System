import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { AppRole } from "@/lib/auth/types";

/**
 * Runs `fn` inside a Postgres transaction with the RLS session variables set,
 * per docs/04-rls-security-policies.md #6. `userId`/`role` must come from the
 * already-validated server-side session — never from request input — since
 * they're interpolated directly into a `SET LOCAL` statement rather than bound
 * as query parameters (`SET LOCAL` does not accept bind parameters in Postgres).
 *
 * This is Layer 2 (defense-in-depth). It does not replace the Route Handler's
 * own authorization checks (Layer 1) — call this from code that has already
 * verified the caller is allowed to attempt the operation.
 */
export async function withRlsContext<T>(
  userId: string,
  role: AppRole,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_user_id = '${userId}'`,
    );
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_user_role = '${role}'`,
    );
    return fn(tx);
  });
}
