import type { DefaultSession } from "next-auth";
import type { AppRole } from "@/lib/auth/types";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: AppRole;
      isActive: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    entraId?: string;
    userId?: string;
    role?: AppRole;
    isActive?: boolean;
  }
}
