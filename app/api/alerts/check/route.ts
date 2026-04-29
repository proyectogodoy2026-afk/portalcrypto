import { NextResponse } from "next/server";

import { getPrices } from "@/lib/api/coingecko";
import { createSupabaseRouteClient } from "@/lib/supabase/server";

type PriceAlert = {
  id: string;
  coin_id: string;
  coin_symbol?: string | null;
  direction: "above" | "below";
  target_price: number;
  created_at: string;
  triggered_at?: string | null;
};

function parseAlerts(value: unknown): PriceAlert[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((a) => a as Partial<PriceAlert>)
    .filter((a) => typeof a?.coin_id === "string" && typeof a?.direction === "string")
    .map((a) => ({
      id: typeof a.id === "string" ? a.id : crypto.randomUUID(),
      coin_id: a.coin_id!,
      coin_symbol: typeof a.coin_symbol === "string" ? a.coin_symbol : null,
      direction: (a.direction === "below" ? "below" : "above") as "above" | "below",
      target_price: typeof a.target_price === "number" ? a.target_price : Number(a.target_price ?? 0),
      created_at: typeof a.created_at === "string" ? a.created_at : new Date().toISOString(),
      triggered_at: typeof a.triggered_at === "string" ? a.triggered_at : null,
    }))
    .filter((a) => Number.isFinite(a.target_price) && a.target_price > 0);
}

export async function POST() {
  const supabase = createSupabaseRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ ok: true, processed: 0 });

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("price_alerts")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) return NextResponse.json({ ok: true, processed: 0 });

  const rawAlerts = (profile as unknown as { price_alerts?: unknown } | null)?.price_alerts;
  const alerts = parseAlerts(rawAlerts);
  const pending = alerts.filter((a) => !a.triggered_at);
  if (pending.length === 0) return NextResponse.json({ ok: true, processed: 0 });

  const prices = await getPrices(Array.from(new Set(pending.map((a) => a.coin_id))));
  const priceMap = new Map(prices.map((p) => [p.id, p.current_price]));

  const nowIso = new Date().toISOString();
  let triggered = 0;

  const nextAlerts = alerts.map((a) => {
    if (a.triggered_at) return a;
    const current = priceMap.get(a.coin_id);
    if (typeof current !== "number") return a;

    const ok = a.direction === "above" ? current >= a.target_price : current <= a.target_price;
    if (!ok) return a;

    triggered += 1;
    return { ...a, triggered_at: nowIso };
  });

  if (triggered === 0) return NextResponse.json({ ok: true, processed: 0 });

  const inserts = nextAlerts
    .filter((a) => a.triggered_at === nowIso)
    .map((a) => ({
      user_id: user.id,
      type: "price_alert",
      title: `Alerta de precio: ${a.coin_symbol?.toUpperCase?.() ?? a.coin_id}`,
      body:
        a.direction === "above"
          ? `Superó $${a.target_price.toLocaleString("en-US")}`
          : `Bajó de $${a.target_price.toLocaleString("en-US")}`,
      link: a.coin_id ? `/scam-radar?coin=${encodeURIComponent(a.coin_id)}` : null,
      is_read: false,
    }));

  if (inserts.length > 0) {
    await supabase.from("notifications").insert(inserts);
  }

  const updatePayload: Record<string, unknown> = { price_alerts: nextAlerts };
  while (Object.keys(updatePayload).length > 0) {
    const { error } = await supabase.from("profiles").update(updatePayload).eq("id", user.id);
    if (!error) break;
    const match = /column\s+"([^"]+)"/i.exec(error.message ?? "");
    const missing = match?.[1];
    if (!missing || !(missing in updatePayload)) break;
    delete updatePayload[missing];
  }

  return NextResponse.json({ ok: true, processed: triggered });
}
