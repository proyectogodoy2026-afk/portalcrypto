"use client";

import * as React from "react";
import useSWR from "swr";
import { z } from "zod";

import CoinSearchDropdown from "@/components/market/CoinSearchDropdown";
import PriceDisplay from "@/components/market/PriceDisplay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getPrice, type SearchResult } from "@/lib/api/coingecko";
import { cn } from "@/lib/utils/cn";

const formSchema = z.object({
  coin: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    symbol: z.string().min(1),
    thumb: z.string().optional().default(""),
  }),
  direction: z.enum(["above", "below"]),
  target_price: z.coerce.number().positive(),
  term_days: z.coerce.number().refine((v) => [7, 14, 30, 90].includes(v)),
  description: z.string().max(200).optional().nullable(),
});

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

export default function PredictionForm({ onCreated }: { onCreated?: () => void }) {
  const [coin, setCoin] = React.useState<SearchResult | null>(null);
  const [direction, setDirection] = React.useState<"above" | "below">("above");
  const [targetPrice, setTargetPrice] = React.useState("");
  const [termDays, setTermDays] = React.useState<7 | 14 | 30 | 90>(7);
  const [description, setDescription] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [created, setCreated] = React.useState(false);

  const { data: current } = useSWR(
    coin?.id ? ["prediction-coin", coin.id] : null,
    () => getPrice(coin?.id as string),
    { refreshInterval: 60_000, dedupingInterval: 60_000 },
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreated(false);

    const parsed = formSchema.safeParse({
      coin,
      direction,
      target_price: targetPrice,
      term_days: termDays,
      description: description.trim() || null,
    });

    if (!parsed.success) {
      setError("Completá todos los campos requeridos.");
      return;
    }

    setSubmitting(true);
    const res = await fetch("/api/predictions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        coin_id: parsed.data.coin.id,
        coin_symbol: parsed.data.coin.symbol,
        direction: parsed.data.direction,
        target_price: parsed.data.target_price,
        term_days: parsed.data.term_days,
        description: parsed.data.description,
      }),
    });
    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.message ?? "No pudimos crear la predicción.");
      return;
    }

    setCreated(true);
    setCoin(null);
    setTargetPrice("");
    setTermDays(7);
    setDescription("");
    onCreated?.();
  }

  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-zinc-200 bg-white p-6">
      <div className="text-lg font-semibold text-zinc-900">Nueva predicción</div>
      <div className="mt-1 text-sm text-zinc-600">
        Guardá una predicción y se evaluará automáticamente cuando venza.
      </div>

      <div className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label>Activo</Label>
          <CoinSearchDropdown value={coin} onSelect={setCoin} />
          {coin?.id ? (
            <div className="mt-2">
              <PriceDisplay coinId={coin.id} symbol={coin.symbol} />
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label>Dirección</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setDirection("above")}
              className={cn(
                "rounded-md border px-3 py-2 text-left text-sm",
                direction === "above"
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50",
              )}
            >
              Estará POR ENCIMA de
            </button>
            <button
              type="button"
              onClick={() => setDirection("below")}
              className={cn(
                "rounded-md border px-3 py-2 text-left text-sm",
                direction === "below"
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50",
              )}
            >
              Estará POR DEBAJO de
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Precio objetivo (USD)</Label>
          <Input
            inputMode="decimal"
            value={targetPrice}
            onChange={(e) => setTargetPrice(e.target.value)}
            placeholder="0.00"
          />
          {typeof current?.current_price === "number" ? (
            <div className="text-xs text-zinc-600">
              Precio actual aprox:{" "}
              <span className="font-medium text-zinc-900">
                {formatUsd(current.current_price)}
              </span>
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label>Plazo</Label>
          <div className="grid gap-2 sm:grid-cols-4">
            {([7, 14, 30, 90] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setTermDays(d)}
                className={cn(
                  "rounded-md border px-3 py-2 text-sm",
                  termDays === d
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50",
                )}
              >
                {d} días
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Descripción</Label>
          <textarea
            className="min-h-24 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
            value={description}
            maxLength={200}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Opcional (máx 200 caracteres)"
          />
          <div className="text-xs text-zinc-500">{description.length}/200</div>
        </div>

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {created ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Predicción creada.
          </div>
        ) : null}

        <div className="flex items-center justify-end">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Guardando..." : "Crear predicción"}
          </Button>
        </div>
      </div>
    </form>
  );
}

