import { requirePageUser } from "@/lib/auth/session";
import { Sidebar } from "@/components/layout/Sidebar";

// docs/10-frontend-architecture.md #6: shared chrome for the whole
// authenticated app. proxy.ts already redirects unauthenticated browsers
// before this ever renders, but "route hiding is not security"
// (docs/05-authentication.md #8) — this re-checks server-side, including
// that the account is still active (#7).
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requirePageUser();

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <Sidebar role={user.role} name={user.fullName} />
      <main className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-black print:bg-white">
        {children}
      </main>
    </div>
  );
}
