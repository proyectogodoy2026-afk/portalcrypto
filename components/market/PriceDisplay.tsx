"use client";

import * as React from "react";
import useSWR from "swr";

import { getPrice, type CoinPrice } from "@/lib/api/coingecko";
import { cn } from "@/lib/utils/cn";

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPct(value: number) {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function trendClass(value: number) {
  if (value > 0) return "text-emerald-600";
  if (value < 0) return "text-red-600";
  return "text-zinc-600";
}

function buildSparkPath(points: number[], w: number, h: number) {
  const xs = points.length;
  if (xs < 2) return "";
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const d = points
    .map((p, i) => {
      const x = (i / (xs - 1)) * w;
      const y = h - ((p - min) / range) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  return d;
}

export default function PriceDisplay({
  coinId,
  symbol,
  showSparkline,
}: {
  coinId: string;
  symbol?: string | null;
  showSparkline?: boolean;
}) {
  const { data, isLoading, error } = useSWR<CoinPrice>(
    coinId ? ["coingecko-price", coinId] : null,
    () => getPrice(coinId),
    { refreshInterval: 60_000, dedupingInterval: 60_000 },
  );

  const effectiveSymbol = (symbol ?? data?.symbol ?? "").toUpperCase();
  const price = data?.current_price;
  const ch1h = data?.price_change_percentage_1h_in_currency;
  const ch24h = data?.price_change_percentage_24h;
  const ch7d = data?.price_change_percentage_7d_in_currency;

  const spark = React.useMemo(() => {
    const pts = data?.sparkline_in_7d?.price ?? [];
    if (pts.length === 0) return [];
    return pts.length <= 24 ? pts : pts.slice(pts.length - 24);
  }, [data?.sparkline_in_7d?.price]);

  const sparkPath = React.useMemo(() => {
    if (!showSparkline) return "";
    if (spark.length < 2) return "";
    return buildSparkPath(spark, 120, 32);
  }, [showSparkline, spark]);

  return (
    <div className="rounded-md border border-zinc-200 bg-white px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium text-zinc-500">
            {effectiveSymbol || coinId}
          </div>
          <div className="text-sm font-semibold text-zinc-900">
            {typeof price === "number" ? formatUsd(price) : isLoading ? "Cargando..." : "—"}
          </div>
        </div>

        {showSparkline ? (
          <div className="shrink-0">
            <svg width="120" height="32" viewBox="0 0 120 32" className="text-zinc-900">
              <path d={sparkPath} fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="mt-2 text-xs text-red-700">No pudimos cargar el precio.</div>
      ) : (
        <div className="mt-2 grid gap-1 text-xs text-zinc-600 sm:grid-cols-4">
          <div className={cn("tabular-nums", typeof ch1h === "number" ? trendClass(ch1h) : "")}>
            1h: {typeof ch1h === "number" ? formatPct(ch1h) : "—"}
          </div>
          <div className={cn("tabular-nums", typeof ch24h === "number" ? trendClass(ch24h) : "")}>
            24h: {typeof ch24h === "number" ? formatPct(ch24h) : "—"}
          </div>
          <div className={cn("tabular-nums", typeof ch7d === "number" ? trendClass(ch7d) : "")}>
            7d: {typeof ch7d === "number" ? formatPct(ch7d) : "—"}
          </div>
          <div className="tabular-nums text-zinc-600">
            MC: {typeof data?.market_cap === "number" ? formatUsd(data.market_cap) : "—"}
          </div>
        </div>
      )}
    </div>
  );
}
