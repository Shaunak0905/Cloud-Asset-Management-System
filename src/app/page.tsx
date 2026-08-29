import Link from "next/link";

// Public landing page (docs/05-authentication.md #9). Anyone visiting a QR
// code lands on /asset/[publicCode] instead of here.
export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 text-center dark:bg-black">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
        Campus Asset Management
      </h1>
      <p className="mt-3 max-w-md text-zinc-600 dark:text-zinc-400">
        QR-based tracking, assignment, and maintenance for campus equipment.
      </p>
      <Link
        href="/login"
        className="mt-8 rounded-full bg-zinc-950 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
      >
        Sign in
      </Link>
    </div>
  );
}
