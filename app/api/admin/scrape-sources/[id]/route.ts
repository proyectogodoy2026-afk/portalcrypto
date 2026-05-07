import { z } from "zod";

import { createSupabaseAdminClient, createSupabaseRouteClient } from "@/lib/supabase/server";

const SUPER_ADMIN_EMAIL = "s.godoy.rubio@gmail.com";

const patchSchema = z.object({
  list_container_selector: z.string().trim().min(1).max(200).optional(),
  link_selector: z.string().trim().min(1).max(200).optional(),
  content_selector: z.string().trim().min(1).max(200).optional(),
  ignore_selector: z.string().trim().max(200).nullable().optional(),
  is_active: z.boolean().optional(),
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

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.res;

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ message: "Body inválido" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ message: parsed.error.issues[0]?.message ?? "Parámetros inválidos" }, { status: 400 });
  }

  const updatePayload = parsed.data as Record<string, unknown>;
  if (Object.keys(updatePayload).length === 0) {
    return Response.json({ message: "Nada para actualizar" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("scrape_sources").update(updatePayload as never).eq("id", id);
  if (error) return Response.json({ message: "No pudimos actualizar la fuente." }, { status: 500 });
  return Response.json({ ok: true }, { status: 200 });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.res;

  const { id } = await ctx.params;
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("scrape_sources").delete().eq("id", id);
  if (error) return Response.json({ message: "No pudimos eliminar la fuente." }, { status: 500 });
  return Response.json({ ok: true }, { status: 200 });
}

