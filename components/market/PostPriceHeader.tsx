"use client";

import * as React from "react";

import PriceDisplay from "@/components/market/PriceDisplay";

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

export default function PostPriceHeader({
  coinId,
  symbol,
  priceAtPost,
  showSparkline,
}: {
  coinId: string;
  symbol?: string | null;
  priceAtPost: number | null;
  showSparkline?: boolean;
}) {
  if (!coinId) return null;

  return (
    <div className="mb-3 space-y-2">
      <PriceDisplay coinId={coinId} symbol={symbol} showSparkline={showSparkline} />
      {typeof priceAtPost === "number" ? (
        <div className="text-xs text-zinc-600">
          Precio cuando se publicó:{" "}
          <span className="font-medium text-zinc-900">{formatUsd(priceAtPost)}</span>
        </div>
      ) : null}
    </div>
  );
}

