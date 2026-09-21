"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { consumeRateLimit, loginRateLimitIdentifiers, rateLimitMessage } from "@/lib/security/rate-limit";
import { loginSchema } from "@/lib/validation/auth";

export type LoginState = {
  message?: string;
  errors?: { email?: string[]; password?: string[] };
};

export async function login(_state: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  if (!isSupabaseConfigured()) {
    return { message: "Supabase is not configured yet. Add the project values to .env.local." };
  }

  const identifiers = await loginRateLimitIdentifiers(parsed.data.email);
  const accountLimit = await consumeRateLimit("login", identifiers.accountAndAddress);
  if (!accountLimit.allowed) return { message: rateLimitMessage(accountLimit) };
  const addressLimit = await consumeRateLimit("login_ip", identifiers.address);
  if (!addressLimit.allowed) return { message: rateLimitMessage(addressLimit) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { message: "Sign-in failed. Check your email and password, then try again." };
  }

  redirect("/");
}

export async function logout() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
