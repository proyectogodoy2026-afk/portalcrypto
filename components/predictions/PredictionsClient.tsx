"use client";

import * as React from "react";
import useSWR from "swr";

import PredictionCard from "@/components/predictions/PredictionCard";
import PredictionForm from "@/components/predictions/PredictionForm";
import { cn } from "@/lib/utils/cn";
import type { Prediction } from "@/lib/supabase/types";

type RankingRow = {
  user_id: string;
  correct: number;
  total: number;
  ratio: number;
  username: string | null;
  avatar_url: string | null;
};

async function fetchJson<T>(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.message ?? "Error al cargar");
  }
  return (await res.json()) as T;
}

export default function PredictionsClient({
  username,
  initialPending,
  initialResolved,
  initialRanking,
}: {
  username: string | null;
  initialPending: Prediction[];
  initialResolved: Prediction[];
  initialRanking: RankingRow[];
}) {
  const [tab, setTab] = React.useState<"active" | "resolved" | "ranking">("active");

  const pending = useSWR<{ predictions: Prediction[] }>(
    "/api/predictions?status=pending",
    fetchJson,
    { fallbackData: { predictions: initialPending } },
  );
  const resolved = useSWR<{ predictions: Prediction[] }>(
    "/api/predictions?status=resolved",
    fetchJson,
    { fallbackData: { predictions: initialResolved } },
  );
  const ranking = useSWR<{ ranking: RankingRow[] }>(
    "/api/predictions/ranking",
    fetchJson,
    { fallbackData: { ranking: initialRanking } },
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Predicciones</h1>
        <div className="mt-1 text-sm text-zinc-600">
          Seguimiento automático y ranking mensual.
        </div>
      </div>

      <PredictionForm
        onCreated={() => {
          void pending.mutate();
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={cn(
            "rounded-md border px-3 py-2 text-sm",
            tab === "active"
              ? "border-zinc-900 bg-zinc-900 text-white"
              : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50",
          )}
          onClick={() => setTab("active")}
        >
          Activas
        </button>
        <button
          type="button"
          className={cn(
            "rounded-md border px-3 py-2 text-sm",
            tab === "resolved"
              ? "border-zinc-900 bg-zinc-900 text-white"
              : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50",
          )}
          onClick={() => setTab("resolved")}
        >
          Resueltas
        </button>
        <button
          type="button"
          className={cn(
            "rounded-md border px-3 py-2 text-sm",
            tab === "ranking"
              ? "border-zinc-900 bg-zinc-900 text-white"
              : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50",
          )}
          onClick={() => setTab("ranking")}
        >
          Ranking
        </button>
      </div>

      {tab === "active" ? (
        <div className="space-y-3">
          {(pending.data?.predictions ?? []).length === 0 ? (
            <div className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
              No tenés predicciones activas.
            </div>
          ) : (
            (pending.data?.predictions ?? []).map((p) => (
              <PredictionCard key={p.id} prediction={p} username={username ?? "Vos"} />
            ))
          )}
        </div>
      ) : null}

      {tab === "resolved" ? (
        <div className="space-y-3">
          {(resolved.data?.predictions ?? []).length === 0 ? (
            <div className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
              Todavía no tenés predicciones resueltas.
            </div>
          ) : (
            (resolved.data?.predictions ?? []).map((p) => (
              <PredictionCard key={p.id} prediction={p} username={username ?? "Vos"} />
            ))
          )}
        </div>
      ) : null}

      {tab === "ranking" ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="text-sm font-medium text-zinc-900">
            Top predictores del mes
          </div>
          <div className="mt-3 space-y-2">
            {(ranking.data?.ranking ?? []).length === 0 ? (
              <div className="text-sm text-zinc-600">Todavía no hay ranking.</div>
            ) : (
              (ranking.data?.ranking ?? []).map((r, idx) => (
                <div
                  key={r.user_id}
                  className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-6 text-xs text-zinc-500 tabular-nums">
                      #{idx + 1}
                    </div>
                    <div className="font-medium text-zinc-900">
                      {r.username ?? "Usuario"}
                    </div>
                  </div>
                  <div className="text-xs text-zinc-600 tabular-nums">
                    {r.correct}/{r.total} · {(r.ratio * 100).toFixed(0)}%
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

