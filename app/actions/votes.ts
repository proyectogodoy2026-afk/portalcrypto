"use server";

import { z } from "zod";

import { createNotification } from "@/app/actions/notifications";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const targetTypeSchema = z.enum(["post", "comment"]);
const voteTypeSchema = z.enum(["bullish", "bearish"]);

export type CastVoteResult =
  | {
      ok: true;
      currentVote: z.infer<typeof voteTypeSchema> | null;
      counts: { bullish: number; bearish: number };
    }
  | { ok: false; message: string };

export async function castVote(
  targetType: z.infer<typeof targetTypeSchema>,
  targetId: string,
  voteType: z.infer<typeof voteTypeSchema>,
): Promise<CastVoteResult> {
  const parsedTarget = targetTypeSchema.safeParse(targetType);
  const parsedVote = voteTypeSchema.safeParse(voteType);
  const parsedTargetId = z.string().min(1).safeParse(targetId);

  if (!parsedTarget.success || !parsedVote.success || !parsedTargetId.success) {
    return { ok: false, message: "Parámetros inválidos." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Necesitás iniciar sesión para votar." };
  }

  let postAuthorId: string | null = null;
  if (parsedTarget.data === "post") {
    const { data: post } = await supabase
      .from("posts")
      .select("author_id,is_flagged")
      .eq("id", parsedTargetId.data)
      .maybeSingle();

    const typedPost = post as unknown as { author_id: string; is_flagged: boolean | null } | null;

    if (!typedPost) {
      return { ok: false, message: "Post no encontrado." };
    }

    if (typedPost.author_id === user.id) {
      return { ok: false, message: "No podés votar tu propio post." };
    }
    postAuthorId = typedPost.author_id ?? null;
  } else {
    const { data: comment } = await supabase
      .from("comments")
      .select("author_id")
      .eq("id", parsedTargetId.data)
      .maybeSingle();

    const typedComment = comment as unknown as { author_id: string } | null;
    if (!typedComment) {
      return { ok: false, message: "Comentario no encontrado." };
    }

    if (typedComment.author_id === user.id) {
      return { ok: false, message: "No podés votar tu propio comentario." };
    }
  }

  const { data: existingVote } = await supabase
    .from("votes")
    .select("id,vote_type")
    .eq("user_id", user.id)
    .eq("target_type", parsedTarget.data)
    .eq("target_id", parsedTargetId.data)
    .maybeSingle();

  const typedExisting = existingVote as unknown as { id: string; vote_type: string } | null;

  let nextVote: z.infer<typeof voteTypeSchema> | null = parsedVote.data;

  if (typedExisting?.id) {
    if (typedExisting.vote_type === parsedVote.data) {
      const { error } = await supabase.from("votes").delete().eq("id", typedExisting.id);
      if (error) return { ok: false, message: "No pudimos actualizar tu voto." };
      nextVote = null;
    } else {
      const { error } = await supabase
        .from("votes")
        .update({ vote_type: parsedVote.data })
        .eq("id", typedExisting.id);
      if (error) return { ok: false, message: "No pudimos actualizar tu voto." };
      nextVote = parsedVote.data;
    }
  } else {
    const { error } = await supabase.from("votes").insert({
      user_id: user.id,
      target_type: parsedTarget.data,
      target_id: parsedTargetId.data,
      vote_type: parsedVote.data,
    });
    if (error) {
      const msg = (error.message ?? "").toLowerCase();
      if (msg.includes("row-level security") || msg.includes("permission denied")) {
        return { ok: false, message: "No pudimos guardar tu voto por permisos (RLS) en la tabla votes." };
      }
      if (msg.includes("violates foreign key") || msg.includes("foreign key")) {
        return { ok: false, message: "No pudimos guardar tu voto: falta tu perfil en la tabla profiles." };
      }
      if (msg.includes("violates check constraint") || msg.includes("check constraint")) {
        return { ok: false, message: `No pudimos guardar tu voto: ${error.message}` };
      }
      return { ok: false, message: `No pudimos guardar tu voto: ${error.message}` };
    }
    nextVote = parsedVote.data;
  }

  const countFor = async (value: z.infer<typeof voteTypeSchema>) => {
    const { count, error } = await supabase
      .from("votes")
      .select("id", { count: "exact", head: true })
      .eq("target_type", parsedTarget.data)
      .eq("target_id", parsedTargetId.data)
      .eq("vote_type", value);
    if (error) throw error;
    return count ?? 0;
  };

  let bullish = 0;
  let bearish = 0;
  try {
    [bullish, bearish] = await Promise.all([
      countFor("bullish"),
      countFor("bearish"),
    ]);
  } catch {
    return { ok: false, message: "No pudimos calcular los votos." };
  }

  const counts = {
    bullish,
    bearish,
  };

  if (parsedTarget.data === "post") {
    const totalVotes = counts.bullish + counts.bearish;
    if (totalVotes === 10 && postAuthorId) {
      await createNotification({
        userId: postAuthorId,
        type: "vote_milestone",
        title: "Tu post llegó a 10 votos",
        body: "La comunidad está interactuando fuerte con tu publicación.",
        link: `/post/${parsedTargetId.data}`,
      });
    }
  }

  return { ok: true, currentVote: nextVote, counts };
}
