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
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) {
    return Response.json({ message: "No pudimos listar usuarios." }, { status: 500 });
  }

  const baseUsers =
    (data.users ?? []).map((u) => ({
      id: u.id,
      email: u.email ?? null,
      created_at: (u.created_at as unknown as string | null) ?? null,
    })) ?? [];

  const ids = baseUsers.map((u) => u.id).filter(Boolean);
  const { data: profiles } =
    ids.length > 0
      ? await admin
          .from("profiles")
          .select("id,username,is_admin,is_moderator")
          .in("id", ids)
          .limit(5000)
      : { data: [] as unknown[] };

  const profileMap = new Map<
    string,
    { username: string | null; is_admin: boolean | null; is_moderator: boolean | null }
  >();
  for (const p of (profiles ?? []) as Array<{
    id: string;
    username: string | null;
    is_admin?: boolean | null;
    is_moderator?: boolean | null;
  }>) {
    profileMap.set(p.id, {
      username: p.username ?? null,
      is_admin: p.is_admin ?? null,
      is_moderator: p.is_moderator ?? null,
    });
  }

  const users = baseUsers
    .map((u) => {
      const profile = profileMap.get(u.id) ?? null;
      return {
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        username: profile?.username ?? null,
        is_admin: profile?.is_admin ?? false,
        is_moderator: profile?.is_moderator ?? false,
      };
    })
    .sort((a, b) => {
      const aT = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bT = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bT - aT;
    });

  return Response.json({ users }, { status: 200 });
}
