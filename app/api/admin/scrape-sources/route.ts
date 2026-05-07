import { z } from "zod";

import { createSupabaseAdminClient, createSupabaseRouteClient } from "@/lib/supabase/server";

const SUPER_ADMIN_EMAIL = "s.godoy.rubio@gmail.com";

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  url: z.string().trim().url(),
  default_community_id: z.string().trim().min(1).nullable().optional(),
  list_container_selector: z.string().trim().min(1).max(200),
  link_selector: z.string().trim().min(1).max(200),
  content_selector: z.string().trim().min(1).max(200),
  ignore_selector: z.string().trim().max(200).nullable().optional(),
  is_active: z.boolean().optional().default(true),
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

export async function GET() {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.res;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("scrape_sources")
    .select(
      "id,name,url,default_community_id,list_container_selector,link_selector,content_selector,ignore_selector,is_active,created_at",
    )
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(5000);

  if (error) return Response.json({ message: "No pudimos cargar fuentes." }, { status: 500 });
  return Response.json({ sources: data ?? [] }, { status: 200 });
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

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ message: parsed.error.issues[0]?.message ?? "Parámetros inválidos" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("scrape_sources").insert({
    name: parsed.data.name,
    url: parsed.data.url,
    default_community_id: parsed.data.default_community_id ?? null,
    list_container_selector: parsed.data.list_container_selector,
    link_selector: parsed.data.link_selector,
    content_selector: parsed.data.content_selector,
    ignore_selector: parsed.data.ignore_selector ?? null,
    is_active: parsed.data.is_active ?? true,
  } as never);

  if (error) return Response.json({ message: "No pudimos guardar la fuente." }, { status: 500 });
  return Response.json({ ok: true }, { status: 200 });
}
