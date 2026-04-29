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
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <Header />
            <main className="flex-1 p-6">{children}</main>
          </div>
        </div>
      </div>
    </AuthProvider>
  );
}
