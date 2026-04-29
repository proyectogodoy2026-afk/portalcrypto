"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";

import { reportScam } from "@/app/actions/scamReports";
import { cn } from "@/lib/utils/cn";

const REASONS = [
  { value: "fake-project", label: "Proyecto falso" },
  { value: "rug-pull", label: "Rug pull" },
  { value: "phishing", label: "Phishing" },
  { value: "fake-giveaway", label: "Giveaway falso" },
  { value: "pump-dump", label: "Pump & dump" },
  { value: "other", label: "Otro" },
] as const;

type Reason = (typeof REASONS)[number]["value"];
type TargetType = "post" | "comment" | "project";

export default function ScamReportButton({
  targetType,
  targetId,
  projectName,
  initialCount,
  onReported,
}: {
  targetType: TargetType;
  targetId?: string;
  projectName?: string | null;
  initialCount?: number;
  onReported?: (count: number) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState<Reason>("fake-project");
  const [description, setDescription] = React.useState("");
  const [evidenceUrl, setEvidenceUrl] = React.useState("");
  const [success, setSuccess] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [count, setCount] = React.useState<number>(initialCount ?? 0);
  const [isPending, startTransition] = React.useTransition();

  function close() {
    setOpen(false);
    setError(null);
    setSuccess(null);
  }

  function openModal(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
    setError(null);
    setSuccess(null);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    startTransition(() => {
      void (async () => {
        const res = await reportScam({
          targetType,
          targetId: targetId ?? null,
          projectName: projectName ?? null,
          reason,
          description: description.trim() ? description.trim() : null,
          evidenceUrl: evidenceUrl.trim() ? evidenceUrl.trim() : null,
        });

        if (!res.ok) {
          setError(res.message);
          return;
        }

        setCount(res.reportCount);
        onReported?.(res.reportCount);
        setSuccess("Tu reporte fue enviado. La comunidad lo revisará.");
        setDescription("");
        setEvidenceUrl("");
      })();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className={cn(
          "inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 hover:bg-zinc-50",
        )}
      >
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        Reportar
        {count > 0 ? (
          <span className="tabular-nums text-xs text-zinc-600">{count}</span>
        ) : null}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={close}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-lg rounded-lg border border-zinc-200 bg-white p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-base font-semibold text-zinc-900">
              Reportar como posible scam
            </div>
            <div className="mt-1 text-sm text-zinc-600">
              Sumá contexto para que moderadores y comunidad puedan evaluar.
            </div>

            <form className="mt-4 space-y-3" onSubmit={onSubmit}>
              <div className="space-y-1">
                <label className="text-sm font-medium text-zinc-900">Tipo de alerta</label>
                <select
                  className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900"
                  value={reason}
                  onChange={(e) => setReason(e.target.value as Reason)}
                >
                  {REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-zinc-900">Descripción (opcional)</label>
                <textarea
                  className="min-h-24 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                  value={description}
                  maxLength={500}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Qué te hace sospechar…"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-zinc-900">URL de evidencia (opcional)</label>
                <input
                  className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900"
                  value={evidenceUrl}
                  onChange={(e) => setEvidenceUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>

              {error ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              {success ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {success}
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={close}
                  className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 hover:bg-zinc-50"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className={cn(
                    "rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700",
                    isPending ? "opacity-60" : "",
                  )}
                >
                  {isPending ? "Enviando..." : "Enviar reporte"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

