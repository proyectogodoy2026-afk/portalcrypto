import { redirect } from "next/navigation";
import Link from "next/link";

import Feed from "@/components/post/Feed";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import type { FeedPost } from "@/components/post/PostCard";

export const dynamic = "force-dynamic";

type CommunityRow = Database["public"]["Tables"]["communities"]["Row"];

export default async function CommunityPage({
  params,
}: {
  params: { slug?: string } | Promise<{ slug?: string }>;
}) {
  const resolvedParams = await Promise.resolve(params);
  const slugRaw = String(resolvedParams?.slug ?? "").trim();

  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/auth/login");
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", session.user.id)
    .maybeSingle();
  const profile = profileData as unknown as { onboarding_completed: boolean | null } | null;

  if (!(profile?.onboarding_completed ?? false)) {
    redirect("/onboarding");
  }

  const { data: community } = await supabase
    .from("communities")
    .select("id,name,slug,type,member_count")
    .eq("status", "approved")
    .eq("slug", slugRaw)
    .maybeSingle();

  const { data: communityLower } = !community && slugRaw
    ? await supabase
        .from("communities")
        .select("id,name,slug,type,member_count")
        .eq("status", "approved")
        .eq("slug", slugRaw.toLowerCase())
        .maybeSingle()
    : { data: null };

  const { data: communityIlike } = !community && !communityLower && slugRaw
    ? await supabase
        .from("communities")
        .select("id,name,slug,type,member_count")
        .eq("status", "approved")
        .ilike("slug", slugRaw)
        .maybeSingle()
    : { data: null };

  const typedCommunity = (community ?? communityLower ?? communityIlike) as unknown as Pick<
    CommunityRow,
    "id" | "name" | "slug" | "type" | "member_count"
  > | null;

  if (!typedCommunity) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <div className="text-lg font-semibold text-zinc-900">Comunidad no encontrada</div>
        <div className="mt-1 text-sm text-zinc-600">
          No existe /c/{slugRaw || "—"} en tu base de datos.
        </div>
        <Link
          href="/"
          className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Volver al feed
        </Link>
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
    .eq("community_id", typedCommunity.id)
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

    const commentCounts = new Map<string, number>();
    const { data: commentRows } = await supabase
      .from("comments")
      .select("post_id")
      .in("post_id", postIds)
      .neq("is_removed", true)
      .limit(5000);

    for (const r of (commentRows ?? []) as Array<{ post_id: string }>) {
      commentCounts.set(r.post_id, (commentCounts.get(r.post_id) ?? 0) + 1);
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
      p.comment_count = commentCounts.get(id) ?? 0;
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">
              {typedCommunity.name ?? "Comunidad"}
            </h1>
            <div className="mt-1 text-sm text-zinc-600">/c/{typedCommunity.slug}</div>
            <div className="mt-1 text-xs text-zinc-500">
              {(typedCommunity.member_count ?? 0).toLocaleString()} miembros
            </div>
          </div>
          <Link
            href={`/post/new?community=${encodeURIComponent(typedCommunity.id)}`}
            className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Crear post
          </Link>
        </div>
      </div>
      <Feed
        initialPosts={basePosts as unknown as FeedPost[]}
        communitySlug={typedCommunity.slug ?? slugRaw}
      />
    </div>
  );
}
