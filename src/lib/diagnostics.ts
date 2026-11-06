import "server-only";

import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/env";
import { safeFailureText } from "@/lib/diagnostics-core";

type FailureSource = "server_action" | "next_server";

export async function logFailure(input: {
  source: FailureSource;
  operation: string;
  error: unknown;
  actorId?: string;
}): Promise<string> {
  const referenceId = randomUUID();
  const occurredAt = new Date().toISOString();
  const error = input.error;
  const reason = safeFailureText(error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String(error.message) : String(error), 2000) || "Unknown failure";
  const code = typeof error === "object" && error
    ? "code" in error ? safeFailureText(String(error.code), 80) : "digest" in error ? safeFailureText(String(error.digest), 80) : null
    : null;
  const stack = error instanceof Error && error.stack ? safeFailureText(error.stack, 4000) : null;
  const event = {
    reference_id: referenceId,
    occurred_at: occurredAt,
    source: input.source,
    operation: safeFailureText(input.operation, 160),
    reason,
    error_code: code,
    stack,
    actor_id: input.actorId ?? null,
  };

  if (isSupabaseAdminConfigured()) {
    try {
      const { error: writeError } = await createAdminClient().from("failure_logs").insert(event);
      if (!writeError) return referenceId;
      console.error("Diagnostic storage failed", { referenceId, reason: safeFailureText(writeError.message, 200) });
    } catch (writeError) {
      console.error("Diagnostic storage failed", { referenceId, reason: safeFailureText(String(writeError), 200) });
    }
  }
  console.error("Application failure", { referenceId, occurredAt, source: event.source, operation: event.operation, reason: event.reason, code: event.error_code });
  return referenceId;
}
