import { z } from "zod";

import { createSupabaseAdminClient, createSupabaseRouteClient } from "@/lib/supabase/server";

const SUPER_ADMIN_EMAIL = "s.godoy.rubio@gmail.com";

const schema = z.object({
  id: z.string().min(1),
  action: z.enum(["approve", "reject"]),
  communityId: z.string().min(1).optional(),
});

async function assertAdmin() {
  const supabase = await createSupabaseRouteClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return { ok: false as const, res: Response.json({ message: "No autenticado" }, { status: 401 }) };

  const email = (session.user.email ?? "").toLowerCase();
  if (email === SUPER_ADMIN_EMAIL) return { ok: true as const, session };

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", session.user.id)
    .maybeSingle();

  const isAdmin = (profile as unknown as { is_admin?: boolean | null } | null)?.is_admin ?? false;
  if (!isAdmin) return { ok: false as const, res: Response.json({ message: "No autorizado" }, { status: 403 }) };

  return { ok: true as const, session };
}

export async function POST(req: Request) {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.res;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ message: "Body inválido" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ message: "Parámetros inválidos" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data: row } = await admin
    .from("scraped_posts")
    .select("id,source_id,url,title,content_text,status")
    .eq("id", parsed.data.id)
    .maybeSingle();

  const item = row as unknown as {
    id: string;
    source_id: string;
    url: string;
    title: string | null;
    content_text: string | null;
    status: string | null;
  } | null;

  if (!item) return Response.json({ message: "Item no encontrado." }, { status: 404 });
  if ((item.status ?? "pending") !== "pending") {
    return Response.json({ message: "Este item ya fue revisado." }, { status: 400 });
  }

  if (parsed.data.action === "reject") {
    const { error } = await admin
      .from("scraped_posts")
      .update({
        status: "rejected",
        reviewed_by: auth.session.user.id,
        reviewed_at: new Date().toISOString(),
      } as never)
      .eq("id", item.id);
    if (error) return Response.json({ message: "No pudimos rechazar." }, { status: 500 });
    return Response.json({ ok: true }, { status: 200 });
  }

  const { data: source } = await admin
    .from("scrape_sources")
    .select("default_community_id")
    .eq("id", item.source_id)
    .maybeSingle();

  const defaultCommunityId =
    (source as unknown as { default_community_id?: string | null } | null)?.default_community_id ?? null;
  const communityId = parsed.data.communityId ?? defaultCommunityId;

  if (!communityId) {
    return Response.json({ message: "Seleccioná una comunidad para publicar." }, { status: 400 });
  }

  const { data: community } = await admin
    .from("communities")
    .select("id,status")
    .eq("id", communityId)
    .maybeSingle();

  const status = (community as unknown as { status?: string | null } | null)?.status ?? "approved";
  if (status !== "approved") {
    return Response.json({ message: "La comunidad no está aprobada." }, { status: 400 });
  }

  const title = (item.title ?? "").trim() || "Noticia";
  const content = (item.content_text ?? "").trim() || null;

  const { data: inserted, error: insertError } = await admin
    .from("posts")
    .insert({
      author_id: auth.session.user.id,
      community_id: communityId,
      title,
      content,
      type: "news",
      tag: "news",
      url: item.url,
      anchored_coin_id: null,
      price_at_post: null,
      risk_indicator: null,
      bullish_votes: 0,
      bearish_votes: 0,
      scam_reports: 0,
      comment_count: 0,
      is_flagged: false,
      is_removed: false,
    } as never)
    .select("id")
    .single();

  if (insertError || !inserted?.id) {
    return Response.json({ message: "No pudimos publicar el post." }, { status: 500 });
  }

  const { error: updateError } = await admin
    .from("scraped_posts")
    .update({
      status: "approved",
      reviewed_by: auth.session.user.id,
      reviewed_at: new Date().toISOString(),
    } as never)
    .eq("id", item.id);

  if (updateError) {
    return Response.json({ message: "Publicamos, pero no pudimos marcar como aprobado." }, { status: 500 });
  }

  return Response.json({ ok: true, postId: inserted.id }, { status: 200 });
}

