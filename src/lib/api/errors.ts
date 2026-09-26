import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UnauthorizedError, ForbiddenError } from "@/lib/auth/session";

/**
 * An expected, user-facing failure (asset not available, room not in
 * building, ...) with the HTTP status it should map to. Thrown by the data
 * layer so Route Handlers can return a precise response instead of a 500.
 */
export class DomainError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 403 | 404 | 409,
  ) {
    super(message);
  }
}

/**
 * Central error -> HTTP response mapping for Route Handlers. Per
 * docs/04-rls-security-policies.md #18: never leak stack traces, connection
 * strings, or raw Postgres exception text — log the real error server-side
 * and return a safe, generic message.
 */
export function handleApiError(error: unknown): NextResponse {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (error instanceof DomainError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Invalid input", details: error.flatten() },
      { status: 400 },
    );
  }
  if (isPrismaKnownError(error) && error.code === "P2002") {
    return NextResponse.json({ error: "Conflict" }, { status: 409 });
  }
  if (isPrismaKnownError(error) && error.code === "P2025") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  console.error(error);
  return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
}

export function isPrismaKnownError(
  error: unknown,
): error is { code: string; message: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  );
}
