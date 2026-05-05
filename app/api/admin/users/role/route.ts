import { z } from "zod";

import { createSupabaseAdminClient, createSupabaseRouteClient } from "@/lib/supabase/server";

const SUPER_ADMIN_EMAIL = "s.godoy.rubio@gmail.com";

const schema = z.object({
  userId: z.string().min(1),
  is_admin: z.boolean(),
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
  const { data: authUserData } = await admin.auth.admin.getUserById(parsed.data.userId);
  const targetEmail = (authUserData.user?.email ?? "").toLowerCase();

  const value = targetEmail === SUPER_ADMIN_EMAIL ? true : parsed.data.is_admin;

  const { error } = await admin
    .from("profiles")
    .upsert({ id: parsed.data.userId, is_admin: value } as never, { onConflict: "id" });

  if (error) {
    return Response.json({ message: "No pudimos actualizar el rol." }, { status: 500 });
  }

  return Response.json({ ok: true }, { status: 200 });
}
