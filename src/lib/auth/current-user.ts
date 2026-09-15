import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { AppRole } from "@/lib/auth/permissions";

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
};

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role, status")
    .eq("id", userId)
    .single();

  if (profileError || !profile || profile.status !== "active") return null;

  return {
    id: profile.id,
    email: typeof claimsData.claims.email === "string" ? claimsData.claims.email : "",
    fullName: profile.full_name,
    role: profile.role as AppRole,
  };
});

