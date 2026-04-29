import { redirect } from "next/navigation";
import Link from "next/link";

import Feed from "@/components/post/Feed";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { FeedPost } from "@/components/post/PostCard";
import { cn } from "@/lib/utils/cn";

export const dynamic = "force-dynamic";

function riskColor(value: string | null) {
  if (value === "bajo" || value === "low") return "bg-emerald-500";
  if (value === "medio" || value === "medium") return "bg-amber-500";
  if (value === "alto" || value === "high") return "bg-red-500";
  return "bg-zinc-300";
}

export default async function FeedPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/auth/login");
  }

  const { data } = await supabase
    .from("profiles")
    .select("onboarding_completed,preferred_mode")
    .eq("id", session.user.id)
    .maybeSingle();
  const profile = data as unknown as {
    onboarding_completed: boolean | null;
    preferred_mode: string | null;
  } | null;

  if (!(profile?.onboarding_completed ?? false)) {
    redirect("/onboarding");
  }

  const isBeginner = profile?.preferred_mode === "beginner";
  if (isBeginner) {
    const { data: rawQuestions } = await supabase
      .from("posts")
      .select(
        `
        id,
        title,
        author_id,
        community_id,
        type,
        tag,
        risk_indicator,
        bullish_votes,
        bearish_votes,
        comment_count,
        created_at,
        profiles ( username, avatar_url, karma_total ),
        communities ( name, slug, risk_level, icon_url, type, member_count )
      `,
      )
      .in("type", ["question", "pregunta"])
      .neq("is_removed", true)
      .order("created_at", { ascending: false, nullsFirst: false })
      .limit(50);

    const questions = (rawQuestions ?? []) as unknown as FeedPost[];
    const ranked = [...questions].sort((a, b) => {
      const aScore =
        (a.comment_count ?? 0) * 2 + (a.bullish_votes ?? 0) + (a.bearish_votes ?? 0);
      const bScore =
        (b.comment_count ?? 0) * 2 + (b.bullish_votes ?? 0) + (b.bearish_votes ?? 0);
      return bScore - aScore;
    });

    const top = ranked.slice(0, 6);

    const { data: beginnerCommunity } = await supabase
      .from("communities")
      .select("id")
      .eq("slug", "beginners")
      .maybeSingle();

    const { data: rawBeginnerQuestions } = beginnerCommunity?.id
      ? await supabase
          .from("posts")
          .select("id,title,risk_indicator,created_at,comment_count")
          .eq("community_id", beginnerCommunity.id)
          .in("type", ["question", "pregunta"])
          .neq("is_removed", true)
          .order("created_at", { ascending: false, nullsFirst: false })
          .limit(8)
      : { data: [] as unknown[] };

    const beginnerQuestions = (rawBeginnerQuestions ?? []) as Array<{
      id: string;
      title: string;
      risk_indicator: string | null;
      created_at: string | null;
      comment_count: number | null;
    }>;

    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Preguntas del día</h1>
          <div className="mt-1 text-sm text-zinc-600">
            Elegí una pregunta y leemos juntos qué pasó, sin jerga.
          </div>
        </div>

        {top.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
            Todavía no hay preguntas.
          </div>
        ) : (
          <div className="space-y-2">
            {top.map((p) => (
              <Link
                key={p.id}
                href={`/post/${p.id}`}
                className="flex items-start justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 hover:bg-zinc-50"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-zinc-900">
                    ❓ {p.title}
                  </div>
                  <div className="mt-1 text-xs text-zinc-600">
                    {(p.comment_count ?? 0).toLocaleString()} comentarios
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs text-zinc-600">
                  <div className={cn("h-2.5 w-2.5 rounded-full", riskColor(p.risk_indicator ?? null))} />
                  <span className="capitalize">{p.risk_indicator ?? "—"}</span>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div>
          <div className="text-sm font-semibold text-zinc-900">
            Otros principiantes preguntan…
          </div>
          <div className="mt-3 space-y-2">
            {beginnerQuestions.length === 0 ? (
              <div className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
                Todavía no hay preguntas en /c/beginners.
              </div>
            ) : (
              beginnerQuestions.map((p) => (
                <Link
                  key={p.id}
                  href={`/post/${p.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 hover:bg-zinc-50"
                >
                  <div className="min-w-0 truncate text-sm text-zinc-900">❓ {p.title}</div>
                  <div className="flex shrink-0 items-center gap-2 text-xs text-zinc-600">
                    <div className={cn("h-2.5 w-2.5 rounded-full", riskColor(p.risk_indicator ?? null))} />
                    <span className="capitalize">{p.risk_indicator ?? "—"}</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  const { data: initialPosts } = await supabase
    .from("posts")
    .select(
      `
      id,
      author_id,
      community_id,
      title,
      content,
      type,
      tag,
      url,
      what_happened,
      why_it_matters,
      who_is_affected,
      anchored_coin_id,
      price_at_post,
      risk_indicator,
      bullish_votes,
      bearish_votes,
      scam_reports,
      is_flagged,
      comment_count,
      created_at,
      profiles ( username, avatar_url, karma_total ),
      communities ( name, slug, risk_level, icon_url, type, member_count )
    `,
    )
    .neq("is_removed", true)
    .order("created_at", { ascending: false, nullsFirst: false })
    .range(0, 19);

  const basePosts = (initialPosts ?? []) as Array<Record<string, unknown>>;
  const postIds = basePosts.map((p) => p.id as string).filter(Boolean);

  if (postIds.length > 0) {
    const counts = new Map<string, { bullish: number; bearish: number }>();
    const { data: allVotes } = await supabase
      .from("votes")
      .select("target_id,vote_type")
      .eq("target_type", "post")
      .in("target_id", postIds)
      .in("vote_type", ["bullish", "bearish"])
      .limit(5000);

    for (const v of (allVotes ?? []) as Array<{ target_id: string; vote_type: string }>) {
      const current = counts.get(v.target_id) ?? { bullish: 0, bearish: 0 };
      if (v.vote_type === "bullish") current.bullish += 1;
      if (v.vote_type === "bearish") current.bearish += 1;
      counts.set(v.target_id, current);
    }

    const { data: votes } = await supabase
      .from("votes")
      .select("target_id,vote_type")
      .eq("user_id", session.user.id)
      .eq("target_type", "post")
      .in("target_id", postIds);

    const map = new Map<string, string>();
    for (const v of (votes ?? []) as Array<{ target_id: string; vote_type: string }>) {
      map.set(v.target_id, v.vote_type);
    }

    for (const p of basePosts) {
      const id = p.id as string;
      const v = map.get(id) ?? null;
      p.user_vote = v === "bullish" || v === "bearish" ? v : null;
      const c = counts.get(id) ?? { bullish: 0, bearish: 0 };
      p.bullish_votes = c.bullish;
      p.bearish_votes = c.bearish;
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-zinc-900">Feed</h1>
      <Feed initialPosts={basePosts as unknown as FeedPost[]} />
    </div>
  );
}
