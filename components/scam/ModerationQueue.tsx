"use client";

import * as React from "react";
import useSWR from "swr";

import { reviewScamReport } from "@/app/actions/scamReports";
import { cn } from "@/lib/utils/cn";

type ScamReportRow = {
  id: string;
  reporter_id: string | null;
  target_type: string;
  target_id: string | null;
  project_name: string | null;
  reason: string;
  description: string | null;
  evidence_url: string | null;
  status: string;
  created_at: string | null;
};

async function fetchJson<T>(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.message ?? "Error al cargar");
  }
  return (await res.json()) as T;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(d);
}

const REASONS = [
  "fake-project",
  "rug-pull",
  "phishing",
  "fake-giveaway",
  "pump-dump",
  "other",
] as const;

export default function ModerationQueue() {
  const [reason, setReason] = React.useState<string>("");
  const [isPending, startTransition] = React.useTransition();
  const [actionError, setActionError] = React.useState<string | null>(null);

  const url = reason ? `/api/moderation/scam-reports?status=pending&reason=${encodeURIComponent(reason)}` : "/api/moderation/scam-reports?status=pending";
  const swr = useSWR<{ reports: ScamReportRow[] }>(url, fetchJson);

  async function onReview(reportId: string, status: "confirmed" | "dismissed") {
    setActionError(null);
    startTransition(() => {
      void (async () => {
        const res = await reviewScamReport({ reportId, status });
        if (!res.ok) {
          setActionError(res.message);
          return;
        }
        await swr.mutate();
      })();
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Cola de moderación</h1>
        <div className="mt-1 text-sm text-zinc-600">
          Revisá reportes y marcá como confirmados o descartados.
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm text-zinc-700">Filtrar</label>
        <select
          className="h-9 rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        >
          <option value="">Todos</option>
          {REASONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      {actionError ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </div>
      ) : null}

      {swr.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {String(swr.error?.message ?? "Error")}
        </div>
      ) : null}

      {swr.isLoading ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
          Cargando...
        </div>
      ) : (swr.data?.reports ?? []).length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
          No hay reportes pendientes.
        </div>
      ) : (
        <div className="space-y-3">
          {(swr.data?.reports ?? []).map((r) => (
            <div key={r.id} className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-zinc-900">
                    {r.target_type === "project"
                      ? `Proyecto: ${r.project_name ?? "—"}`
                      : r.target_type === "comment"
                        ? "Comentario"
                        : "Post"}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {r.reason} · {formatDate(r.created_at)}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => onReview(r.id, "confirmed")}
                    className={cn(
                      "rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700",
                      isPending ? "opacity-60" : "",
                    )}
                  >
                    Confirmar
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => onReview(r.id, "dismissed")}
                    className={cn(
                      "rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 hover:bg-zinc-50",
                      isPending ? "opacity-60" : "",
                    )}
                  >
                    Descartar
                  </button>
                </div>
              </div>

              {r.description?.trim() ? (
                <div className="mt-3 text-sm text-zinc-700">{r.description}</div>
              ) : null}

              {r.evidence_url?.trim() ? (
                <a
                  className="mt-2 block text-sm text-blue-700 underline"
                  href={r.evidence_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver evidencia
                </a>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

