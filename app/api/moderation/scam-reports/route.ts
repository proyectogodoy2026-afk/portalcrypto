import { createSupabaseRouteClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const supabase = createSupabaseRouteClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return Response.json({ message: "No autenticado" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_moderator")
    .eq("id", session.user.id)
    .maybeSingle();

  const isModerator = (profile as unknown as { is_moderator?: boolean | null } | null)?.is_moderator ?? false;
  if (!isModerator) {
    return Response.json({ message: "No autorizado" }, { status: 403 });
  }

  const url = new URL(req.url);
  const status = (url.searchParams.get("status") ?? "pending").trim();
  const reason = (url.searchParams.get("reason") ?? "").trim();

  let query = supabase
    .from("scam_reports")
    .select(
      "id,reporter_id,target_type,target_id,project_name,reason,description,evidence_url,status,reviewed_by,reviewed_at,created_at",
    )
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(200);

  if (status) {
    query = query.eq("status", status);
  }
  if (reason) {
    query = query.eq("reason", reason);
  }

  const { data, error } = await query;
  if (error) {
    return Response.json({ message: "No pudimos cargar la cola." }, { status: 500 });
  }

  return Response.json({ reports: data ?? [] }, { status: 200 });
}

