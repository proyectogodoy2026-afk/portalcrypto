import Link from "next/link";

import { getPrices } from "@/lib/api/coingecko";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Row = {
  id: string;
  title: string;
  community_id: string;
  anchored_coin_id: string | null;
  bullish_votes: number | null;
  comment_count: number | null;
  created_at: string | null;
  communities?: { name: string | null; slug: string | null } | null;
};

function getSinceIso() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}

function truncate(value: string, max = 56) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

export default async function TrendingWidget() {
  const supabase = await createSupabaseServerClient();
  const sinceIso = getSinceIso();

  const { data } = await supabase
    .from("posts")
    .select("id,title,community_id,anchored_coin_id,bullish_votes,comment_count,created_at,communities(name,slug)")
    .gte("created_at", sinceIso)
    .neq("is_removed", true)
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(120);

  const rows = (data ?? []) as unknown as Row[];
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-3">
        <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Trending hoy</div>
        <div className="mt-2 text-sm text-zinc-600">Sin actividad relevante en las últimas 24h.</div>
      </div>
    );
  }

  const coinIds = Array.from(new Set(rows.map((r) => r.anchored_coin_id).filter(Boolean))) as string[];
  const prices = coinIds.length > 0 ? await getPrices(coinIds) : [];
  const momentumMap = new Map<string, number>(
    prices.map((p) => [p.id, Math.abs(p.price_change_percentage_24h) > 5 ? 1.5 : 1]),
  );

  const ranked = rows
    .map((r) => {
      const bullishVotes = r.bullish_votes ?? 0;
      const comments = r.comment_count ?? 0;
      const views = 0;
      const multiplier = r.anchored_coin_id ? (momentumMap.get(r.anchored_coin_id) ?? 1) : 1;
      const score = (bullishVotes * 1.5 + comments * 2 + views * 0.5) * multiplier;
      return { row: r, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Trending hoy</div>
      <div className="mt-2 space-y-2">
        {ranked.map(({ row, score }) => (
          <Link key={row.id} href={`/post/${row.id}`} className="block rounded-md px-2 py-1.5 hover:bg-zinc-50">
            <div className="truncate text-sm font-medium text-zinc-900">{truncate(row.title)}</div>
            <div className="mt-0.5 flex items-center justify-between text-xs text-zinc-600">
              <span>{row.communities?.name ?? "Comunidad"}</span>
              <span>Score {score.toFixed(1)}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
