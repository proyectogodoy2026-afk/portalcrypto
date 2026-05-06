import { z } from "zod";

import { createSupabaseAdminClient, createSupabaseRouteClient } from "@/lib/supabase/server";

const schema = z.object({
  postId: z.string().min(1),
  content: z.string().trim().min(1).max(2000),
});

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

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ message: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: post } = await admin
    .from("posts")
    .select("id,community_id,is_removed")
    .eq("id", parsed.data.postId)
    .maybeSingle();

  const typedPost = post as unknown as { id: string; community_id: string; is_removed?: boolean | null } | null;
  if (!typedPost || typedPost.is_removed) {
    return Response.json({ message: "Post no disponible." }, { status: 404 });
  }

  const { data: community } = await admin
    .from("communities")
    .select("id,status")
    .eq("id", typedPost.community_id)
    .maybeSingle();

  const status = (community as unknown as { status?: string | null } | null)?.status ?? "approved";
  if (status !== "approved") {
    return Response.json({ message: "Esta comunidad todavía no está aprobada." }, { status: 403 });
  }

  const { data: membership } = await admin
    .from("community_memberships")
    .select("community_id")
    .eq("community_id", typedPost.community_id)
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (!membership) {
    return Response.json({ message: "Tenés que unirte a la comunidad para comentar." }, { status: 403 });
  }

  const { error } = await admin.from("comments").insert({
    post_id: typedPost.id,
    author_id: session.user.id,
    content: parsed.data.content,
    is_removed: false,
    is_flagged: false,
  } as never);

  if (error) {
    return Response.json({ message: "No pudimos guardar tu comentario." }, { status: 500 });
  }

  return Response.json({ ok: true }, { status: 200 });
}

