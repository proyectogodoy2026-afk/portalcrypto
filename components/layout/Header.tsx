import Link from "next/link";

import UserMenu from "@/components/auth/UserMenu";
import NotificationBell from "@/components/notifications/NotificationBell";

export default function Header() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-zinc-200 bg-white/80 px-4 backdrop-blur">
      <Link href="/" className="text-sm font-semibold tracking-tight text-zinc-900">
        PortalCrypto
      </Link>
      <nav className="hidden flex-1 items-center justify-center gap-2 md:flex">
        <Link
          href="/"
          className="rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
        >
          Feed
        </Link>
        <Link
          href="/scam-radar"
          className="rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
        >
          Scam Radar
        </Link>
        <Link
          href="/markets"
          className="rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
        >
          Mercados
        </Link>
        <Link
          href="/post/new"
          className="rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
        >
          Crear post
        </Link>
        <Link
          href="/onboarding"
          className="rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
        >
          Onboarding
        </Link>
        <Link
          href="/profile"
          className="rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
        >
          Perfil
        </Link>
      </nav>
      <div className="flex items-center gap-2">
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}
