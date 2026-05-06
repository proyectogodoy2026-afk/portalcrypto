import { z } from "zod";

import { coingeckoFetch } from "@/lib/api/coingecko";
import { createSupabaseAdminClient, createSupabaseRouteClient } from "@/lib/supabase/server";

const advancedSchema = z.object({
  mode: z.literal("advanced"),
  title: z.string().min(10, "El título debe tener al menos 10 caracteres").max(300),
  community_id: z.string().min(1, "Seleccioná una comunidad"),
  type: z
    .enum(["texto", "link", "analisis", "noticia", "alerta"])
    .optional()
    .default("texto"),
  tag: z
    .enum(["news", "rumor", "on-chain", "opinion", "technical-analysis", "scam-alert"])
    .optional()
    .nullable(),
  anchored_coin_id: z.string().optional().nullable(),
  risk_indicator: z.enum(["bajo", "medio", "alto"]).optional().nullable(),
  url: z.string().url("Ingresá un link válido").optional().nullable(),
  content: z.string().optional().nullable(),
});

const beginnerSchema = z.object({
  mode: z.literal("beginner"),
  title: z.string().min(10, "El título debe tener al menos 10 caracteres").max(300),
  community_id: z.string().min(1, "Seleccioná una comunidad"),
  what_happened: z.string().min(1, "Contá qué pasó").max(150),
  why_it_matters: z.string().min(1, "Contá por qué importa").max(150),
  who_is_affected: z.string().max(150).optional().nullable(),
  risk_indicator: z.enum(["bajo", "medio", "alto"]),
});

const createSchema = z.discriminatedUnion("mode", [advancedSchema, beginnerSchema]);

type CoinPriceResponse = Record<
  string,
  {
    usd?: number;
    usd_24h_change?: number;
  }
>;

function toDbPostType(type: "texto" | "link" | "analisis" | "noticia" | "alerta") {
  if (type === "texto") return "text";
  if (type === "analisis") return "analysis";
  if (type === "noticia") return "news";
  if (type === "alerta") return "alert";
  return "link";
}

function toDbRisk(value: "bajo" | "medio" | "alto" | null) {
  if (value === "bajo") return "low";
  if (value === "medio") return "medium";
  if (value === "alto") return "high";
  return null;
}

export async function POST(req: Request) {
  const supabase = await createSupabaseRouteClient();
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

  const admin = createSupabaseAdminClient();
  const communityId = parsed.data.community_id;

  const { data: community } = await admin
    .from("communities")
    .select("id,status")
    .eq("id", communityId)
    .maybeSingle();

  const status = (community as unknown as { status?: string | null } | null)?.status ?? "approved";
  if (status !== "approved") {
    return Response.json({ message: "Esta comunidad todavía no está aprobada." }, { status: 403 });
  }

  const { data: membership } = await admin
    .from("community_memberships")
    .select("community_id")
    .eq("community_id", communityId)
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (!membership) {
    return Response.json({ message: "Tenés que unirte a la comunidad para publicar." }, { status: 403 });
  }

  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await supabase
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("author_id", session.user.id)
    .gte("created_at", cutoff);

  if (countError) {
    return Response.json(
      { message: "No pudimos validar el rate limit." },
      { status: 500 },
    );
  }

  if ((count ?? 0) >= 5) {
    return Response.json(
      { message: "Límite alcanzado: máximo 5 posts por hora." },
      { status: 429 },
    );
  }

  let anchoredCoinId: string | null = null;
  let priceAtPost: number | null = null;

  if (parsed.data.mode === "advanced") {
    anchoredCoinId = parsed.data.anchored_coin_id ?? null;
  }

  if (anchoredCoinId) {
    try {
      const price = (await coingeckoFetch(
        `/simple/price?ids=${encodeURIComponent(
          anchoredCoinId,
        )}&vs_currencies=usd&include_24hr_change=true`,
      )) as CoinPriceResponse;
      const usd = price[anchoredCoinId]?.usd;
      priceAtPost = typeof usd === "number" ? usd : null;
    } catch {
      priceAtPost = null;
    }
  }

  const payload =
    parsed.data.mode === "advanced"
      ? {
          author_id: session.user.id,
          community_id: parsed.data.community_id,
          title: parsed.data.title,
          content: parsed.data.content ?? null,
          type: toDbPostType(parsed.data.type ?? "texto"),
          tag: parsed.data.tag ?? null,
          url: parsed.data.url ?? null,
          anchored_coin_id: anchoredCoinId,
          price_at_post: priceAtPost,
          risk_indicator: toDbRisk(parsed.data.risk_indicator ?? null),
          bullish_votes: 0,
          bearish_votes: 0,
          scam_reports: 0,
          comment_count: 0,
          is_flagged: false,
          is_removed: false,
        }
      : {
          author_id: session.user.id,
          community_id: parsed.data.community_id,
          title: parsed.data.title,
          content: null,
          type: "question",
          tag: null,
          url: null,
          what_happened: parsed.data.what_happened,
          why_it_matters: parsed.data.why_it_matters,
          who_is_affected: parsed.data.who_is_affected ?? null,
          anchored_coin_id: null,
          price_at_post: null,
          risk_indicator: toDbRisk(parsed.data.risk_indicator),
          bullish_votes: 0,
          bearish_votes: 0,
          scam_reports: 0,
          comment_count: 0,
          is_flagged: false,
          is_removed: false,
        };

  const { data: inserted, error } = await supabase
    .from("posts")
    .insert(payload)
    .select("id")
    .single();

  if (error || !inserted?.id) {
    const details =
      typeof (error as unknown as { message?: unknown })?.message === "string"
        ? (error as unknown as { message: string }).message
        : null;
    return Response.json(
      { message: `No pudimos crear el post. ${details ?? "Intentá de nuevo."}`.trim() },
      { status: 500 },
    );
  }

  return Response.json({ id: inserted.id }, { status: 200 });
}
