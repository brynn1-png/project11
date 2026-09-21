import "server-only";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { buildLoginRateLimitIdentifier, readClientAddress } from "@/lib/security/rate-limit-key";

export type RateLimitScope =
  | "login"
  | "login_ip"
  | "reports_read"
  | "history_read"
  | "sales_read"
  | "inventory_read";

type RateLimitRow = {
  allowed: boolean;
  remaining: number | string;
  retry_after_seconds: number | string;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  unavailable?: boolean;
};

export async function consumeRateLimit(scope: RateLimitScope, identifier?: string): Promise<RateLimitResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("consume_endpoint_rate_limit", {
    p_scope: scope,
    p_identifier: identifier ?? null,
  });

  if (error) {
    console.error("Rate-limit verification failed", { scope, code: error.code, message: error.message });
    return { allowed: false, remaining: 0, retryAfterSeconds: 0, unavailable: true };
  }

  const row = (Array.isArray(data) ? data[0] : data) as RateLimitRow | null;
  if (!row) return { allowed: false, remaining: 0, retryAfterSeconds: 0, unavailable: true };
  return {
    allowed: row.allowed,
    remaining: Number(row.remaining),
    retryAfterSeconds: Number(row.retry_after_seconds),
  };
}

function hashIdentifier(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function loginRateLimitIdentifiers(email: string) {
  const requestHeaders = await headers();
  const address = readClientAddress(requestHeaders);
  return {
    accountAndAddress: hashIdentifier(buildLoginRateLimitIdentifier(email, address)),
    address: hashIdentifier(address),
  };
}

export function rateLimitMessage(result: RateLimitResult) {
  if (result.unavailable) return "Security verification is temporarily unavailable. Apply the latest database migration or try again shortly.";
  const seconds = Math.max(1, result.retryAfterSeconds);
  if (seconds >= 60) {
    const minutes = Math.ceil(seconds / 60);
    return `Too many requests. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`;
  }
  return `Too many requests. Try again in ${seconds} seconds.`;
}

export function databaseRateLimitMessage(error: { message: string }) {
  const match = /RATE_LIMITED:(\d+)/.exec(error.message);
  if (!match) return null;
  return rateLimitMessage({ allowed: false, remaining: 0, retryAfterSeconds: Number(match[1]) });
}
