import { redirect } from "next/navigation";

import PostEditor from "@/components/post/PostEditor";
import type { CommunityOption } from "@/components/post/PostEditor";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewPostPage({
  searchParams,
}: {
  searchParams: { community?: string; coin?: string; coin_name?: string; coin_symbol?: string };
}) {
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

  const admin = createSupabaseAdminClient();
  const { data: memberships } = await admin
    .from("community_memberships")
    .select("community_id")
    .eq("user_id", session.user.id)
    .limit(5000);

  const communityIds = (memberships ?? [])
    .map((m) => (m as unknown as { community_id?: string | null }).community_id ?? null)
    .filter(Boolean) as string[];

  const { data: communities } =
    communityIds.length > 0
      ? await admin
          .from("communities")
          .select("id,name,slug,type,member_count")
          .eq("status", "approved")
          .in("id", communityIds)
          .order("member_count", { ascending: false, nullsFirst: false })
      : { data: [] as unknown[] };

  const requestedCommunityId = (searchParams.community ?? "").trim() || null;
  const defaultCommunityId = requestedCommunityId && communityIds.includes(requestedCommunityId)
    ? requestedCommunityId
    : null;
  const coinId = (searchParams.coin ?? "").trim();
  const coinName = (searchParams.coin_name ?? "").trim();
  const coinSymbol = (searchParams.coin_symbol ?? "").trim();
  const defaultAnchoredCoin =
    coinId && coinName && coinSymbol
      ? { id: coinId, name: coinName, symbol: coinSymbol, thumb: "" }
      : null;
  return (
    <PostEditor
      communities={(communities ?? []) as CommunityOption[]}
      defaultCommunityId={defaultCommunityId}
      defaultAnchoredCoin={defaultAnchoredCoin}
    />
  );
}
