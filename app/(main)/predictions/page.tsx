import { redirect } from "next/navigation";

import PredictionsClient from "@/components/predictions/PredictionsClient";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Prediction } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

type RankingRow = {
  user_id: string;
  correct: number;
  total: number;
  ratio: number;
  username: string | null;
  avatar_url: string | null;
};

export default async function PredictionsPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/auth/login");
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("onboarding_completed,username")
    .eq("id", session.user.id)
    .maybeSingle();
  const profile = profileData as unknown as { onboarding_completed: boolean | null; username: string | null } | null;

  if (!(profile?.onboarding_completed ?? false)) {
    redirect("/onboarding");
  }

  const { data: pending } = await supabase
    .from("predictions")
    .select(
      "id,user_id,coin_id,coin_symbol,direction,target_price,target_date,description,price_at_creation,price_at_resolution,status,resolved_at,created_at",
    )
    .eq("user_id", session.user.id)
    .eq("status", "pending")
    .order("target_date", { ascending: true, nullsFirst: false });

  const { data: resolved } = await supabase
    .from("predictions")
    .select(
      "id,user_id,coin_id,coin_symbol,direction,target_price,target_date,description,price_at_creation,price_at_resolution,status,resolved_at,created_at",
    )
    .eq("user_id", session.user.id)
    .in("status", ["correct", "incorrect"])
    .order("resolved_at", { ascending: false, nullsFirst: false });

  const ranking = await getMonthlyRanking(supabase);

  return (
    <PredictionsClient
      username={profile?.username ?? null}
      initialPending={(pending ?? []) as unknown as Prediction[]}
      initialResolved={(resolved ?? []) as unknown as Prediction[]}
      initialRanking={ranking}
    />
  );
}

async function getMonthlyRanking(supabase: ReturnType<typeof createSupabaseServerClient>) {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
  const monthStartIso = monthStart.toISOString();

  const { data: rows } = await supabase
    .from("predictions")
    .select("user_id,status,resolved_at")
    .in("status", ["correct", "incorrect"])
    .gte("resolved_at", monthStartIso)
    .limit(2000);

  const agg = new Map<string, { correct: number; total: number }>();
  for (const r of (rows ?? []) as Array<{ user_id: string; status: string }>) {
    const current = agg.get(r.user_id) ?? { correct: 0, total: 0 };
    current.total += 1;
    if (r.status === "correct") current.correct += 1;
    agg.set(r.user_id, current);
  }

  const userIds = Array.from(agg.keys());
  if (userIds.length === 0) return [] as RankingRow[];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,username,avatar_url")
    .in("id", userIds);

  const profileMap = new Map<string, { username: string | null; avatar_url: string | null }>();
  for (const p of (profiles ?? []) as Array<{ id: string; username: string | null; avatar_url: string | null }>) {
    profileMap.set(p.id, { username: p.username ?? null, avatar_url: p.avatar_url ?? null });
  }

  const ranking: RankingRow[] = userIds
    .map((id) => {
      const counts = agg.get(id) ?? { correct: 0, total: 0 };
      const ratio = counts.total > 0 ? counts.correct / counts.total : 0;
      const info = profileMap.get(id) ?? { username: null, avatar_url: null };
      return { user_id: id, correct: counts.correct, total: counts.total, ratio, ...info };
    })
    .sort((a, b) => {
      if (b.ratio !== a.ratio) return b.ratio - a.ratio;
      if (b.correct !== a.correct) return b.correct - a.correct;
      return b.total - a.total;
    })
    .slice(0, 20);

  return ranking;
}

