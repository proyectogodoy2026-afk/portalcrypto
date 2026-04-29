import { redirect } from "next/navigation";

import PostEditor from "@/components/post/PostEditor";
import type { CommunityOption } from "@/components/post/PostEditor";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewPostPage() {
  const supabase = createSupabaseServerClient();
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

  const { data: communities } = await supabase
    .from("communities")
    .select("id,name,slug,type,member_count")
    .order("member_count", { ascending: false, nullsFirst: false });

  return <PostEditor communities={(communities ?? []) as CommunityOption[]} />;
}
