"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const TYPES: Array<{ value: "asset" | "topic" | "region" | "level" | "other"; label: string }> = [
  { value: "asset", label: "Asset" },
  { value: "topic", label: "Tema" },
  { value: "region", label: "Región" },
  { value: "level", label: "Nivel" },
  { value: "other", label: "Otra" },
];

export default function CommunityRequestForm() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState<(typeof TYPES)[number]["value"]>("topic");
  const [reason, setReason] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<{ id: string; slug: string } | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    startTransition(() => {
      void (async () => {
        const res = await fetch("/api/communities/request", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name, type, reason }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setError(data?.message ?? "No pudimos enviar la solicitud.");
          return;
        }
        setSuccess({ id: String(data?.id ?? ""), slug: String(data?.slug ?? "") });
        setName("");
        setReason("");
        router.refresh();
      })();
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Crear comunidad</h1>
        <div className="mt-1 text-sm text-zinc-600">
          Tu comunidad quedará pendiente hasta que un administrador la apruebe.
        </div>
      </div>

      <form onSubmit={onSubmit} className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="space-y-3">
          <div>
            <Label>Nombre</Label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900"
              placeholder="Ej: Solana, DeFi, LATAM Crypto…"
              maxLength={60}
              required
            />
          </div>

          <div>
            <Label>Tipo</Label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as (typeof TYPES)[number]["value"])}
              className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900"
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label>Razón (obligatoria)</Label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 min-h-28 w-full resize-y rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
              placeholder="Explicá por qué debería existir esta comunidad y qué reglas básicas tendría…"
              maxLength={500}
              required
            />
            <div className="mt-1 text-xs text-zinc-500">{reason.length}/500</div>
          </div>

          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              Solicitud enviada. Cuando sea aprobada aparecerá como /c/{success.slug || "—"}.
              <div className="mt-2">
                <Link href="/" className="text-sm font-medium underline">
                  Volver al feed
                </Link>
              </div>
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button type="submit" disabled={pending || !name.trim() || reason.trim().length < 10}>
              {pending ? "Enviando…" : "Enviar solicitud"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

