import { redirect } from "next/navigation";

import AlertsSettingsForm from "@/components/settings/AlertsSettingsForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PriceAlert = {
  id: string;
  coin_id: string;
  coin_symbol: string;
  direction: "above" | "below";
  target_price: number;
  created_at: string;
  triggered_at?: string | null;
};

function parsePriceAlerts(value: unknown): PriceAlert[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((a) => a as Partial<PriceAlert>)
    .filter((a) => typeof a?.coin_id === "string" && typeof a?.direction === "string")
    .map((a) => ({
      id: typeof a.id === "string" ? a.id : crypto.randomUUID(),
      coin_id: a.coin_id!,
      coin_symbol: typeof a.coin_symbol === "string" ? a.coin_symbol : a.coin_id!,
      direction: (a.direction === "below" ? "below" : "above") as "above" | "below",
      target_price: typeof a.target_price === "number" ? a.target_price : Number(a.target_price ?? 0),
      created_at: typeof a.created_at === "string" ? a.created_at : new Date().toISOString(),
      triggered_at: typeof a.triggered_at === "string" ? a.triggered_at : null,
    }))
    .filter((a) => Number.isFinite(a.target_price) && a.target_price > 0);
}

export default async function AlertsSettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) redirect("/auth/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select(
      "notify_comment_replies,notify_prediction_resolved,notify_vote_milestone,notify_scam_alerts,followed_tokens,followed_communities,price_alerts",
    )
    .eq("id", session.user.id)
    .maybeSingle();

  const p = (error ? {} : (profile ?? {})) as {
    notify_comment_replies?: boolean | null;
    notify_prediction_resolved?: boolean | null;
    notify_vote_milestone?: boolean | null;
    notify_scam_alerts?: boolean | null;
    followed_tokens?: string[] | null;
    followed_communities?: string[] | null;
    price_alerts?: unknown;
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-zinc-900">Notificaciones y alertas</h1>
      <AlertsSettingsForm
        initial={{
          notify_comment_replies: p.notify_comment_replies ?? true,
          notify_prediction_resolved: p.notify_prediction_resolved ?? true,
          notify_vote_milestone: p.notify_vote_milestone ?? true,
          notify_scam_alerts: p.notify_scam_alerts ?? true,
          followed_tokens: Array.isArray(p.followed_tokens) ? p.followed_tokens.filter((s) => typeof s === "string") : [],
          followed_communities: Array.isArray(p.followed_communities)
            ? p.followed_communities.filter((s) => typeof s === "string")
            : [],
          price_alerts: parsePriceAlerts(p.price_alerts),
        }}
      />
    </div>
  );
}
