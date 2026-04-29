import Link from "next/link";

import CommunityList from "@/components/community/CommunityList";
import OnboardingChecklist from "@/components/onboarding/OnboardingChecklist";
import TrendingWidget from "@/components/trending/TrendingWidget";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function Sidebar() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { data: profile } = session
    ? await supabase
        .from("profiles")
        .select("preferred_mode,onboarding_step")
        .eq("id", session.user.id)
        .maybeSingle()
    : { data: null };

  const preferredMode = (profile as unknown as { preferred_mode?: string | null } | null)
    ?.preferred_mode;
  const onboardingStep = Math.max(
    0,
    Math.min(
      10,
      (profile as unknown as { onboarding_step?: number | null } | null)?.onboarding_step ?? 0,
    ),
  );
  const shouldHideHighRisk = preferredMode === "beginner" && onboardingStep < 10;

  const { data } = await supabase
    .from("communities")
    .select("id,name,slug,type,member_count,icon_url,risk_level,created_at")
    .order("member_count", { ascending: false, nullsFirst: false });

  const baseCommunities = (data ?? []) as unknown as Array<{
    id: string;
    name: string;
    slug: string;
    type: string | null;
    member_count: number | null;
    icon_url: string | null;
    risk_level: string | null;
    created_at: string | null;
  }>;

  const communities = shouldHideHighRisk
    ? baseCommunities.filter((c) => {
        const r = (c.risk_level ?? "").toLowerCase();
        return !(r === "high" || r === "alto");
      })
    : baseCommunities;

  return (
    <aside className="hidden w-64 shrink-0 border-r border-zinc-200 bg-white p-4 md:block">
      <nav className="space-y-1">
        <Link
          href="/"
          className="block rounded-md px-3 py-2 text-sm text-zinc-900 hover:bg-zinc-100"
        >
          Feed
        </Link>
        <Link
          href="/scam-radar"
          className="block rounded-md px-3 py-2 text-sm text-zinc-900 hover:bg-zinc-100"
        >
          Scam Radar
        </Link>
        <Link
          href="/post/new"
          className="block rounded-md px-3 py-2 text-sm text-zinc-900 hover:bg-zinc-100"
        >
          Crear post
        </Link>
        <Link
          href="/onboarding"
          className="block rounded-md px-3 py-2 text-sm text-zinc-900 hover:bg-zinc-100"
        >
          Onboarding
        </Link>
        <Link
          href="/profile"
          className="block rounded-md px-3 py-2 text-sm text-zinc-900 hover:bg-zinc-100"
        >
          Perfil
        </Link>
      </nav>

      <div className="mt-6">
        {preferredMode === "beginner" ? <OnboardingChecklist initialStep={onboardingStep} /> : null}
        <div className="mb-4">
          <TrendingWidget />
        </div>

        <div className="mb-2 px-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Comunidades
        </div>
        <CommunityList communities={communities} />
      </div>
    </aside>
  );
}
