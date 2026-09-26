import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";

// UX-only guard, per docs/05-authentication.md #8: "route hiding is not
// security." The Route Handlers behind these pages independently re-verify
// authentication, active status, and role (docs/04-rls-security-policies.md #4)
// — this proxy only redirects unauthenticated browsers to /login so they
// don't see a protected page shell with no data.
//
// Next.js 16 renamed the "middleware" file convention to "proxy" — same
// runtime, same export shape, new filename.
// Note "/assets" (authenticated browse/detail) vs "/asset/<code>" (the public
// QR page) — the latter is deliberately not listed.
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/assets",
  "/assignments",
  "/maintenance",
  "/admin",
  "/technician",
];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  if (isProtected && !req.auth) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/assets/:path*",
    "/assignments/:path*",
    "/maintenance/:path*",
    "/admin/:path*",
    "/technician/:path*",
  ],
};
