import { redirect } from "next/navigation";

import PostEditor from "@/components/post/PostEditor";
import type { CommunityOption } from "@/components/post/PostEditor";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  const { data: communities } = await supabase
    .from("communities")
    .select("id,name,slug,type,member_count")
    .order("member_count", { ascending: false, nullsFirst: false });

  const defaultCommunityId = (searchParams.community ?? "").trim() || null;
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
