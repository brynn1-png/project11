import { describe, expect, it } from "vitest";
import { readSupabasePublicConfig } from "@/lib/env";

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

