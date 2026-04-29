import { redirect } from "next/navigation";

import OnboardingFlow from "@/components/onboarding/OnboardingFlow";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/auth/login");
  }

  return <OnboardingFlow />;
}
