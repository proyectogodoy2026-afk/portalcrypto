"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const registerSchema = z.object({
  username: z
    .string()
    .min(3, "El username debe tener al menos 3 caracteres")
    .max(24, "El username no puede superar 24 caracteres")
    .regex(/^[a-zA-Z0-9_]+$/, "Solo letras, números y _"),
  email: z.string().email("Ingresá un email válido"),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres"),
});

export default function RegisterForm() {
  const router = useRouter();
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);

  const [username, setUsername] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const parsed = registerSchema.safeParse({ username, email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }

    setLoading(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: {
          username: parsed.data.username,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);

    if (signUpError) {
      const details =
        typeof (signUpError as unknown as { message?: unknown })?.message === "string"
          ? (signUpError as unknown as { message: string }).message
          : null;
      const status =
        typeof (signUpError as unknown as { status?: unknown })?.status === "number"
          ? (signUpError as unknown as { status: number }).status
          : null;
      setError(
        status
          ? `No pudimos crear tu cuenta (error ${status}). ${details ?? ""}`.trim()
          : `No pudimos crear tu cuenta. ${details ?? ""}`.trim(),
      );
      return;
    }

    if (data.session) {
      router.push("/onboarding");
      router.refresh();
      return;
    }

    setMessage(
      "Listo. Te enviamos un email para confirmar tu cuenta antes de ingresar.",
    );
  }

  return (
    <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6">
      <h1 className="text-xl font-semibold text-zinc-900">Crear cuenta</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Registrate para empezar a usar PortalCrypto.
      </p>

      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="satoshi_123"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="********"
          />
        </div>

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {message ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {message}
          </div>
        ) : null}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Creando..." : "Crear cuenta"}
        </Button>
      </form>

      <p className="mt-4 text-sm text-zinc-600">
        ¿Ya tenés cuenta?{" "}
        <Link className="font-medium text-zinc-900 underline" href="/auth/login">
          Iniciá sesión
        </Link>
      </p>
    </div>
  );
}
