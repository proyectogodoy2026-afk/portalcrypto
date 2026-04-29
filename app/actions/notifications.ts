"use server";

import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const notificationTypeSchema = z.enum([
  "comment_reply",
  "prediction_resolved",
  "vote_milestone",
  "scam_alert",
]);

export type NotificationType = z.infer<typeof notificationTypeSchema>;

export async function createNotification(input: {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = z
    .object({
      userId: z.string().min(1),
      type: notificationTypeSchema,
      title: z.string().min(1).max(200),
      body: z.string().max(500).optional().nullable(),
      link: z.string().max(300).optional().nullable(),
    })
    .safeParse(input);

  if (!parsed.success) return { ok: false, message: "Parámetros inválidos." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("notifications").insert({
    user_id: parsed.data.userId,
    type: parsed.data.type,
    title: parsed.data.title,
    body: parsed.data.body ?? null,
    link: parsed.data.link ?? null,
    is_read: false,
  });

  if (error) return { ok: false, message: "No pudimos crear la notificación." };
  return { ok: true };
}
