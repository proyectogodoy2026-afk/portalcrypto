"use server";

import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const priceAlertSchema = z.object({
  id: z.string().min(1),
  coin_id: z.string().min(1),
  coin_symbol: z.string().min(1).max(20),
  direction: z.enum(["above", "below"]),
  target_price: z.number().positive(),
  created_at: z.string().min(1),
  triggered_at: z.string().optional().nullable(),
});

const schema = z.object({
  notify_comment_replies: z.boolean(),
  notify_prediction_resolved: z.boolean(),
  notify_vote_milestone: z.boolean(),
  notify_scam_alerts: z.boolean(),
  followed_tokens: z.array(z.string().min(1)).max(50),
  followed_communities: z.array(z.string().min(1)).max(50),
  price_alerts: z.array(priceAlertSchema).max(100),
});

export async function updateAlertSettings(input: z.input<typeof schema>) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false as const, message: "No autenticado." };

  const updatePayload: Record<string, unknown> = {
    notify_comment_replies: parsed.data.notify_comment_replies,
    notify_prediction_resolved: parsed.data.notify_prediction_resolved,
    notify_vote_milestone: parsed.data.notify_vote_milestone,
    notify_scam_alerts: parsed.data.notify_scam_alerts,
    followed_tokens: parsed.data.followed_tokens,
    followed_communities: parsed.data.followed_communities,
    price_alerts: parsed.data.price_alerts,
  };

  let lastErrorMessage: string | null = null;

  while (Object.keys(updatePayload).length > 0) {
    const { error } = await supabase.from("profiles").update(updatePayload as never).eq("id", user.id);
    if (!error) return { ok: true as const };
    lastErrorMessage = error.message ?? null;
    const match = /column\s+"([^"]+)"/i.exec(error.message ?? "");
    const missing = match?.[1];
    if (!missing || !(missing in updatePayload)) break;
    delete updatePayload[missing];
  }

  return {
    ok: false as const,
    message: lastErrorMessage?.toLowerCase().includes("column")
      ? "Tu base de datos todavía no tiene columnas para guardar alertas."
      : "No pudimos guardar tus alertas.",
  };
}
