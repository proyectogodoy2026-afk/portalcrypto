"use client";

import * as React from "react";

import { useAuth } from "@/components/auth/AuthProvider";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";

const ITEMS = [
  { title: "Wallet: para qué sirve", hint: "Una wallet es tu cuenta para guardar y mover crypto." },
  { title: "Seed phrase: regla de oro", hint: "Si alguien te pide las 12/24 palabras, es estafa." },
  { title: "Stablecoin: qué es", hint: "Busca valer ~1 USD; no es “sin riesgo”." },
  { title: "Gas: comisiones", hint: "Es lo que pagás para que una transacción se confirme." },
  { title: "DEX vs CEX", hint: "DEX: sin custodia. CEX: una empresa custodia tu saldo." },
  { title: "DeFi en 1 minuto", hint: "Préstamos, swaps y rendimientos sin bancos." },
  { title: "APY y staking", hint: "Rendimiento estimado anual por bloquear o prestar crypto." },
  { title: "Rug pull: señal roja", hint: "Si desaparece la liquidez o el equipo, el token se desploma." },
  { title: "FOMO vs miedo", hint: "Emociones comunes al invertir; ayudate con un plan." },
  { title: "Checklist completa", hint: "Listo: ya podés explorar comunidades avanzadas." },
] as const;

export default function OnboardingChecklist({ initialStep }: { initialStep: number }) {
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const { user, profile, refreshProfile } = useAuth();

  const isBeginner = (profile?.preferred_mode ?? null) === "beginner";
  const [saving, setSaving] = React.useState(false);
  const step = Math.max(0, Math.min(10, profile?.onboarding_step ?? initialStep ?? 0));

  async function advance(toStep: number) {
    if (!user || saving) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ onboarding_step: toStep })
      .eq("id", user.id);
    setSaving(false);
    if (error?.message?.toLowerCase().includes("onboarding_step") && error.message.toLowerCase().includes("column")) {
      return;
    }
    if (!error) {
      await refreshProfile();
    }
  }

  if (!isBeginner) return null;

  const pct = Math.round((step / 10) * 100);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-zinc-900">Crypto en 10 conceptos</div>
        <div className="text-xs tabular-nums text-zinc-600">{pct}%</div>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-200">
        <div className="h-2 bg-emerald-500" style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-3 space-y-2">
        {ITEMS.map((item, idx) => {
          const n = idx + 1;
          const checked = step >= n;
          const isNext = step + 1 === n;

          return (
            <button
              key={item.title}
              type="button"
              onClick={() => {
                if (!user) return;
                if (checked) return;
                if (isNext) void advance(n);
              }}
              disabled={!user || saving}
              className={cn(
                "w-full rounded-md border px-3 py-2 text-left text-xs",
                checked
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : isNext
                    ? "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50"
                    : "border-zinc-200 bg-white text-zinc-500",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium">
                    {checked ? "✅" : "⬜"} {item.title}
                  </div>
                  <div className={cn("mt-1", checked ? "text-emerald-700" : "text-zinc-500")}>
                    {item.hint}
                  </div>
                </div>
                <div className="shrink-0 text-[10px] tabular-nums opacity-70">
                  {Math.min(n, 10)}/10
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
