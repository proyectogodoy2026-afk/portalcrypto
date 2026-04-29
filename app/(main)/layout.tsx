import AuthProvider from "@/components/auth/AuthProvider";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";

export const dynamic = "force-dynamic";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-zinc-50">
        <Header />
        <div className="mx-auto flex w-full max-w-6xl gap-6 px-4 py-6">
          <Sidebar variant="left" />
          <main className="min-w-0 flex-1">
            <div className="mx-auto w-full max-w-3xl">{children}</div>
          </main>
          <Sidebar variant="right" />
        </div>
      </div>
    </AuthProvider>
  );
}
