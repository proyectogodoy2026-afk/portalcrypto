import { createSupabaseRouteClient } from "@/lib/supabase/server";

type FeedOrder = "recent" | "trending" | "bull" | "bear";

function parseOrder(value: string | null): FeedOrder {
  if (value === "trending" || value === "bull" || value === "bear") return value;
  return "recent";
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const order = parseOrder(url.searchParams.get("order"));
  const communitySlug = (url.searchParams.get("community") ?? "").trim();
  const offsetRaw = url.searchParams.get("offset");
  const offset = Math.max(0, Number(offsetRaw ?? 0) || 0);

  const supabase = createSupabaseRouteClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return Response.json({ message: "No autenticado" }, { status: 401 });
  }

  let communityId: string | null = null;
  if (communitySlug) {
    const { data: community } = await supabase
      .from("communities")
      .select("id")
      .eq("slug", communitySlug)
      .maybeSingle();

    communityId = community?.id ?? null;
    if (!communityId) {
      return Response.json({ posts: [], nextOffset: null }, { status: 200 });
    }
  }

  let query = supabase
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
    .neq("is_removed", true);

  if (communityId) {
    query = query.eq("community_id", communityId);
  }

  if (order === "recent") {
    query = query.order("created_at", { ascending: false, nullsFirst: false });
  } else if (order === "trending") {
    query = query
      .order("comment_count", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false, nullsFirst: false });
  } else if (order === "bull") {
    query = query
      .gt("bullish_votes", 0)
      .order("bullish_votes", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false, nullsFirst: false });
  } else if (order === "bear") {
    query = query
      .gt("bearish_votes", 0)
      .order("bearish_votes", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false, nullsFirst: false });
  }

  const { data, error } = await query.range(offset, offset + 19);
  if (error) {
    return Response.json({ message: "No pudimos cargar el feed." }, { status: 500 });
  }

  const posts = (data ?? []) as unknown[];
  const postIds = (posts as Array<{ id: string }>).map((p) => p.id).filter(Boolean);

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

    for (const p of posts as Array<Record<string, unknown>>) {
      const id = p.id as string;
      const v = map.get(id) ?? null;
      p.user_vote = v === "bullish" || v === "bearish" ? v : null;
    }
  }
  const nextOffset = posts.length === 20 ? offset + 20 : null;

  return Response.json({ posts, nextOffset }, { status: 200 });
}
