import { createSupabaseRouteClient } from "@/lib/supabase/server";

type RankingRow = {
  user_id: string;
  correct: number;
  total: number;
  ratio: number;
  username: string | null;
  avatar_url: string | null;
};

export async function GET() {
  const supabase = createSupabaseRouteClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return Response.json({ message: "No autenticado" }, { status: 401 });
  }

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
  const monthStartIso = monthStart.toISOString();

  const { data: rows, error } = await supabase
    .from("predictions")
    .select("user_id,status,resolved_at")
    .in("status", ["correct", "incorrect"])
    .gte("resolved_at", monthStartIso)
    .limit(2000);

  if (error) {
    return Response.json({ message: "No pudimos cargar el ranking." }, { status: 500 });
  }

  const agg = new Map<string, { correct: number; total: number }>();
  for (const r of (rows ?? []) as Array<{ user_id: string; status: string }>) {
    const current = agg.get(r.user_id) ?? { correct: 0, total: 0 };
    current.total += 1;
    if (r.status === "correct") current.correct += 1;
    agg.set(r.user_id, current);
  }

  const userIds = Array.from(agg.keys());
  if (userIds.length === 0) {
    return Response.json({ ranking: [] satisfies RankingRow[] }, { status: 200 });
  }

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

  return Response.json({ ranking }, { status: 200 });
}

