import { redirect } from "next/navigation";
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

async function getSessionUser(): Promise<CurrentUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    role: session.user.role,
    isActive: session.user.isActive,
    fullName: session.user.name ?? "Unknown",
  };
}

/** For optional-auth pages (e.g. the public QR page): the user, or null. */
export async function getOptionalUser(): Promise<CurrentUser | null> {
  const user = await getSessionUser();
  return user?.isActive ? user : null;
}

/**
 * Layer-1 (Route Handler) authentication check, per
 * docs/04-rls-security-policies.md #4: validate the Entra ID session, extract
 * the authenticated user id, and verify the profile is active. Throws rather
 * than returning null so callers can't accidentally skip the check.
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError("Not authenticated");
  if (!user.isActive) throw new UnauthorizedError("Account is inactive");
  return user;
}

/** Layer-1 role check, to be used after `requireUser()`. */
export function requireRole(user: CurrentUser, allowed: AppRole[]): void {
  if (!allowed.includes(user.role)) {
    throw new ForbiddenError(`Requires one of: ${allowed.join(", ")}`);
  }
}

/**
 * Page equivalent of requireUser()/requireRole(): redirects instead of
 * throwing. Unauthenticated -> /login, inactive -> /login with an error,
 * wrong role -> /dashboard.
 */
export async function requirePageUser(allowed?: AppRole[]): Promise<CurrentUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.isActive) redirect("/login?error=Inactive");
  if (allowed && !allowed.includes(user.role)) redirect("/dashboard");
  return user;
}
