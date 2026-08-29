// Matches the `user_role` Postgres enum (prisma/schema.prisma) and
// docs/04-rls-security-policies.md #2 / docs/05-authentication.md #4.
export type AppRole = "ADMIN" | "TECHNICIAN" | "MEMBER";
