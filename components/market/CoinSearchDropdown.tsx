"use client";

import * as React from "react";
import Image from "next/image";
import useSWR from "swr";

import { searchCoins, type SearchResult } from "@/lib/api/coingecko";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

export default function CoinSearchDropdown({
  value,
  onSelect,
  placeholder,
}: {
  value: SearchResult | null;
  onSelect: (coin: SearchResult) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const timerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const { data, isLoading } = useSWR<SearchResult[]>(
    debounced ? ["coingecko-search", debounced] : null,
    () => searchCoins(debounced),
    { dedupingInterval: 60_000 },
  );

  const results = (data ?? []).slice(0, 12);

  return (
    <div className="relative">
      <Input
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          const v = e.target.value;
          setQuery(v);
          setOpen(true);

          if (timerRef.current) window.clearTimeout(timerRef.current);
          timerRef.current = window.setTimeout(() => {
            setDebounced(v.trim());
          }, 300);
        }}
        placeholder={placeholder ?? "Buscar token (BTC, ETH, ...)"}
      />

      {value ? (
        <div className="mt-2 flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
          <div className="flex min-w-0 items-center gap-2">
            <div className="h-5 w-5 shrink-0 overflow-hidden rounded-full bg-zinc-100">
              {value.thumb ? (
                <Image
                  src={value.thumb}
                  alt=""
                  width={20}
                  height={20}
                  className="h-5 w-5"
                  unoptimized
                />
              ) : null}
            </div>
            <div className="min-w-0">
              <div className="truncate font-medium text-zinc-900">{value.name}</div>
              <div className="text-xs text-zinc-500">
                {value.symbol.toUpperCase()} · {value.id}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-900 hover:bg-zinc-50"
            onClick={() => {
              setQuery("");
              setDebounced("");
              setOpen(false);
            }}
          >
            Cambiar
          </button>
        </div>
      ) : null}

      {open && !value && debounced ? (
        <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm">
          {isLoading ? (
            <div className="px-3 py-2 text-sm text-zinc-600">Buscando...</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-sm text-zinc-600">Sin resultados.</div>
          ) : (
            <div className="max-h-64 overflow-auto">
              {results.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-50",
                  )}
                  onClick={() => {
                    onSelect(t);
                    setQuery("");
                    setDebounced("");
                    setOpen(false);
                  }}
                >
                  <div className="h-5 w-5 shrink-0 overflow-hidden rounded-full bg-zinc-100">
                    {t.thumb ? (
                      <Image
                        src={t.thumb}
                        alt=""
                        width={20}
                        height={20}
                        className="h-5 w-5"
                        unoptimized
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-zinc-900">
                      {t.name}{" "}
                      <span className="text-xs font-normal text-zinc-500">
                        ({t.symbol.toUpperCase()})
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

