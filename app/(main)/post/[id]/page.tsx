import { redirect } from "next/navigation";

import CommentsSection, { type CommentRow } from "@/components/comments/CommentsSection";
import PostCard, { type FeedPost } from "@/components/post/PostCard";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PostPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
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

  const { data: post } = await supabase
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
    .eq("id", id)
    .neq("is_removed", true)
    .maybeSingle();

  if (!post) {
    redirect("/");
  }

  const { data: vote } = await supabase
    .from("votes")
    .select("vote_type")
    .eq("user_id", session.user.id)
    .eq("target_type", "post")
    .eq("target_id", id)
    .maybeSingle();

  const enhanced = {
    ...(post as unknown as Record<string, unknown>),
    user_vote:
      (vote as unknown as { vote_type?: string } | null)?.vote_type === "bullish" ||
      (vote as unknown as { vote_type?: string } | null)?.vote_type === "bearish"
        ? ((vote as unknown as { vote_type?: string } | null)?.vote_type ?? null)
        : null,
  };

  const { data: comments } = await supabase
    .from("comments")
    .select("id,author_id,content,created_at,profiles ( username, avatar_url )")
    .eq("post_id", id)
    .neq("is_removed", true)
    .order("created_at", { ascending: true, nullsFirst: false })
    .limit(100);

  return (
    <div className="space-y-4">
      <PostCard post={enhanced as unknown as FeedPost} />
      <CommentsSection postId={id} comments={(comments ?? []) as unknown as CommentRow[]} />
    </div>
  );
}
