import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { prisma } from "@/lib/db/prisma";
import type { AppRole } from "@/lib/auth/types";

/**
 * Auth.js (NextAuth v5) config. Microsoft Entra ID is the sole identity provider
 * (docs/05-authentication.md). No database adapter is used — Auth.js keeps the
 * session as a signed JWT, and the `jwt` callback below is where the Entra ID
 * object id is resolved against our own `users` table (docs/03-database-schema.md
 * #5), provisioning a new row with role = MEMBER on first sign-in
 * (docs/05-authentication.md #6). This callback is intentionally the ONLY place
 * a `users` row is created — nowhere else should insert one.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    /**
     * Self-registration domain gate: if AUTH_ALLOWED_EMAIL_DOMAIN is set, only
     * accounts whose email ends in that domain may sign in (which is also the
     * only way a `users` row gets created — see the `jwt` callback below).
     * This is a plain string check, not a directory/API lookup — it exists as
     * an app-level backstop; the real, stronger restriction is scoping the
     * Entra ID app registration to the college's own tenant (the human
     * developer's side of the Azure setup, docs/05-authentication.md).
     * Left unset, sign-in is unrestricted (e.g. for local dev).
     */
    async signIn({ profile }) {
      const allowedDomain = process.env.AUTH_ALLOWED_EMAIL_DOMAIN?.toLowerCase().trim();
      if (!allowedDomain) return true;

      const email = (profile?.email as string | undefined)?.toLowerCase();
      if (!email || !email.endsWith(`@${allowedDomain}`)) {
        return "/login?error=WrongDomain";
      }
      return true;
    },
    async jwt({ token, profile }) {
      const entraId =
        (profile?.oid as string | undefined) ??
        (profile?.sub as string | undefined) ??
        (token.entraId as string | undefined);

      if (!entraId) return token;

      let user = await prisma.user.findUnique({ where: { entraId } });

      if (!user) {
        user = await prisma.user.create({
          data: {
            entraId,
            fullName: (profile?.name as string | undefined) ?? "Unknown",
            email:
              (profile?.email as string | undefined) ??
              `${entraId}@unresolved.local`,
            role: "MEMBER",
          },
        });
      }

      token.entraId = entraId;
      token.userId = user.id;
      token.role = user.role as AppRole;
      token.isActive = user.isActive;
      // We overrode the default jwt callback entirely, so name/email have to
      // be set explicitly here too (from our own `users` row, the actual
      // profile source of truth) for them to reach session.user below.
      token.name = user.fullName;
      token.email = user.email;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
        session.user.role = token.role as AppRole;
        session.user.isActive = token.isActive as boolean;
        session.user.name = token.name;
        session.user.email = token.email as string;
      }
      return session;
    },
  },
});
