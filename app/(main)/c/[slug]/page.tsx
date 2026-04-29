import { redirect } from "next/navigation";

import Feed from "@/components/post/Feed";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import type { FeedPost } from "@/components/post/PostCard";

export const dynamic = "force-dynamic";

type CommunityRow = Database["public"]["Tables"]["communities"]["Row"];

export default async function CommunityPage({
  params,
}: {
  params: { slug: string };
}) {
  const { slug } = params;

  const supabase = createSupabaseServerClient();
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
    .eq("slug", slug)
    .maybeSingle();

  const typedCommunity = community as unknown as Pick<
    CommunityRow,
    "id" | "name" | "slug" | "type" | "member_count"
  > | null;

  if (!typedCommunity) {
    redirect("/");
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
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">
          {typedCommunity.name ?? "Comunidad"}
        </h1>
        <div className="text-sm text-zinc-600">/c/{slug}</div>
      </div>
      <Feed
        initialPosts={basePosts as unknown as FeedPost[]}
        communitySlug={slug}
      />
    </div>
  );
}
