"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";

import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const onboardingSchema = z.object({
  level: z.string().min(1, "Seleccioná un nivel"),
  preferred_mode: z.enum(["beginner", "advanced"] as const, {
    message: "Seleccioná un modo",
  }),
});

const LEVELS = ["Principiante", "Intermedio", "Avanzado"] as const;
const MODES = [
  { value: "beginner", label: "Principiante" },
  { value: "advanced", label: "Avanzado" },
] as const;

export default function OnboardingFlow() {
  const router = useRouter();
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const { user, profile, refreshProfile } = useAuth();

  const [step, setStep] = React.useState(1);
  const [level, setLevel] = React.useState(profile?.level ?? "");
  const [preferredMode, setPreferredMode] = React.useState(
    profile?.preferred_mode === "advanced" || profile?.preferred_mode === "beginner"
      ? profile.preferred_mode
      : "",
  );
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const completed = profile?.onboarding_completed ?? false;

  async function onSave() {
    setError(null);
    if (!user) {
      setError("Necesitás iniciar sesión para completar el onboarding.");
      return;
    }

    const parsed = onboardingSchema.safeParse({ level, preferred_mode: preferredMode });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }

    setSaving(true);
    const baseUpdate = {
      level: parsed.data.level,
      preferred_mode: parsed.data.preferred_mode,
      onboarding_completed: true,
    };

    const first = await supabase
      .from("profiles")
      .update({
        ...baseUpdate,
        onboarding_step: parsed.data.preferred_mode === "beginner" ? 0 : null,
      })
      .eq("id", user.id);

    const updateError =
      first.error?.message?.toLowerCase().includes("onboarding_step") &&
      first.error.message.toLowerCase().includes("column")
        ? (await supabase.from("profiles").update(baseUpdate).eq("id", user.id)).error
        : first.error;
    setSaving(false);

    if (updateError) {
      setError("No pudimos guardar tu onboarding. Intentá de nuevo.");
      return;
    }

    await refreshProfile();
    router.push("/");
    router.refresh();
  }

  if (completed) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-zinc-900">Onboarding</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Ya completaste el onboarding.
        </p>
        <Button className="mt-4" onClick={() => router.push("/")}>
          Ir al feed
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl rounded-lg border border-zinc-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900">Onboarding</h1>
        <div className="text-sm text-zinc-600">Paso {step} de 3</div>
      </div>

      <div className="mt-6">
        {step === 1 ? (
          <div className="space-y-3">
            <div className="text-sm font-medium text-zinc-900">Tu nivel</div>
            <div className="grid gap-2 sm:grid-cols-3">
              {LEVELS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setLevel(value)}
                  className={[
                    "rounded-md border px-3 py-2 text-sm",
                    level === value
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50",
                  ].join(" ")}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3">
            <div className="text-sm font-medium text-zinc-900">
              Modo de uso
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setPreferredMode(m.value)}
                  className={[
                    "rounded-md border px-3 py-2 text-left text-sm",
                    preferredMode === m.value
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50",
                  ].join(" ")}
                >
                  <div className="font-medium">{m.label}</div>
                  <div className="mt-1 text-xs opacity-90">
                    {m.value === "beginner"
                      ? "Editor simplificado, plantillas y menos opciones técnicas."
                      : "Editor completo: tags, anclaje a token y markdown."}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-2">
            <div className="text-sm font-medium text-zinc-900">Confirmación</div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-800">
              <div>
                <span className="font-medium">Nivel:</span> {level || "—"}
              </div>
              <div className="mt-1">
                <span className="font-medium">Modo:</span>{" "}
                {preferredMode
                  ? MODES.find((m) => m.value === preferredMode)?.label ?? preferredMode
                  : "—"}
              </div>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
          >
            Atrás
          </Button>

          {step < 3 ? (
            <Button type="button" onClick={() => setStep((s) => Math.min(3, s + 1))}>
              Siguiente
            </Button>
          ) : (
            <Button type="button" onClick={onSave} disabled={saving}>
              {saving ? "Guardando..." : "Finalizar"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
