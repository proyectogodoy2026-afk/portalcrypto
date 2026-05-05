import { z } from "zod";

import { createSupabaseAdminClient, createSupabaseRouteClient } from "@/lib/supabase/server";

const schema = z.object({
  name: z.string().trim().min(2).max(60),
  type: z.enum(["asset", "topic", "region", "level", "other"]),
  reason: z.string().trim().min(10).max(500),
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

export async function POST(req: Request) {
  const supabase = await createSupabaseRouteClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return Response.json({ message: "No autenticado" }, { status: 401 });
  }

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", session.user.id)
    .maybeSingle();

  const onboardingCompleted =
    (profile as unknown as { onboarding_completed?: boolean | null } | null)?.onboarding_completed ?? false;
  if (!onboardingCompleted) {
    return Response.json({ message: "Completá el onboarding antes de crear una comunidad." }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  const baseSlug = slugify(parsed.data.name);
  if (!baseSlug) {
    return Response.json({ message: "Nombre inválido para crear slug." }, { status: 400 });
  }

  let slug = baseSlug;
  for (let i = 0; i < 12; i += 1) {
    const { count, error: countError } = await admin
      .from("communities")
      .select("id", { count: "exact", head: true })
      .eq("slug", slug);

    if (countError) {
      return Response.json({ message: "No pudimos validar el slug." }, { status: 500 });
    }
    if ((count ?? 0) === 0) break;
    slug = `${baseSlug}-${i + 2}`;
  }

  const { data: inserted, error } = await admin
    .from("communities")
    .insert({
      name: parsed.data.name,
      slug,
      type: parsed.data.type === "other" ? null : parsed.data.type,
      member_count: 0,
      icon_url: null,
      risk_level: null,
      status: "pending",
      requested_reason: parsed.data.reason,
      requested_by: session.user.id,
      reviewed_by: null,
      reviewed_at: null,
      reviewed_note: null,
    } as never)
    .select("id,slug")
    .single();

  if (error || !inserted?.id) {
    return Response.json({ message: "No pudimos crear la solicitud." }, { status: 500 });
  }

  return Response.json({ ok: true, id: inserted.id, slug: inserted.slug }, { status: 200 });
}

