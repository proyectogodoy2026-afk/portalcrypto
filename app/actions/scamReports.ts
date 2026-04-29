"use server";

import { z } from "zod";

import { createNotification } from "@/app/actions/notifications";
import { coingeckoFetch } from "@/lib/api/coingecko";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const targetTypeSchema = z.enum(["post", "comment", "project"]);
const reasonSchema = z.enum([
  "fake-project",
  "rug-pull",
  "phishing",
  "fake-giveaway",
  "pump-dump",
  "other",
]);
const statusSchema = z.enum(["pending", "confirmed", "dismissed"]);

type ReportScamResult =
  | { ok: true; reportCount: number; isFlagged: boolean }
  | { ok: false; message: string };

export async function reportScam(input: {
  targetType: z.infer<typeof targetTypeSchema>;
  targetId?: string | null;
  projectName?: string | null;
  reason: z.infer<typeof reasonSchema>;
  description?: string | null;
  evidenceUrl?: string | null;
}): Promise<ReportScamResult> {
  const parsed = z
    .object({
      targetType: targetTypeSchema,
      targetId: z.string().min(1).optional().nullable(),
      projectName: z.string().max(120).optional().nullable(),
      reason: reasonSchema,
      description: z.string().max(500).optional().nullable(),
      evidenceUrl: z
        .string()
        .url("Ingresá una URL válida")
        .optional()
        .nullable()
        .or(z.literal("").transform(() => null)),
    })
    .safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Necesitás iniciar sesión para reportar." };
  }

  let postCoinId: string | null = null;

  if (parsed.data.targetType === "post") {
    const { data: post } = await supabase
      .from("posts")
      .select("author_id,anchored_coin_id")
      .eq("id", parsed.data.targetId ?? "")
      .maybeSingle();

    const typedPost = post as unknown as { author_id: string; anchored_coin_id: string | null } | null;
    if (!typedPost) return { ok: false, message: "Post no encontrado." };
    if (typedPost.author_id === user.id) {
      return { ok: false, message: "No podés reportar tu propio post." };
    }
    postCoinId = typedPost.anchored_coin_id ?? null;
  }

  if (parsed.data.targetType === "comment") {
    const { data: comment } = await supabase
      .from("comments")
      .select("author_id")
      .eq("id", parsed.data.targetId ?? "")
      .maybeSingle();

    const typedComment = comment as unknown as { author_id: string } | null;
    if (!typedComment) return { ok: false, message: "Comentario no encontrado." };
    if (typedComment.author_id === user.id) {
      return { ok: false, message: "No podés reportar tu propio comentario." };
    }
  }

  const targetId = parsed.data.targetId ?? null;
  const projectNameRaw = (parsed.data.projectName ?? "").trim();
  const projectName = parsed.data.targetType === "project" ? projectNameRaw : null;

  if (parsed.data.targetType === "project" && !projectNameRaw) {
    return { ok: false, message: "Indicá el nombre del proyecto." };
  }
  if (parsed.data.targetType !== "project" && !targetId) {
    return { ok: false, message: "Objetivo inválido." };
  }

  const { error: insertErr } = await supabase.from("scam_reports").insert({
    reporter_id: user.id,
    target_type: parsed.data.targetType,
    target_id: targetId,
    project_name: projectName,
    reason: parsed.data.reason,
    description: parsed.data.description?.trim() ? parsed.data.description.trim() : null,
    evidence_url: parsed.data.evidenceUrl?.trim() ? parsed.data.evidenceUrl.trim() : null,
    status: "pending",
  });

  if (insertErr) {
    return { ok: false, message: "No pudimos enviar tu reporte." };
  }

  let countQuery = supabase
    .from("scam_reports")
    .select("id", { count: "exact", head: true })
    .eq("target_type", parsed.data.targetType);

  if (parsed.data.targetType === "project") {
    countQuery = countQuery.eq("project_name", projectNameRaw);
  } else {
    countQuery = countQuery.eq("target_id", targetId!);
  }

  const { count } = await countQuery;

  const reportCount = count ?? 0;

  let isFlagged = false;

  if (parsed.data.targetType === "post" && targetId) {
    const updatePayload: Record<string, unknown> = {
      scam_reports: reportCount,
    };
    if (reportCount >= 3) {
      updatePayload.is_flagged = true;
      isFlagged = true;
    }

    await supabase.from("posts").update(updatePayload as never).eq("id", targetId);
  }

  if (parsed.data.targetType === "comment" && targetId) {
    if (reportCount >= 3) {
      isFlagged = true;
      await supabase.from("comments").update({ is_flagged: true }).eq("id", targetId);
    }
  }

  if (reportCount >= 5 && postCoinId) {
    const identity = await getCoinIdentitySafe(postCoinId);
    await supabase
      .from("token_profiles")
      .upsert(
        {
          coin_id: postCoinId,
          symbol: identity?.symbol ?? postCoinId,
          name: identity?.name ?? postCoinId,
          is_reported: true,
          report_count: reportCount,
        },
        { onConflict: "coin_id" },
      );
  }

  await notifyModerators({
    supabase,
    reporterId: user.id,
    reason: parsed.data.reason,
    targetType: parsed.data.targetType,
    targetId: targetId,
    projectName,
    reportCount,
  });

  return { ok: true, reportCount, isFlagged };
}

export async function reviewScamReport(input: {
  reportId: string;
  status: z.infer<typeof statusSchema>;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = z
    .object({
      reportId: z.string().min(1),
      status: statusSchema,
    })
    .safeParse(input);

  if (!parsed.success) return { ok: false, message: "Parámetros inválidos." };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, message: "No autenticado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_moderator")
    .eq("id", user.id)
    .maybeSingle();

  const isModerator = (profile as unknown as { is_moderator?: boolean | null } | null)?.is_moderator ?? false;
  if (!isModerator) return { ok: false, message: "No autorizado." };

  const { error } = await supabase
    .from("scam_reports")
    .update({
      status: parsed.data.status,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.reportId);

  if (error) return { ok: false, message: "No pudimos actualizar el reporte." };
  if (parsed.data.status === "confirmed") {
    await notifyFollowersAboutConfirmedScam({ supabase, reportId: parsed.data.reportId });
  }
  return { ok: true };
}

async function getCoinIdentitySafe(coinId: string): Promise<{ name: string; symbol: string } | null> {
  try {
    const data = (await coingeckoFetch(
      `/coins/${encodeURIComponent(coinId)}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`,
    )) as { name?: string; symbol?: string };
    const name = typeof data?.name === "string" ? data.name : null;
    const symbol = typeof data?.symbol === "string" ? data.symbol : null;
    if (!name || !symbol) return null;
    return { name, symbol };
  } catch {
    return null;
  }
}

async function notifyModerators(args: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  reporterId: string;
  reason: string;
  targetType: string;
  targetId: string | null;
  projectName: string | null;
  reportCount: number;
}) {
  const { data: mods } = await args.supabase
    .from("profiles")
    .select("id,is_moderator")
    .eq("is_moderator", true)
    .limit(100);

  const moderatorIds = (mods ?? [])
    .map((m) => (m as unknown as { id: string }).id)
    .filter(Boolean);

  if (moderatorIds.length === 0) return;

  const targetLabel =
    args.targetType === "project"
      ? args.projectName ?? "Proyecto"
      : args.targetType === "comment"
        ? "Comentario"
        : "Post";

  const title = "Nuevo reporte de posible scam";
  const body = `${targetLabel} · ${args.reason} · ${args.reportCount} reportes`;

  await args.supabase.from("notifications").insert(
    moderatorIds.map((id) => ({
      user_id: id,
      type: "scam_alert",
      title,
      body,
      link: "/moderation",
      is_read: false,
    })),
  );
}

async function notifyFollowersAboutConfirmedScam(args: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  reportId: string;
}) {
  const { data: report } = await args.supabase
    .from("scam_reports")
    .select("target_type,target_id,project_name,reason")
    .eq("id", args.reportId)
    .maybeSingle();

  const typedReport = report as unknown as {
    target_type: string;
    target_id: string | null;
    project_name: string | null;
    reason: string;
  } | null;

  if (!typedReport) return;

  let coinId: string | null = null;
  let label = typedReport.project_name?.trim() || "token";

  if (typedReport.target_type === "post" && typedReport.target_id) {
    const { data: post } = await args.supabase
      .from("posts")
      .select("anchored_coin_id")
      .eq("id", typedReport.target_id)
      .maybeSingle();
    coinId = (post as unknown as { anchored_coin_id?: string | null } | null)?.anchored_coin_id ?? null;
    if (coinId) label = coinId;
  } else if (typedReport.target_type === "project" && typedReport.project_name?.trim()) {
    const projectName = typedReport.project_name.trim();
    const { data: token } = await args.supabase
      .from("token_profiles")
      .select("coin_id,name,symbol")
      .ilike("name", projectName)
      .limit(1)
      .maybeSingle();
    coinId = (token as unknown as { coin_id?: string | null } | null)?.coin_id ?? null;
    const symbol = (token as unknown as { symbol?: string | null } | null)?.symbol ?? null;
    if (symbol?.trim()) label = symbol.trim().toUpperCase();
  }

  if (!coinId) return;

  const { data: profiles } = await args.supabase
    .from("profiles")
    .select("id,followed_tokens,notify_scam_alerts")
    .limit(1000);

  const recipients = ((profiles ?? []) as Array<{
    id: string;
    followed_tokens?: unknown;
    notify_scam_alerts?: boolean | null;
  }>).filter((p) => {
    if (p.notify_scam_alerts === false) return false;
    const tokens = Array.isArray(p.followed_tokens) ? p.followed_tokens : [];
    return tokens.some((t) => typeof t === "string" && t === coinId);
  });

  for (const recipient of recipients) {
    await createNotification({
      userId: recipient.id,
      type: "scam_alert",
      title: `Scam confirmado en ${label}`,
      body: `Motivo: ${typedReport.reason}`,
      link: `/scam-radar?coin=${encodeURIComponent(coinId)}`,
    });
  }
}
