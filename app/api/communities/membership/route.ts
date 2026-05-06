import { z } from "zod";

import { createSupabaseAdminClient, createSupabaseRouteClient } from "@/lib/supabase/server";

const postSchema = z.object({
  communityId: z.string().min(1),
  action: z.enum(["join", "leave"]),
});

export async function GET(req: Request) {
  const supabase = await createSupabaseRouteClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return Response.json({ message: "No autenticado" }, { status: 401 });

  const url = new URL(req.url);
  const communityId = (url.searchParams.get("communityId") ?? "").trim();
  if (!communityId) return Response.json({ message: "communityId requerido" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data: membership } = await admin
    .from("community_memberships")
    .select("community_id")
    .eq("community_id", communityId)
    .eq("user_id", session.user.id)
    .maybeSingle();

  const { data: community } = await admin
    .from("communities")
    .select("member_count")
    .eq("id", communityId)
    .maybeSingle();

  return Response.json(
    {
      joined: Boolean(membership),
      memberCount: (community as unknown as { member_count?: number | null } | null)?.member_count ?? 0,
    },
    { status: 200 },
  );
}

export async function POST(req: Request) {
  const supabase = await createSupabaseRouteClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return Response.json({ message: "No autenticado" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ message: "Body inválido" }, { status: 400 });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ message: "Parámetros inválidos" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const communityId = parsed.data.communityId;

  const { data: community } = await admin
    .from("communities")
    .select("status")
    .eq("id", communityId)
    .maybeSingle();
  const status = (community as unknown as { status?: string | null } | null)?.status ?? "approved";
  if (status !== "approved") {
    return Response.json({ message: "Esta comunidad no está disponible." }, { status: 403 });
  }

  if (parsed.data.action === "join") {
    const { error } = await admin.from("community_memberships").insert({
      user_id: session.user.id,
      community_id: communityId,
    } as never);
    if (error) {
      const msg = (error.message ?? "").toLowerCase();
      const isDup = msg.includes("duplicate") || msg.includes("unique");
      if (!isDup) {
        return Response.json({ message: "No pudimos unir al usuario." }, { status: 500 });
      }
    }
  } else {
    const { error } = await admin
      .from("community_memberships")
      .delete()
      .eq("user_id", session.user.id)
      .eq("community_id", communityId);
    if (error) {
      return Response.json({ message: "No pudimos salir de la comunidad." }, { status: 500 });
    }
  }

  const { count, error: countError } = await admin
    .from("community_memberships")
    .select("community_id", { count: "exact", head: true })
    .eq("community_id", communityId);

  if (countError) {
    return Response.json({ message: "No pudimos recalcular miembros." }, { status: 500 });
  }

  await admin.from("communities").update({ member_count: count ?? 0 } as never).eq("id", communityId);

  return Response.json(
    { ok: true, joined: parsed.data.action === "join", memberCount: count ?? 0 },
    { status: 200 },
  );
}
