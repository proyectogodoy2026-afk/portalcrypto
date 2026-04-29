"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";

import CoinSearchDropdown from "@/components/market/CoinSearchDropdown";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";

export type CommunityOption = {
  id: string;
  name: string;
  slug: string;
  type: string | null;
  member_count: number | null;
};

type TokenResult = { id: string; name: string; symbol: string; thumb: string };

const advancedSchema = z.object({
  title: z.string().min(10, "El título debe tener al menos 10 caracteres").max(300),
  community_id: z.string().min(1, "Seleccioná una comunidad"),
});

const beginnerSchema = z.object({
  title: z.string().min(10, "El título debe tener al menos 10 caracteres").max(300),
  community_id: z.string().min(1, "Seleccioná una comunidad"),
  what_happened: z.string().min(1, "Contá qué pasó").max(150),
  why_it_matters: z.string().min(1, "Contá por qué importa").max(150),
  who_is_affected: z.string().max(150).optional(),
  risk_indicator: z.enum(["bajo", "medio", "alto"] as const, {
    message: "Seleccioná un nivel de riesgo",
  }),
});

export default function PostEditor({
  communities,
  defaultCommunityId,
}: {
  communities: CommunityOption[];
  defaultCommunityId?: string | null;
}) {
  const router = useRouter();
  const { profile, loading } = useAuth();

  const mode = profile?.preferred_mode === "advanced" ? "advanced" : "beginner";

  const [title, setTitle] = React.useState("");
  const [communityId, setCommunityId] = React.useState(defaultCommunityId ?? "");
  const [type, setType] = React.useState("texto");
  const [tag, setTag] = React.useState<string>("");
  const [risk, setRisk] = React.useState<"bajo" | "medio" | "alto" | "">("");
  const [url, setUrl] = React.useState("");
  const [content, setContent] = React.useState("");

  const [whatHappened, setWhatHappened] = React.useState("");
  const [whyItMatters, setWhyItMatters] = React.useState("");
  const [whoIsAffected, setWhoIsAffected] = React.useState("");

  const [anchoredCoin, setAnchoredCoin] = React.useState<TokenResult | null>(null);

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const topCommunities = React.useMemo(
    () => communities.slice().sort((a, b) => (b.member_count ?? 0) - (a.member_count ?? 0)).slice(0, 5),
    [communities],
  );

  const communitySelect = (
    <select
      className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900"
      value={communityId}
      onChange={(e) => setCommunityId(e.target.value)}
    >
      <option value="">Seleccioná una comunidad</option>
      {communities.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name} (/c/{c.slug})
        </option>
      ))}
    </select>
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (loading) return;

    const base = { title: title.trim(), community_id: communityId };
    const parsed =
      mode === "advanced"
        ? advancedSchema.safeParse(base)
        : beginnerSchema.safeParse({
            ...base,
            what_happened: whatHappened.trim(),
            why_it_matters: whyItMatters.trim(),
            who_is_affected: whoIsAffected.trim() || undefined,
            risk_indicator: risk,
          });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }

    setSubmitting(true);
    const payload =
      mode === "advanced"
        ? {
            mode: "advanced" as const,
            title: title.trim(),
            community_id: communityId,
            type,
            tag: tag || null,
            anchored_coin_id: anchoredCoin?.id ?? null,
            risk_indicator: risk || null,
            url: url.trim() || null,
            content: content.trim() || null,
          }
        : {
            mode: "beginner" as const,
            title: title.trim(),
            community_id: communityId,
            what_happened: whatHappened.trim(),
            why_it_matters: whyItMatters.trim(),
            who_is_affected: whoIsAffected.trim() || null,
            risk_indicator: risk as "bajo" | "medio" | "alto",
          };

    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.message ?? "No pudimos crear el post.");
      return;
    }

    const data = (await res.json()) as { id: string };
    router.push(`/post/${data.id}`);
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-2xl rounded-lg border border-zinc-200 bg-white p-6"
    >
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900">Crear post</h1>
        <div className="text-xs text-zinc-600">
          Modo: {mode === "advanced" ? "Avanzado" : "Principiante"}
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <div className="space-y-1">
          <Label htmlFor="title">Título</Label>
          <Input
            id="title"
            name="title"
            maxLength={300}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={mode === "beginner" ? "¿Por qué...?" : "Escribí un título claro"}
          />
          <div className="text-xs text-zinc-500">{title.length}/300</div>
        </div>

        <div className="space-y-1">
          <Label>Comunidad</Label>
          {mode === "beginner" ? (
            <div className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-2">
                {topCommunities.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCommunityId(c.id)}
                    className={cn(
                      "rounded-md border px-3 py-2 text-left text-sm",
                      communityId === c.id
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50",
                    )}
                  >
                    <div className="font-medium">{c.name}</div>
                    <div className={cn("mt-1 text-xs", communityId === c.id ? "text-white/70" : "text-zinc-500")}>
                      /c/{c.slug}
                    </div>
                  </button>
                ))}
              </div>
              {communitySelect}
            </div>
          ) : (
            communitySelect
          )}
        </div>

        {mode === "advanced" ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Tipo</Label>
                <select
                  className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="texto">Texto</option>
                  <option value="link">Link</option>
                  <option value="analisis">Análisis</option>
                  <option value="noticia">Noticia</option>
                  <option value="alerta">Alerta</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Tag</Label>
                <select
                  className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900"
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                >
                  <option value="">Sin tag</option>
                  <option value="news">news</option>
                  <option value="rumor">rumor</option>
                  <option value="on-chain">on-chain</option>
                  <option value="opinion">opinion</option>
                  <option value="technical-analysis">technical-analysis</option>
                  <option value="scam-alert">scam-alert</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Anclar token (opcional)</Label>
              {anchoredCoin ? (
                <div className="mt-2 flex items-center justify-between rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-zinc-500">
                      {anchoredCoin.symbol.toUpperCase()}
                    </div>
                    <div className="font-medium text-zinc-900">{anchoredCoin.name}</div>
                    <div className="text-xs text-zinc-500">{anchoredCoin.id}</div>
                  </div>
                  <Button type="button" variant="outline" onClick={() => setAnchoredCoin(null)}>
                    Quitar
                  </Button>
                </div>
              ) : (
                <CoinSearchDropdown
                  value={anchoredCoin}
                  onSelect={(coin) => setAnchoredCoin(coin)}
                />
              )}
            </div>

            <div className="space-y-1">
              <Label>Indicador de riesgo</Label>
              <select
                className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900"
                value={risk}
                onChange={(e) =>
                  setRisk(e.target.value as "bajo" | "medio" | "alto" | "")
                }
              >
                <option value="">Sin indicador</option>
                <option value="bajo">Bajo</option>
                <option value="medio">Medio</option>
                <option value="alto">Alto</option>
              </select>
            </div>

            {type === "link" ? (
              <div className="space-y-1">
                <Label>Link</Label>
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
              </div>
            ) : null}

            <div className="space-y-1">
              <Label>Contenido (markdown básico)</Label>
              <textarea
                className="min-h-40 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Escribí tu post..."
              />
            </div>
          </>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Qué pasó</Label>
                <Input
                  maxLength={150}
                  value={whatHappened}
                  onChange={(e) => setWhatHappened(e.target.value)}
                  placeholder="Resumen corto"
                />
                <div className="text-xs text-zinc-500">{whatHappened.length}/150</div>
              </div>
              <div className="space-y-1">
                <Label>Por qué importa</Label>
                <Input
                  maxLength={150}
                  value={whyItMatters}
                  onChange={(e) => setWhyItMatters(e.target.value)}
                  placeholder="Impacto o contexto"
                />
                <div className="text-xs text-zinc-500">{whyItMatters.length}/150</div>
              </div>
            </div>

            <div className="space-y-1">
              <Label>A quién afecta (opcional)</Label>
              <Input
                maxLength={150}
                value={whoIsAffected}
                onChange={(e) => setWhoIsAffected(e.target.value)}
                placeholder="Usuarios, holders, traders, etc."
              />
              <div className="text-xs text-zinc-500">{whoIsAffected.length}/150</div>
            </div>

            <div className="space-y-2">
              <Label>Nivel de riesgo</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {(["bajo", "medio", "alto"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setRisk(v)}
                    className={cn(
                      "rounded-md border px-3 py-2 text-sm capitalize",
                      risk === v
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50",
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting || loading}>
            {submitting ? "Publicando..." : "Publicar"}
          </Button>
        </div>
      </div>
    </form>
  );
}
