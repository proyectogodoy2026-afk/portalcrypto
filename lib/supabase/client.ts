import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

import type { Database } from "./types";

export function createSupabaseBrowserClient() {
  return createClientComponentClient<Database>();
}

