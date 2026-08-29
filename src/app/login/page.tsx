import { signIn } from "@/lib/auth/auth";

// docs/05-authentication.md #5: Entra ID is the only sign-in path — no
// custom credential form. Signing in for the first time IS registration:
// the auth.ts `jwt` callback auto-provisions a `users` row with role =
// MEMBER on first successful sign-in (#6), so there's no separate signup
// flow to build. `callbackUrl` lets proxy.ts send users back to whatever
// protected page they were trying to reach.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const { callbackUrl, error } = await searchParams;

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 dark:bg-black">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
          Sign in
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Use your institutional Microsoft account. First-time sign-in
          registers you automatically — no separate signup needed.
        </p>
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Use your official college email ID only. Personal or other
          non-institutional accounts will be rejected.
        </p>
        {error === "WrongDomain" && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
            That account isn&apos;t on the college email domain. Please sign
            in with your official college account.
          </p>
        )}
        {error && error !== "WrongDomain" && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
            Sign-in failed. Please try again.
          </p>
        )}
        <form
          action={async () => {
            "use server";
            await signIn("microsoft-entra-id", {
              redirectTo: callbackUrl ?? "/dashboard",
            });
          }}
        >
          <button
            type="submit"
            className="mt-6 w-full rounded-full bg-zinc-950 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            Sign in with Microsoft
          </button>
        </form>
      </div>
    </div>
  );
}
