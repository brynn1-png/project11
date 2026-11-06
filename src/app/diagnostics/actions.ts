"use server";

import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canViewDiagnostics } from "@/lib/diagnostics-core";
import { createClient } from "@/lib/supabase/server";

export type FailureRecord = {
  id: string;
  occurredAt: string;
  source: "server_action" | "next_server";
  operation: string;
  reason: string;
  errorCode: string | null;
  stack: string | null;
  referenceId: string;
};

type FailureRow = {
  id: string; occurred_at: string; source: FailureRecord["source"]; operation: string;
  reason: string; error_code: string | null; stack: string | null; reference_id: string;
};

export async function loadFailures(offset = 0, search = ""): Promise<
  { ok: true; records: FailureRecord[]; hasMore: boolean } | { ok: false; message: string }
> {
  const user = await getCurrentUser();
  if (!canViewDiagnostics(user)) return { ok: false, message: "Access denied." };
  const parsed = z.object({ offset: z.number().int().min(0).max(100_000), search: z.string().trim().max(80) }).safeParse({ offset, search });
  if (!parsed.success) return { ok: false, message: "Invalid search or page." };
  const supabase = await createClient();
  let query = supabase.from("failure_logs")
    .select("id, occurred_at, source, operation, reason, error_code, stack, reference_id")
    .order("occurred_at", { ascending: false }).order("id", { ascending: false })
    .range(parsed.data.offset, parsed.data.offset + 25);
  if (parsed.data.search) query = query.ilike("operation", `%${parsed.data.search.replace(/[%,()]/g, "")}%`);
  const { data, error } = await query;
  if (error) return { ok: false, message: "Diagnostics could not be loaded. Apply the latest migration and try again." };
  const rows = (data ?? []) as FailureRow[];
  return { ok: true, hasMore: rows.length > 25, records: rows.slice(0, 25).map((row) => ({
    id: row.id, occurredAt: row.occurred_at, source: row.source, operation: row.operation,
    reason: row.reason, errorCode: row.error_code, stack: row.stack, referenceId: row.reference_id,
  })) };
}
