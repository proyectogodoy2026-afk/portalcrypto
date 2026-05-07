import { createSupabaseAdminClient, createSupabaseRouteClient } from "@/lib/supabase/server";

const SUPER_ADMIN_EMAIL = "s.godoy.rubio@gmail.com";

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

export async function GET(req: Request) {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const status = (url.searchParams.get("status") ?? "pending").trim() || "pending";

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("scraped_posts")
    .select(
      "id,source_id,url,title,content_text,status,fetched_at,reviewed_by,reviewed_at,reviewed_note,created_at",
    )
    .eq("status", status)
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(200);

  if (error) return Response.json({ message: "No pudimos cargar la cola." }, { status: 500 });

  const sourceIds = Array.from(new Set((data ?? []).map((r) => (r as any).source_id).filter(Boolean))) as string[];
  const { data: sources } =
    sourceIds.length > 0
      ? await admin.from("scrape_sources").select("id,name,default_community_id").in("id", sourceIds).limit(5000)
      : { data: [] as unknown[] };

  const map = new Map<string, { name: string; default_community_id: string | null }>();
  for (const s of (sources ?? []) as Array<{ id: string; name: string; default_community_id?: string | null }>) {
    map.set(s.id, { name: s.name, default_community_id: s.default_community_id ?? null });
  }

  const items = (data ?? []).map((r) => {
    const row = r as unknown as { source_id: string };
    const src = map.get(row.source_id) ?? null;
    return { ...(r as Record<string, unknown>), source_name: src?.name ?? "Fuente", default_community_id: src?.default_community_id ?? null };
  });

  return Response.json({ items }, { status: 200 });
}

