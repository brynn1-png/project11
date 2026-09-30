import "server-only";

import { createClient } from "@supabase/supabase-js";
import { readSupabaseAdminConfig } from "@/lib/env";

export function createAdminClient() {
  const config = readSupabaseAdminConfig();

  if (!config) {
    throw new Error(
      "Supabase admin access is not configured. Add SUPABASE_SERVICE_ROLE_KEY to .env.local to manage staff accounts.",
    );
  }

  return createClient(config.url, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
