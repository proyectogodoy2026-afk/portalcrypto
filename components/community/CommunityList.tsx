"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils/cn";
import type { Database } from "@/lib/supabase/types";

type Community = Database["public"]["Tables"]["communities"]["Row"];

function riskColor(value: string | null) {
  if (value === "low" || value === "bajo") return "bg-emerald-500";
  if (value === "medium" || value === "medio") return "bg-amber-500";
  if (value === "high" || value === "alto") return "bg-red-500";
  return "bg-zinc-300";
}

function sortCommunities(communities: Community[]) {
  return communities.slice().sort((a, b) => {
    const aName = a.name?.toLowerCase?.() ?? "";
    const bName = b.name?.toLowerCase?.() ?? "";
    return aName.localeCompare(bName);
  });
}

export default function CommunityList({ communities }: { communities: Community[] }) {
  const pathname = usePathname();
  const list = sortCommunities(communities);

  return (
    <div className="space-y-1">
      {list.map((c) => {
        const href = c.slug ? `/c/${encodeURIComponent(c.slug)}` : "/";
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={c.id}
            href={href}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm",
              active ? "bg-zinc-900 text-white" : "text-zinc-900 hover:bg-zinc-100",
            )}
          >
            {c.icon_url ? (
              <Image
                src={c.icon_url}
                alt=""
                width={20}
                height={20}
                className="h-5 w-5 shrink-0 rounded-full"
                unoptimized
              />
            ) : (
              <div
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                  active ? "bg-white/20" : "bg-zinc-200 text-zinc-700",
                )}
              >
                {(c.name ?? "?").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{c.name}</div>
              <div className={cn("text-xs", active ? "text-white/70" : "text-zinc-500")}>
                {(c.member_count ?? 0).toLocaleString()} miembros
              </div>
            </div>
            <div className={cn("h-2.5 w-2.5 rounded-full", riskColor(c.risk_level ?? null))} />
          </Link>
        );
      })}
    </div>
  );
}
