import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/lib/supabase/types";

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Faltan variables de entorno de Supabase (URL/ANON_KEY)");
  }
  return { url, anonKey };
}

function isPublicPath(pathname: string) {
  if (pathname.startsWith("/auth")) return true;
  if (pathname.startsWith("/api")) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname === "/scam-radar") return true;
  return false;
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const { url, anonKey } = getSupabaseEnv();
  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const c of cookiesToSet) {
          res.cookies.set({ name: c.name, value: c.value, ...c.options });
        }
      },
    },
  });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const pathname = req.nextUrl.pathname;
  if (!session && !isPublicPath(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"],
};
