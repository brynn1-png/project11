"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { logFailure } from "@/lib/diagnostics";
import { hasPermission } from "@/lib/auth/permissions";
import { consumeRateLimit, databaseRateLimitMessage, rateLimitMessage } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { issueResolutionSchema, productIssueInputSchema, type IssueResolutionInput, type ProductIssueInput } from "@/lib/validation/product-issues";

export type IssueBatch = { id: string; batchNumber: string; quantityRemaining: number; expiresAt: string | null };
export type ProductIssueReport = {
  id: string; productId: string; productCode: string; productName: string;
  quantity: number; flagKind: "damage" | "issue" | "custom"; customFlag: string | null;
  description: string; status: "pending" | "confirmed" | "released";
  reporterName: string; reportedAt: string; resolverName: string | null;
  resolvedAt: string | null; resolutionNote: string | null;
  batches: Array<{ batchNumber: string; quantity: number }>;
};

type IssueBatchRow = { id: string; batch_number: string; quantity_remaining: number | string; expires_at: string | null };
type ProductIssueRow = {
  id: string; product_id: string; product_code: string; product_name: string;
  quantity: number | string; flag_kind: ProductIssueReport["flagKind"]; custom_flag: string | null;
  description: string; status: ProductIssueReport["status"];
  reporter_name: string; reported_at: string; resolver_name: string | null;
  resolved_at: string | null; resolution_note: string | null;
  batches: Array<{ batch_number: string; quantity: number | string }>;
};

function issueError(error: { message: string }, fallback: string) {
  const limited = databaseRateLimitMessage(error);
  if (limited) return limited;
  if (error.message.includes("schema cache") || error.message.includes("submit_product_issue") || error.message.includes("resolve_product_issue")) {
    return "Apply the latest database migration to use Product Issues.";
  }
  if (/Insufficient batch stock|selected batch does not belong|Active product not found|no longer pending|cannot be returned|Archived products cannot|Manager access/.test(error.message)) {
    return error.message;
  }
  return fallback;
}

export async function loadIssueBatches(productId: string): Promise<{ ok: true; batches: IssueBatch[] } | { ok: false; message: string }> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "issues:report")) return { ok: false, message: "Issue-report access is required." };
  const parsed = z.uuid().safeParse(productId);
  if (!parsed.success) return { ok: false, message: "Product identifier is invalid." };
  const limit = await consumeRateLimit("inventory_read");
  if (!limit.allowed) return { ok: false, message: rateLimitMessage(limit) };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_product_issue_batches", { p_product_id: parsed.data });
  if (error) { await logFailure({ source: "server_action", operation: "loadIssueBatches", error, actorId: user.id }); return { ok: false, message: issueError(error, "Batch details could not be loaded.") }; }
  return { ok: true, batches: ((data ?? []) as IssueBatchRow[]).map((row) => ({
    id: row.id, batchNumber: row.batch_number, quantityRemaining: Number(row.quantity_remaining), expiresAt: row.expires_at,
  })) };
}

export async function loadProductIssues(offset = 0): Promise<{ ok: true; reports: ProductIssueReport[]; hasMore: boolean } | { ok: false; message: string }> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "issues:report")) return { ok: false, message: "Issue-report access is required." };
  const parsedOffset = z.number().int().min(0).max(100_000).safeParse(offset);
  if (!parsedOffset.success) return { ok: false, message: "Report page is invalid." };
  const limit = await consumeRateLimit("history_read");
  if (!limit.allowed) return { ok: false, message: rateLimitMessage(limit) };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_product_issue_reports", { p_limit: 51, p_offset: parsedOffset.data });
  if (error) { await logFailure({ source: "server_action", operation: "loadProductIssues", error, actorId: user.id }); return { ok: false, message: issueError(error, "Product issue reports could not be loaded.") }; }
  const rows = (data ?? []) as ProductIssueRow[];
  return { ok: true, hasMore: rows.length > 50, reports: rows.slice(0, 50).map((row) => ({
    id: row.id, productId: row.product_id, productCode: row.product_code, productName: row.product_name,
    quantity: Number(row.quantity), flagKind: row.flag_kind, customFlag: row.custom_flag,
    description: row.description, status: row.status, reporterName: row.reporter_name,
    reportedAt: row.reported_at, resolverName: row.resolver_name, resolvedAt: row.resolved_at,
    resolutionNote: row.resolution_note,
    batches: (row.batches ?? []).map((batch) => ({ batchNumber: batch.batch_number, quantity: Number(batch.quantity) })),
  })) };
}

export async function submitProductIssue(input: ProductIssueInput): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "issues:report")) return { ok: false, message: "Issue-report access is required." };
  const parsed = productIssueInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Review the product issue form." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_product_issue", {
    p_product_id: parsed.data.productId,
    p_batch_id: parsed.data.batchId ?? null,
    p_quantity: parsed.data.quantity,
    p_flag_kind: parsed.data.flagKind,
    p_custom_flag: parsed.data.customFlag,
    p_description: parsed.data.description,
  });
  if (error) { await logFailure({ source: "server_action", operation: "submitProductIssue", error, actorId: user.id }); return { ok: false, message: issueError(error, "The issue report could not be submitted. Stock was not changed.") }; }
  revalidatePath("/");
  return { ok: true, id: String(data) };
}

export async function resolveProductIssue(input: IssueResolutionInput): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "issues:resolve")) return { ok: false, message: "Manager access is required." };
  const parsed = issueResolutionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Review the resolution." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_product_issue", {
    p_issue_id: parsed.data.issueId, p_decision: parsed.data.decision, p_note: parsed.data.note,
  });
  if (error) { await logFailure({ source: "server_action", operation: "resolveProductIssue", error, actorId: user.id }); return { ok: false, message: issueError(error, "The issue report could not be resolved. Stock was not changed.") }; }
  revalidatePath("/");
  return { ok: true };
}
