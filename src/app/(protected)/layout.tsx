import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { Sidebar } from "@/components/layout/Sidebar";

// docs/10-frontend-architecture.md #6: shared chrome for the whole
// authenticated app. proxy.ts already redirects unauthenticated browsers
// before this ever renders, but "route hiding is not security"
// (docs/05-authentication.md #8) — this re-checks server-side too.
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <Sidebar role={session.user.role} name={session.user.name ?? session.user.email ?? "Signed in"} />
      <main className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-black">
        {children}
      </main>
    </div>
  );
}
