import { auth } from "@/lib/auth/auth";
import type { AppRole } from "@/lib/auth/types";

export class UnauthorizedError extends Error {}
export class ForbiddenError extends Error {}

export type CurrentUser = {
  id: string;
  role: AppRole;
  isActive: boolean;
  fullName: string;
};

/**
 * Layer-1 (Route Handler) authentication check, per
 * docs/04-rls-security-policies.md #4: validate the Entra ID session, extract
 * the authenticated user id, and verify the profile is active. Throws rather
 * than returning null so callers can't accidentally skip the check.
 */
export async function requireUser(): Promise<CurrentUser> {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError("Not authenticated");
  if (!session.user.isActive) throw new UnauthorizedError("Account is inactive");
  return {
    id: session.user.id,
    role: session.user.role,
    isActive: session.user.isActive,
    fullName: session.user.name ?? "Unknown",
  };
}

/** Layer-1 role check, to be used after `requireUser()`. */
export function requireRole(user: CurrentUser, allowed: AppRole[]): void {
  if (!allowed.includes(user.role)) {
    throw new ForbiddenError(`Requires one of: ${allowed.join(", ")}`);
  }
}
