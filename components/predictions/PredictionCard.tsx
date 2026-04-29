"use client";

import * as React from "react";
import useSWR from "swr";

import { getPrice } from "@/lib/api/coingecko";
import { cn } from "@/lib/utils/cn";
import type { Prediction } from "@/lib/supabase/types";

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string) {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(d);
}

function badge(status: string) {
  if (status === "correct") return { text: "✅ Correcto", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  if (status === "incorrect") return { text: "❌ Incorrecto", cls: "border-red-200 bg-red-50 text-red-700" };
  return { text: "⏳ Pendiente", cls: "border-zinc-200 bg-zinc-50 text-zinc-700" };
}

export default function PredictionCard({
  prediction,
  username,
}: {
  prediction: Prediction;
  username?: string | null;
}) {
  const [nowMs, setNowMs] = React.useState<number | null>(null);
  React.useEffect(() => {
    const immediate = window.setTimeout(() => setNowMs(Date.now()), 0);
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => {
      window.clearTimeout(immediate);
      window.clearInterval(id);
    };
  }, []);

  const { data: current } = useSWR(
    prediction.coin_id ? ["prediction-price", prediction.coin_id] : null,
    () => getPrice(prediction.coin_id),
    { refreshInterval: 60_000, dedupingInterval: 60_000 },
  );

  const dirText = prediction.direction === "below" ? "BAJO" : "SOBRE";
  const target = prediction.target_price;
  const nowPrice = current?.current_price;
  const distancePct =
    typeof nowPrice === "number" && target > 0 ? ((nowPrice - target) / target) * 100 : null;

  const targetMs = new Date(prediction.target_date).getTime();
  const createdMs = prediction.created_at ? new Date(prediction.created_at).getTime() : null;
  const remainingDays =
    prediction.status === "pending" && Number.isFinite(targetMs)
      ? nowMs
        ? Math.max(0, Math.ceil((targetMs - nowMs) / (24 * 60 * 60 * 1000)))
        : 0
      : 0;

  const progress = React.useMemo(() => {
    if (!createdMs || !Number.isFinite(createdMs) || !Number.isFinite(targetMs) || !nowMs) return 0;
    const denom = targetMs - createdMs;
    if (denom <= 0) return 1;
    const p = (nowMs - createdMs) / denom;
    return Math.max(0, Math.min(1, p));
  }, [createdMs, nowMs, targetMs]);

  const b = badge(prediction.status);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-zinc-900">
            {(username ?? "Usuario").trim() || "Usuario"} dice que{" "}
            <span className="font-semibold">{prediction.coin_symbol.toUpperCase()}</span>{" "}
            estará {dirText}{" "}
            <span className="font-semibold">{formatUsd(target)}</span> para{" "}
            <span className="font-semibold">{formatDate(prediction.target_date)}</span>
          </div>
          {prediction.description?.trim() ? (
            <div className="mt-1 text-sm text-zinc-600">{prediction.description}</div>
          ) : null}
        </div>

        <div className={cn("shrink-0 rounded-full border px-3 py-1 text-xs", b.cls)}>
          {b.text}
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-sm text-zinc-700 sm:grid-cols-3">
        <div>
          <div className="text-xs text-zinc-500">Precio actual</div>
          <div className="font-medium">
            {typeof nowPrice === "number" ? formatUsd(nowPrice) : "—"}
          </div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Distancia</div>
          <div
            className={cn(
              "font-medium tabular-nums",
              typeof distancePct === "number"
                ? distancePct >= 0
                  ? "text-emerald-700"
                  : "text-red-700"
                : "",
            )}
          >
            {typeof distancePct === "number"
              ? `${distancePct >= 0 ? "+" : ""}${distancePct.toFixed(2)}%`
              : "—"}
          </div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">
            {prediction.status === "pending" ? "Días restantes" : "Resultado"}
          </div>
          <div className="font-medium">
            {prediction.status === "pending" ? `${remainingDays} días` : b.text}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-1">
        <div className="flex items-center justify-between text-xs text-zinc-600">
          <span>Progreso</span>
          <span className="tabular-nums">{Math.round(progress * 100)}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200">
          <div className="h-2 bg-zinc-900" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      </div>
    </div>
  );
}
