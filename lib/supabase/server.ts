import {
  createRouteHandlerClient,
  createServerComponentClient,
} from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

import type { Database } from "./types";

export function createSupabaseServerClient() {
  return createServerComponentClient<Database>({ cookies });
}

export function createSupabaseRouteClient() {
  return createRouteHandlerClient<Database>({ cookies });
}

