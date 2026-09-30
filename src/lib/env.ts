import { z } from "zod";

const publicSupabaseEnvSchema = z.object({
  url: z.url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL."),
  publishableKey: z.string().min(20, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is incomplete."),
});

export type SupabasePublicConfig = z.infer<typeof publicSupabaseEnvSchema>;

export function readSupabasePublicConfig(
  source: Record<string, string | undefined> = process.env,
): SupabasePublicConfig | null {
  const url = source.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) return null;

  const parsed = publicSupabaseEnvSchema.safeParse({ url, publishableKey });
  return parsed.success ? parsed.data : null;
}

export function getSupabasePublicConfig(): SupabasePublicConfig {
  const config = readSupabasePublicConfig();
  if (!config) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env.local and add the project URL and publishable key.",
    );
  }
  return config;
}

export function isSupabaseConfigured() {
  return readSupabasePublicConfig() !== null;
}

const supabaseAdminEnvSchema = z.object({
  url: z.url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL."),
  serviceRoleKey: z.string().min(20, "SUPABASE_SERVICE_ROLE_KEY is incomplete."),
});

export type SupabaseAdminConfig = z.infer<typeof supabaseAdminEnvSchema>;

export function readSupabaseAdminConfig(
  source: Record<string, string | undefined> = process.env,
): SupabaseAdminConfig | null {
  const url = source.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = source.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) return null;

  const parsed = supabaseAdminEnvSchema.safeParse({ url, serviceRoleKey });
  return parsed.success ? parsed.data : null;
}

export function isSupabaseAdminConfigured() {
  return readSupabaseAdminConfig() !== null;
}

