import Link from "next/link";
import { redirect } from "next/navigation";

import { getTopMarkets } from "@/lib/api/coingecko";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 2 : value >= 1 ? 4 : 8,
  }).format(value);
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function changeClass(pct: number) {
  if (!Number.isFinite(pct)) return "text-zinc-500";
  if (pct > 0) return "text-emerald-700";
  if (pct < 0) return "text-red-700";
  return "text-zinc-600";
}

export default async function MarketsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/auth/login");
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", session.user.id)
    .maybeSingle();
  const profile = profileData as unknown as { onboarding_completed: boolean | null } | null;

  if (!(profile?.onboarding_completed ?? false)) {
    redirect("/onboarding");
  }

  const coins = await getTopMarkets({ perPage: 50, page: 1 });

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="text-xl font-semibold text-zinc-900">Mercados</div>
        <div className="mt-1 text-sm text-zinc-600">
          Top por market cap (USD). Tocá “Crear post” para iniciar un debate anclado al token.
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <div className="grid grid-cols-12 gap-2 border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-medium text-zinc-600">
          <div className="col-span-6">Activo</div>
          <div className="col-span-2 text-right">Precio</div>
          <div className="col-span-2 text-right">24h</div>
          <div className="col-span-2 text-right">Market cap</div>
        </div>
        <div className="divide-y divide-zinc-100">
          {coins.map((c) => (
            <div key={c.id} className="grid grid-cols-12 items-center gap-2 px-4 py-3">
              <div className="col-span-6 min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-zinc-900">
                      {c.name}{" "}
                      <span className="text-xs font-semibold text-zinc-500">
                        {c.symbol.toUpperCase()}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                      {c.market_cap_rank ? <span>#{c.market_cap_rank}</span> : null}
                      <span>ID: {c.id}</span>
                      <span>Vol: {formatCompact(c.total_volume)}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-span-2 text-right text-sm font-medium text-zinc-900">
                {formatUsd(c.current_price)}
              </div>
              <div className={"col-span-2 text-right text-sm font-medium " + changeClass(c.price_change_percentage_24h)}>
                {Number.isFinite(c.price_change_percentage_24h)
                  ? `${c.price_change_percentage_24h.toFixed(2)}%`
                  : "—"}
              </div>
              <div className="col-span-2 text-right">
                <div className="text-sm font-medium text-zinc-900">{formatCompact(c.market_cap)}</div>
                <div className="mt-1 flex justify-end">
                  <Link
                    href={`/post/new?coin=${encodeURIComponent(c.id)}&coin_name=${encodeURIComponent(
                      c.name,
                    )}&coin_symbol=${encodeURIComponent(c.symbol)}`}
                    className="inline-flex h-8 items-center justify-center rounded-md bg-zinc-900 px-3 text-xs font-medium text-white hover:bg-zinc-800"
                  >
                    Crear post
                  </Link>
                </div>
              </div>
            </div>
          ))}

          {coins.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-zinc-600">
              No pudimos cargar el mercado. Intentá de nuevo.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

