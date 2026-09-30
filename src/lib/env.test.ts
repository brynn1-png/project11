import { describe, expect, it } from "vitest";
import { readSupabaseAdminConfig, readSupabasePublicConfig } from "@/lib/env";

describe("Supabase environment validation", () => {
  it("returns null when configuration is absent", () => {
    expect(readSupabasePublicConfig({})).toBeNull();
  });

  it("accepts a complete public configuration", () => {
    expect(readSupabasePublicConfig({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_1234567890",
    })).toEqual({
      url: "https://example.supabase.co",
      publishableKey: "sb_publishable_1234567890",
    });
  });

  it("rejects malformed configuration", () => {
    expect(readSupabasePublicConfig({
      NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "short",
    })).toBeNull();
  });
});

describe("Supabase admin environment validation", () => {
  it("returns null when the service role key is absent", () => {
    expect(readSupabaseAdminConfig({ NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" })).toBeNull();
  });

  it("never treats the public publishable key as an admin key", () => {
    expect(readSupabaseAdminConfig({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_1234567890",
    })).toBeNull();
  });

  it("accepts a complete admin configuration", () => {
    expect(readSupabaseAdminConfig({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "sb_secret_1234567890abcdef",
    })).toEqual({
      url: "https://example.supabase.co",
      serviceRoleKey: "sb_secret_1234567890abcdef",
    });
  });

  it("rejects an incomplete admin key", () => {
    expect(readSupabaseAdminConfig({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "short",
    })).toBeNull();
  });
});

