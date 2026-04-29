import { z } from "zod";

import { getPrice } from "@/lib/api/coingecko";
import { createSupabaseRouteClient } from "@/lib/supabase/server";

const createSchema = z.object({
  coin_id: z.string().min(1),
  coin_symbol: z.string().min(1).max(16),
  direction: z.enum(["above", "below"]),
  target_price: z.coerce.number().positive("Ingresá un precio objetivo válido"),
  term_days: z.coerce.number().refine((v) => [7, 14, 30, 90].includes(v), "Plazo inválido"),
  description: z.string().max(200).optional().nullable(),
});

export async function GET(req: Request) {
  const supabase = createSupabaseRouteClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return Response.json({ message: "No autenticado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const status = (url.searchParams.get("status") ?? "pending").trim();

  let query = supabase
    .from("predictions")
    .select(
      "id,user_id,coin_id,coin_symbol,direction,target_price,target_date,description,price_at_creation,price_at_resolution,status,resolved_at,created_at",
    )
    .eq("user_id", session.user.id);

  if (status === "resolved") {
    query = query.in("status", ["correct", "incorrect"]).order("resolved_at", {
      ascending: false,
      nullsFirst: false,
    });
  } else {
    query = query.eq("status", "pending").order("target_date", {
      ascending: true,
      nullsFirst: false,
    });
  }

  const { data, error } = await query;
  if (error) {
    return Response.json({ message: "No pudimos cargar las predicciones." }, { status: 500 });
  }

  return Response.json({ predictions: data ?? [] }, { status: 200 });
}

export async function POST(req: Request) {
  const supabase = createSupabaseRouteClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return Response.json({ message: "No autenticado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ message: "Body inválido" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { message: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }

  const now = Date.now();
  const targetDate = new Date(now + parsed.data.term_days * 24 * 60 * 60 * 1000).toISOString();

  let priceAtCreation: number | null = null;
  try {
    const coin = await getPrice(parsed.data.coin_id);
    priceAtCreation =
      typeof coin.current_price === "number" ? coin.current_price : null;
  } catch {
    priceAtCreation = null;
  }

  const { data: inserted, error } = await supabase
    .from("predictions")
    .insert({
      user_id: session.user.id,
      coin_id: parsed.data.coin_id,
      coin_symbol: parsed.data.coin_symbol.toLowerCase(),
      direction: parsed.data.direction,
      target_price: parsed.data.target_price,
      target_date: targetDate,
      description: parsed.data.description?.trim() ? parsed.data.description.trim() : null,
      price_at_creation: priceAtCreation,
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !inserted?.id) {
    return Response.json({ message: "No pudimos crear la predicción." }, { status: 500 });
  }

  return Response.json({ id: inserted.id }, { status: 200 });
}

