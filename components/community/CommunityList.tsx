"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils/cn";
import type { Database } from "@/lib/supabase/types";

type Community = Database["public"]["Tables"]["communities"]["Row"];

const TYPE_ORDER = ["asset", "topic", "region", "level"] as const;

function labelForType(type: string) {
  if (type === "asset") return "Assets";
  if (type === "topic") return "Temas";
  if (type === "region") return "Regiones";
  if (type === "level") return "Nivel";
  return "Otras";
}

function riskColor(value: string | null) {
  if (value === "low" || value === "bajo") return "bg-emerald-500";
  if (value === "medium" || value === "medio") return "bg-amber-500";
  if (value === "high" || value === "alto") return "bg-red-500";
  return "bg-zinc-300";
}

function groupCommunities(communities: Community[]) {
  const buckets = new Map<string, Community[]>();
  for (const c of communities) {
    const key = (c.type ?? "other").toString();
    const list = buckets.get(key) ?? [];
    list.push(c);
    buckets.set(key, list);
  }

  const orderedKeys = [
    ...TYPE_ORDER.filter((t) => buckets.has(t)),
    ...Array.from(buckets.keys()).filter((k) => !TYPE_ORDER.includes(k as never)),
  ];

  return orderedKeys
    .map((k) => ({
      type: k,
      communities: (buckets.get(k) ?? []).slice().sort((a, b) => {
        const aName = a.name?.toLowerCase?.() ?? "";
        const bName = b.name?.toLowerCase?.() ?? "";
        return aName.localeCompare(bName);
      }),
    }))
    .filter((g) => g.communities.length > 0);
}

export default function CommunityList({ communities }: { communities: Community[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const groups = groupCommunities(communities);

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.type} className="space-y-1">
          <div className="px-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            {labelForType(g.type)}
          </div>
          <div className="space-y-1">
            {g.communities.map((c) => {
              const href = c.slug ? `/c/${c.slug}` : "/";
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    const before =
                      typeof window !== "undefined" ? window.location.pathname : null;
                    router.push(href);
                    if (typeof window === "undefined") return;
                    window.setTimeout(() => {
                      if (!before) return;
                      if (window.location.pathname !== before) return;
                      window.location.assign(href);
                    }, 200);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm",
                    active
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-900 hover:bg-zinc-100",
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
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
