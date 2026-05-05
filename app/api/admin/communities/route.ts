import { createSupabaseAdminClient, createSupabaseRouteClient } from "@/lib/supabase/server";

const SUPER_ADMIN_EMAIL = "s.godoy.rubio@gmail.com";

export async function GET() {
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

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("communities")
    .select(
      "id,name,slug,type,member_count,icon_url,risk_level,status,requested_reason,requested_by,reviewed_by,reviewed_at,reviewed_note,created_at",
    )
    .order("member_count", { ascending: false, nullsFirst: false })
    .limit(5000);

  if (error) {
    return Response.json({ message: "No pudimos cargar comunidades." }, { status: 500 });
  }

  return Response.json({ communities: data ?? [] }, { status: 200 });
}
