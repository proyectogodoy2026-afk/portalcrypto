import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type PredictionRow = {
  id: string;
  user_id: string;
  coin_id: string;
  direction: string;
  target_price: number;
};

type ProfileRow = {
  id: string;
  karma_predictions: number | null;
  predictions_correct: number | null;
  predictions_total: number | null;
};

async function fetchPrices(coinIds: string[]) {
  const ids = coinIds.map((c) => c.trim()).filter(Boolean);
  if (ids.length === 0) return new Map<string, number>();

  const params = new URLSearchParams();
  params.set("ids", ids.join(","));
  params.set("vs_currencies", "usd");
  const url = `https://api.coingecko.com/api/v3/simple/price?${params.toString()}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("CoinGecko error");
  }
  const data = (await res.json()) as Record<string, { usd?: number }>;
  const map = new Map<string, number>();
  for (const id of ids) {
    const v = data?.[id]?.usd;
    if (typeof v === "number") map.set(id, v);
  }
  return map;
}

Deno.serve(async () => {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SERVICE_ROLE_KEY");

  if (!url || !key) {
    return new Response(JSON.stringify({ ok: false, message: "Missing env" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const supabase = createClient(url, key);
  const nowIso = new Date().toISOString();

  const { data: predictions, error: pErr } = await supabase
    .from("predictions")
    .select("id,user_id,coin_id,direction,target_price")
    .eq("status", "pending")
    .lte("target_date", nowIso)
    .limit(500);

  if (pErr) {
    return new Response(JSON.stringify({ ok: false, message: "Query error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const pending = (predictions ?? []) as unknown as PredictionRow[];
  if (pending.length === 0) {
    return new Response(JSON.stringify({ ok: true, processed: 0 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  const coinIds = Array.from(new Set(pending.map((p) => p.coin_id).filter(Boolean)));
  let priceMap: Map<string, number>;
  try {
    priceMap = await fetchPrices(coinIds);
  } catch {
    return new Response(JSON.stringify({ ok: false, message: "CoinGecko error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const userIds = Array.from(new Set(pending.map((p) => p.user_id).filter(Boolean)));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,karma_predictions,predictions_correct,predictions_total")
    .in("id", userIds);

  const profileMap = new Map<string, ProfileRow>();
  for (const p of (profiles ?? []) as unknown as ProfileRow[]) {
    profileMap.set(p.id, p);
  }

  let processed = 0;
  let updatedProfiles = 0;
  const profileUpdates = new Map<string, { deltaKarma: number; deltaCorrect: number; deltaTotal: number }>();

  for (const pred of pending) {
    const price = priceMap.get(pred.coin_id);
    if (typeof price !== "number") continue;

    const correct =
      pred.direction === "below" ? price <= pred.target_price : price >= pred.target_price;

    const status = correct ? "correct" : "incorrect";

    const { error: upErr } = await supabase
      .from("predictions")
      .update({
        status,
        price_at_resolution: price,
        resolved_at: nowIso,
      })
      .eq("id", pred.id);

    if (upErr) continue;
    processed += 1;

    await supabase.from("notifications").insert({
      user_id: pred.user_id,
      type: "prediction_resolved",
      title: "Tu predicción fue evaluada",
      body: correct
        ? `Acertaste en ${pred.coin_id}. +10 puntos de karma.`
        : `Tu predicción de ${pred.coin_id} no se cumplió esta vez.`,
      link: "/predictions",
      is_read: false,
    });

    const current = profileUpdates.get(pred.user_id) ?? { deltaKarma: 0, deltaCorrect: 0, deltaTotal: 0 };
    current.deltaTotal += 1;
    if (correct) {
      current.deltaKarma += 10;
      current.deltaCorrect += 1;
    }
    profileUpdates.set(pred.user_id, current);
  }

  for (const [userId, delta] of profileUpdates.entries()) {
    const base = profileMap.get(userId) ?? {
      id: userId,
      karma_predictions: 0,
      predictions_correct: 0,
      predictions_total: 0,
    };

    const nextKarma = (base.karma_predictions ?? 0) + delta.deltaKarma;
    const nextCorrect = (base.predictions_correct ?? 0) + delta.deltaCorrect;
    const nextTotal = (base.predictions_total ?? 0) + delta.deltaTotal;

    const { error } = await supabase
      .from("profiles")
      .update({
        karma_predictions: nextKarma,
        predictions_correct: nextCorrect,
        predictions_total: nextTotal,
      })
      .eq("id", userId);

    if (!error) updatedProfiles += 1;
  }

  return new Response(
    JSON.stringify({
      ok: true,
      processed,
      updatedProfiles,
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
});
