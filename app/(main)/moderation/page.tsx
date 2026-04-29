import { redirect } from "next/navigation";

import ModerationQueue from "@/components/scam/ModerationQueue";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ModerationPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/auth/login");
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("onboarding_completed,is_moderator")
    .eq("id", session.user.id)
    .maybeSingle();
  const profile = profileData as unknown as {
    onboarding_completed: boolean | null;
    is_moderator: boolean | null;
  } | null;

  if (!(profile?.onboarding_completed ?? false)) {
    redirect("/onboarding");
  }

  if (!(profile?.is_moderator ?? false)) {
    redirect("/");
  }

  return <ModerationQueue />;
}
