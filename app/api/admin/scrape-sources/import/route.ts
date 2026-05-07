import { z } from "zod";
import * as cheerio from "cheerio";

import { createSupabaseAdminClient, createSupabaseRouteClient } from "@/lib/supabase/server";

const SUPER_ADMIN_EMAIL = "s.godoy.rubio@gmail.com";

const schema = z.object({
  sourceId: z.string().min(1),
  limit: z.number().int().min(1).max(50).optional().default(10),
});

async function assertAdmin() {
  const supabase = await createSupabaseRouteClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return { ok: false as const, res: Response.json({ message: "No autenticado" }, { status: 401 }) };

  const email = (session.user.email ?? "").toLowerCase();
  if (email === SUPER_ADMIN_EMAIL) return { ok: true as const, session };

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", session.user.id)
    .maybeSingle();

  const isAdmin = (profile as unknown as { is_admin?: boolean | null } | null)?.is_admin ?? false;
  if (!isAdmin) return { ok: false as const, res: Response.json({ message: "No autorizado" }, { status: 403 }) };

  return { ok: true as const, session };
}

function toAbsoluteUrl(base: string, href: string) {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

async function fetchHtml(url: string) {
  const res = await fetch(url, {
    headers: {
      "user-agent": "PortalCryptoBot/1.0",
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) return { ok: false as const, message: `Fetch falló (${res.status})`, html: "" };
  const html = await res.text();
  return { ok: true as const, html };
}

export async function POST(req: Request) {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.res;

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
  const { data: source } = await admin
    .from("scrape_sources")
    .select("id,url,list_container_selector,link_selector,content_selector,ignore_selector,is_active")
    .eq("id", parsed.data.sourceId)
    .maybeSingle();

  const s = source as unknown as {
    id: string;
    url: string;
    list_container_selector: string;
    link_selector: string;
    content_selector: string;
    ignore_selector: string | null;
    is_active: boolean;
  } | null;

  if (!s) return Response.json({ message: "Fuente no encontrada." }, { status: 404 });
  if (!s.is_active) return Response.json({ message: "La fuente está desactivada." }, { status: 400 });

  const listRes = await fetchHtml(s.url);
  if (!listRes.ok) return Response.json({ message: listRes.message }, { status: 502 });

  const $ = cheerio.load(listRes.html);
  const containers = $(s.list_container_selector);
  if (containers.length === 0) {
    return Response.json({ message: "Selector lista no encontró elementos." }, { status: 200 });
  }

  const candidates: Array<{ url: string; title: string }> = [];
  containers.each((_idx, el) => {
    const a = $(el).find(s.link_selector).first();
    const href = (a.attr("href") ?? "").trim();
    const title = a.text().trim() || $(el).text().trim().slice(0, 200);
    const abs = href ? toAbsoluteUrl(s.url, href) : null;
    if (!abs) return;
    if (candidates.some((c) => c.url === abs)) return;
    candidates.push({ url: abs, title });
  });

  const urls = candidates.slice(0, parsed.data.limit);
  let insertedCount = 0;

  for (const item of urls) {
    const pageRes = await fetchHtml(item.url);
    if (!pageRes.ok) continue;
    const $$ = cheerio.load(pageRes.html);
    const root = $$(s.content_selector).first();
    if (root.length === 0) continue;
    if (s.ignore_selector) {
      root.find(s.ignore_selector).remove();
    }
    const text = root.text().replace(/\s+/g, " ").trim();
    const contentText = text.length > 4000 ? `${text.slice(0, 4000)}…` : text;

    const { error } = await admin.from("scraped_posts").insert({
      source_id: s.id,
      url: item.url,
      title: item.title || null,
      content_text: contentText || null,
      status: "pending",
      fetched_at: new Date().toISOString(),
    } as never);

    if (error) {
      const msg = (error.message ?? "").toLowerCase();
      const isDup = msg.includes("duplicate") || msg.includes("unique");
      if (!isDup) continue;
      continue;
    }
    insertedCount += 1;
  }

  return Response.json({ ok: true, inserted: insertedCount }, { status: 200 });
}

