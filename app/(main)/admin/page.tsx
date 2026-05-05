import { redirect } from "next/navigation";

import AdminDashboard from "@/components/admin/AdminDashboard";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SUPER_ADMIN_EMAIL = "s.godoy.rubio@gmail.com";

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/auth/login?next=/admin");
  }

  const email = (session.user.email ?? "").toLowerCase();
  const isSuper = email === SUPER_ADMIN_EMAIL;

  if (!isSuper) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", session.user.id)
      .maybeSingle();

    const isAdmin =
      (profile as unknown as { is_admin?: boolean | null } | null)?.is_admin ?? false;

    if (!isAdmin) {
      redirect("/");
    }
  }

  return <AdminDashboard superEmail={SUPER_ADMIN_EMAIL} />;
}
