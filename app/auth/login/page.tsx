import Link from "next/link";
import { redirect } from "next/navigation";

import LoginForm from "@/components/auth/LoginForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    redirect("/");
  }

  return (
    <div className="w-full max-w-md">
      <LoginForm />
      <p className="mt-4 text-center text-sm text-zinc-600">
        ¿No tenés cuenta?{" "}
        <Link className="font-medium text-zinc-900 underline" href="/auth/register">
          Registrate
        </Link>
      </p>
    </div>
  );
}
