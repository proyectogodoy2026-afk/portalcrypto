"use client";

import * as React from "react";
import { z } from "zod";

import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const profileSchema = z.object({
  username: z
    .string()
    .min(3, "El username debe tener al menos 3 caracteres")
    .max(24, "El username no puede superar 24 caracteres")
    .regex(/^[a-zA-Z0-9_]+$/, "Solo letras, números y _")
    .or(z.literal("")),
  display_name: z.string().max(50, "El display name es muy largo").optional(),
  avatar_url: z.string().url("Ingresá una URL válida").or(z.literal("")),
});

export default function ProfileForm() {
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const { user, profile, refreshProfile, loading } = useAuth();

  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    if (!user) {
      setError("Necesitás iniciar sesión.");
      return;
    }

    const fd = new FormData(e.currentTarget as HTMLFormElement);
    const parsed = profileSchema.safeParse({
      username: String(fd.get("username") ?? "").trim(),
      display_name: String(fd.get("display_name") ?? "").trim() || undefined,
      avatar_url: String(fd.get("avatar_url") ?? "").trim(),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }

    setSaving(true);
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        username: parsed.data.username ? parsed.data.username : null,
        display_name: parsed.data.display_name?.trim()
          ? parsed.data.display_name.trim()
          : null,
        avatar_url: parsed.data.avatar_url ? parsed.data.avatar_url : null,
      })
      .eq("id", user.id);
    setSaving(false);

    if (updateError) {
      setError("No pudimos guardar tu perfil. Intentá de nuevo.");
      return;
    }

    await refreshProfile();
    setSaved(true);
  }

  if (loading) {
    return (
      <div className="w-full max-w-xl rounded-lg border border-zinc-200 bg-white p-6">
        <div className="h-6 w-40 animate-pulse rounded bg-zinc-200" />
        <div className="mt-2 h-4 w-64 animate-pulse rounded bg-zinc-200" />
        <div className="mt-6 space-y-4">
          <div className="h-10 animate-pulse rounded bg-zinc-200" />
          <div className="h-10 animate-pulse rounded bg-zinc-200" />
          <div className="h-10 animate-pulse rounded bg-zinc-200" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="w-full max-w-xl rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-700">
        Necesitás iniciar sesión.
      </div>
    );
  }

  return (
    <form
      onSubmit={onSave}
      className="w-full max-w-xl rounded-lg border border-zinc-200 bg-white p-6"
      key={profile?.id ?? user.id}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-zinc-900">Perfil</h1>
        {profile?.preferred_mode === "beginner" && (profile?.onboarding_step ?? 0) >= 10 ? (
          <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
            Principiante verificado
          </div>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-zinc-600">
        Actualizá tu información pública.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
          <div className="text-xs font-medium text-zinc-500">Karma técnico</div>
          <div className="mt-1 text-lg font-semibold text-zinc-900 tabular-nums">
            {profile?.karma_technical ?? 0}
          </div>
        </div>
        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
          <div className="text-xs font-medium text-zinc-500">Karma predicciones</div>
          <div className="mt-1 text-lg font-semibold text-zinc-900 tabular-nums">
            {profile?.karma_predictions ?? 0}
          </div>
          <div className="mt-1 text-xs text-zinc-600">
            {Math.min(profile?.predictions_correct ?? 0, 10)}/10 predicciones correctas
          </div>
        </div>
        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
          <div className="text-xs font-medium text-zinc-500">Karma reportes</div>
          <div className="mt-1 text-lg font-semibold text-zinc-900 tabular-nums">
            {profile?.karma_scam_reports ?? 0}
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            name="username"
            defaultValue={profile?.username ?? ""}
            placeholder="satoshi_123"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="displayName">Nombre visible</Label>
          <Input
            id="displayName"
            name="display_name"
            defaultValue={profile?.display_name ?? ""}
            placeholder="Satoshi"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="avatarUrl">Avatar URL</Label>
          <Input
            id="avatarUrl"
            name="avatar_url"
            defaultValue={profile?.avatar_url ?? ""}
            placeholder="https://..."
          />
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {saved ? (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Perfil guardado.
        </div>
      ) : null}

      <div className="mt-6">
        <Button type="submit" disabled={saving}>
          {saving ? "Guardando..." : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
