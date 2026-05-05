import { z } from "zod";

import { createSupabaseAdminClient, createSupabaseRouteClient } from "@/lib/supabase/server";

const SUPER_ADMIN_EMAIL = "s.godoy.rubio@gmail.com";

const schema = z.object({
  communityId: z.string().min(1),
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
  const communityId = parsed.data.communityId;

  for (let i = 0; i < 30; i += 1) {
    const { data: posts, error: postsError } = await admin
      .from("posts")
      .select("id")
      .eq("community_id", communityId)
      .limit(500);

    if (postsError) {
      return Response.json({ message: "No pudimos cargar posts de la comunidad." }, { status: 500 });
    }

    const postIds = (posts ?? []).map((p) => (p as unknown as { id: string }).id).filter(Boolean);
    if (postIds.length === 0) break;

    const { data: comments, error: commentsError } = await admin
      .from("comments")
      .select("id")
      .in("post_id", postIds)
      .limit(5000);

    if (commentsError) {
      return Response.json({ message: "No pudimos cargar comentarios." }, { status: 500 });
    }

    const commentIds = (comments ?? [])
      .map((c) => (c as unknown as { id: string }).id)
      .filter(Boolean);

    if (commentIds.length > 0) {
      const { error: voteCommentsError } = await admin
        .from("votes")
        .delete()
        .eq("target_type", "comment")
        .in("target_id", commentIds);
      if (voteCommentsError) {
        return Response.json(
          { message: "No pudimos eliminar votos de comentarios." },
          { status: 500 },
        );
      }

      await admin
        .from("scam_reports")
        .delete()
        .eq("target_type", "comment")
        .in("target_id", commentIds);
    }

    const { error: deleteCommentsError } = await admin
      .from("comments")
      .delete()
      .in("post_id", postIds);
    if (deleteCommentsError) {
      return Response.json({ message: "No pudimos eliminar comentarios." }, { status: 500 });
    }

    const { error: votePostsError } = await admin
      .from("votes")
      .delete()
      .eq("target_type", "post")
      .in("target_id", postIds);
    if (votePostsError) {
      return Response.json({ message: "No pudimos eliminar votos de posts." }, { status: 500 });
    }

    await admin
      .from("scam_reports")
      .delete()
      .eq("target_type", "post")
      .in("target_id", postIds);

    const { error: deletePostsError } = await admin.from("posts").delete().in("id", postIds);
    if (deletePostsError) {
      return Response.json({ message: "No pudimos eliminar posts." }, { status: 500 });
    }
  }

  const { error: deleteCommunityError } = await admin.from("communities").delete().eq("id", communityId);
  if (deleteCommunityError) {
    return Response.json({ message: "No pudimos eliminar la comunidad." }, { status: 500 });
  }

  return Response.json({ ok: true }, { status: 200 });
}
