import { z } from "zod";

import { createSupabaseRouteClient } from "@/lib/supabase/server";

const schema = z.object({
  imageUrl: z.string().trim().url(),
});

function getGroqKey() {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("Falta GROQ_API_KEY");
  return key;
}

function extractJson(text: string) {
  const cleaned = (text ?? "").trim();
  if (!cleaned) return null;
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < 0 || end <= start) return null;
  const candidate = cleaned.slice(start, end + 1);
  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    return null;
  }
}

function readChoiceContent(payload: unknown) {
  const root = payload as { choices?: unknown } | null;
  const choices = Array.isArray(root?.choices) ? root?.choices : [];
  const first = (choices[0] ?? null) as { message?: unknown } | null;
  const message = (first?.message ?? null) as { content?: unknown } | null;
  return typeof message?.content === "string" ? message.content : "";
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

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ message: "Parámetros inválidos" }, { status: 400 });
  }

  const imageUrl = parsed.data.imageUrl;
  let rawText = "";
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${getGroqKey()}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        temperature: 0,
        top_p: 1,
        max_tokens: 256,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: [
                  "Analizá la imagen y decidí si es apta para todo público.",
                  "Bloqueá cualquier contenido sexual explícito, desnudez, pornografía o contenido +18.",
                  'Respondé SOLO con JSON con esta forma: {"allow": boolean, "reason": string, "nsfw": boolean}.',
                  "Si no estás seguro, allow=false.",
                ].join("\n"),
              },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
      }),
    });

    const data: unknown = await res.json().catch(() => null);
    rawText = readChoiceContent(data);
    if (!res.ok) {
      return Response.json(
        { message: "No pudimos verificar la imagen. Intentá de nuevo.", details: rawText },
        { status: 502 },
      );
    }
  } catch {
    return Response.json({ message: "No pudimos verificar la imagen. Intentá de nuevo." }, { status: 502 });
  }

  const json = extractJson(rawText) as
    | { allow?: unknown; reason?: unknown; nsfw?: unknown }
    | null;

  const allow = json?.allow === true;
  const nsfw = json?.nsfw === true;
  const reason = typeof json?.reason === "string" && json.reason.trim() ? json.reason.trim() : "Contenido no permitido.";

  if (!allow || nsfw) {
    return Response.json({ allow: false, reason }, { status: 200 });
  }

  return Response.json({ allow: true, reason: "OK" }, { status: 200 });
}
