import Link from "next/link";

import TokenProfileCard from "@/components/scam/TokenProfileCard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TokenProfile } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

type ScamGroup = {
  key: string;
  target_type: string;
  target_id: string | null;
  project_name: string | null;
  reason: string;
  report_count: number;
  last_reported_at: string | null;
  title: string | null;
};

const REASONS = [
  "fake-project",
  "rug-pull",
  "phishing",
  "fake-giveaway",
  "pump-dump",
  "other",
] as const;

export default async function ScamRadarPage({
  searchParams,
}: {
  searchParams: { reason?: string };
}) {
  const supabase = createSupabaseServerClient();
  const reason = (searchParams.reason ?? "").trim();

  let query = supabase
    .from("scam_reports")
    .select("id,target_type,target_id,project_name,reason,created_at,status")
    .eq("status", "confirmed")
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(2000);

  if (reason) {
    query = query.eq("reason", reason);
  }

  const { data: reports } = await query;
  const items = (reports ?? []) as Array<{
    target_type: string;
    target_id: string | null;
    project_name: string | null;
    reason: string;
    created_at: string | null;
  }>;

  const grouped = new Map<string, Omit<ScamGroup, "title"> & { title?: string | null }>();
  for (const r of items) {
    const key =
      r.target_type === "project"
        ? `project:${(r.project_name ?? "").toLowerCase()}`
        : `${r.target_type}:${r.target_id ?? ""}`;
    const g = grouped.get(key) ?? {
      key,
      target_type: r.target_type,
      target_id: r.target_id ?? null,
      project_name: r.project_name ?? null,
      reason: r.reason,
      report_count: 0,
      last_reported_at: null as string | null,
      title: null as string | null,
    };
    g.report_count += 1;
    if (!g.last_reported_at || (r.created_at ?? "") > g.last_reported_at) {
      g.last_reported_at = r.created_at ?? null;
    }
    grouped.set(key, g);
  }

  const groups = Array.from(grouped.values()).sort((a, b) => {
    if (b.report_count !== a.report_count) return b.report_count - a.report_count;
    return String(b.last_reported_at ?? "").localeCompare(String(a.last_reported_at ?? ""));
  }) as ScamGroup[];

  const postIds = groups
    .filter((g) => g.target_type === "post" && g.target_id)
    .map((g) => g.target_id as string);

  if (postIds.length > 0) {
    const { data: posts } = await supabase
      .from("posts")
      .select("id,title")
      .in("id", postIds);
    const postMap = new Map<string, string>();
    for (const p of (posts ?? []) as Array<{ id: string; title: string }>) {
      postMap.set(p.id, p.title);
    }
    for (const g of groups) {
      if (g.target_type === "post" && g.target_id) {
        g.title = postMap.get(g.target_id) ?? null;
      }
    }
  }

  const { data: tokenProfiles } = await supabase
    .from("token_profiles")
    .select(
      "id,coin_id,symbol,name,has_real_product,team_is_public,launch_date,website_url,whitepaper_url,is_reported,report_count,community_summary,risk_score,created_at,updated_at",
    )
    .gt("report_count", 0)
    .order("report_count", { ascending: false, nullsFirst: false })
    .limit(50);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Scam Radar</h1>
        <div className="mt-1 text-sm text-zinc-600">
          Historial público de contenido/proyectos confirmados por moderación.
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/scam-radar"
          className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 hover:bg-zinc-50"
        >
          Todos
        </Link>
        {REASONS.map((r) => (
          <Link
            key={r}
            href={`/scam-radar?reason=${encodeURIComponent(r)}`}
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 hover:bg-zinc-50"
          >
            {r}
          </Link>
        ))}
      </div>

      <div className="space-y-3">
        {groups.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
            No hay ítems confirmados para mostrar.
          </div>
        ) : (
          groups.map((g) => (
            <div key={g.key} className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-zinc-900">
                    {g.target_type === "project"
                      ? g.project_name ?? "Proyecto"
                      : g.target_type === "post"
                        ? g.title ?? "Post"
                        : "Contenido"}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {g.reason} · {g.report_count} reportes
                  </div>
                </div>
                {g.target_type === "post" && g.target_id ? (
                  <Link
                    href={`/post/${g.target_id}`}
                    className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 hover:bg-zinc-50"
                  >
                    Ver post
                  </Link>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="space-y-3">
        <div className="text-sm font-medium text-zinc-900">Fichas de tokens reportados</div>
        {(tokenProfiles ?? []).length === 0 ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
            Todavía no hay tokens con reportes.
          </div>
        ) : (
          (tokenProfiles as unknown as TokenProfile[]).map((t) => (
            <TokenProfileCard key={t.id} token={t} />
          ))
        )}
      </div>
    </div>
  );
}

