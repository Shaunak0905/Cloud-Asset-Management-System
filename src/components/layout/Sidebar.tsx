import Link from "next/link";
import { signOut } from "@/lib/auth/auth";
import type { AppRole } from "@/lib/auth/types";

type NavItem = { href: string; label: string };

const BASE_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/assets", label: "Browse assets" },
  { href: "/assignments", label: "My assignments" },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/admin/buildings", label: "Buildings & Rooms" },
  { href: "/admin/assets", label: "Manage Assets" },
];

export function Sidebar({
  role,
  name,
}: {
  role: AppRole;
  name: string;
}) {
  const navItems = role === "ADMIN" ? [...BASE_NAV, ...ADMIN_NAV] : BASE_NAV;

  return (
    <aside className="flex w-full shrink-0 flex-col border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 md:h-screen md:w-60 md:border-r print:hidden">
      <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <span className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
          Campus Asset Mgmt
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-x-auto p-3 md:overflow-visible">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
        <div className="px-3 py-1">
          <p className="truncate text-sm font-medium text-zinc-950 dark:text-zinc-50">
            {name}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-500">{role}</p>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
