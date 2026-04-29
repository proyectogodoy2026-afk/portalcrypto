import Link from "next/link";

import UserMenu from "@/components/auth/UserMenu";
import NotificationBell from "@/components/notifications/NotificationBell";

export default function Header() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-4">
      <Link href="/" className="text-sm font-semibold text-zinc-900">
        PortalCrypto
      </Link>
      <div className="flex items-center gap-2">
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}
