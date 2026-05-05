import { z } from "zod";

import { createSupabaseAdminClient, createSupabaseRouteClient } from "@/lib/supabase/server";

const SUPER_ADMIN_EMAIL = "s.godoy.rubio@gmail.com";

const schema = z.object({
  communityId: z.string().min(1),
  status: z.enum(["approved", "rejected"]),
  note: z.string().max(500).optional().nullable(),
});

export async function POST(req: Request) {
  const supabase = await createSupabaseRouteClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return Response.json({ message: "No autenticado" }, { status: 401 });
  }

  const email = (session.user.email ?? "").toLowerCase();
  const isSuper = email === SUPER_ADMIN_EMAIL;

  if (!isSuper) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", session.user.id)
      .maybeSingle();

    const isAdmin =
      (profile as unknown as { is_admin?: boolean | null } | null)?.is_admin ?? false;
    if (!isAdmin) {
      return Response.json({ message: "No autorizado" }, { status: 403 });
    }
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ message: "Body inválido" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ message: "Parámetros inválidos" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const payload: Record<string, unknown> = {
    status: parsed.data.status,
    reviewed_by: session.user.id,
    reviewed_at: new Date().toISOString(),
    reviewed_note: parsed.data.note?.trim() ? parsed.data.note.trim() : null,
  };

  const { error } = await admin.from("communities").update(payload as never).eq("id", parsed.data.communityId);
  if (error) {
    return Response.json({ message: "No pudimos actualizar la comunidad." }, { status: 500 });
  }

  return Response.json({ ok: true }, { status: 200 });
}
