import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseRouteClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(new URL(`/auth/login?next=${encodeURIComponent(next)}`, req.url));
  }

  const supabase = createSupabaseRouteClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session?.user) {
    return NextResponse.redirect(new URL("/auth/login", req.url));
  }

  const userId = data.session.user.id;
  const { data: rawProfile } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", userId)
    .maybeSingle();
  const profile =
    rawProfile as unknown as { onboarding_completed: boolean | null } | null;

  const onboardingCompleted = profile?.onboarding_completed ?? false;
  const target = onboardingCompleted ? next : "/onboarding";

  return NextResponse.redirect(new URL(target, req.url));
}
