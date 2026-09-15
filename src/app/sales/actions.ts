"use server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { recordSaleSchema, type RecordSaleInput } from "@/lib/validation/sales";
import { z } from "zod";

export type RecordSaleResult =
  | { ok: true; saleNumber: string; totalAmount: number }
  | { ok: false; message: string };

export async function recordSale(input: RecordSaleInput): Promise<RecordSaleResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "sales:record")) {
    return { ok: false, message: "Your account is not allowed to record sales." };
  }

  const parsed = recordSaleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Review the sale and try again." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_sale", {
    p_idempotency_key: parsed.data.idempotencyKey,
    p_items: parsed.data.items.map((item) => ({ product_id: item.productId, quantity: item.quantity })),
    p_notes: parsed.data.notes || null,
  });

  if (error) {
    console.error("Sale confirmation failed", error);
    if (error.message.includes("Insufficient sellable stock")) return { ok: false, message: error.message };
    if (error.message.includes("business day is not open")) return { ok: false, message: "Today’s sales have already been submitted for review." };
    return { ok: false, message: "The sale could not be confirmed. Inventory was not changed. Refresh and try again." };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { ok: false, message: "The database did not return a sale confirmation." };

  return { ok: true, saleNumber: String(row.sale_number), totalAmount: Number(row.total_amount) };
}

export type ReturnableSaleItem = {
  saleItemId: string;
  productName: string;
  barcode: string;
  quantitySold: number;
  quantityReturned: number;
  unitPrice: number;
  soldAt: string;
};

type ReturnableSaleRow = { sale_item_id: string; product_name: string; barcode: string; quantity_sold: number | string; quantity_returned: number | string; unit_price: number | string; sold_at: string };
type BusinessDayRow = { id: string; business_date: string; status: BusinessDaySummary["status"]; sale_count: number | string; item_count: number | string; gross_total: number | string; return_count: number | string };
type PendingReturnRow = { id: string; business_day_id: string; return_number: number | string; sale_number: number | string; reason: string; requested_by_name: string; requested_at: string; item_count: number | string; items: Array<{ product_name: string; quantity: number | string; disposition: "restock" | "damaged" | "expired" }> };

export async function findSaleForReturn(saleNumber: number): Promise<{ ok: true; items: ReturnableSaleItem[] } | { ok: false; message: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sign in again before processing a return." };
  if (!Number.isSafeInteger(saleNumber) || saleNumber < 1) return { ok: false, message: "Enter a valid sale number." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_sale_for_return", { p_sale_number: saleNumber });
  if (error || !data?.length) return { ok: false, message: "No completed sale was found with that number." };
  return { ok: true, items: (data as ReturnableSaleRow[]).map((row) => ({
    saleItemId: row.sale_item_id,
    productName: row.product_name,
    barcode: row.barcode,
    quantitySold: Number(row.quantity_sold),
    quantityReturned: Number(row.quantity_returned),
    unitPrice: Number(row.unit_price),
    soldAt: row.sold_at,
  })) };
}

const returnRequestSchema = z.object({
  saleNumber: z.number().int().positive(),
  reason: z.string().trim().min(2, "Enter a return reason.").max(160),
  notes: z.string().trim().max(500).optional(),
  items: z.array(z.object({
    saleItemId: z.uuid(),
    quantity: z.number().int().positive(),
    disposition: z.enum(["restock", "damaged", "expired"]),
  })).min(1, "Select at least one returned item."),
});

export async function requestSaleReturn(input: z.infer<typeof returnRequestSchema>): Promise<{ ok: true; returnNumber: string } | { ok: false; message: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sign in again before processing a return." };
  const parsed = returnRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Review the return request." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_sale_return", {
    p_sale_number: parsed.data.saleNumber,
    p_items: parsed.data.items.map((item) => ({ sale_item_id: item.saleItemId, quantity: item.quantity, disposition: item.disposition })),
    p_reason: parsed.data.reason,
    p_notes: parsed.data.notes || null,
  });
  if (error) {
    console.error("Return request failed", error);
    return { ok: false, message: error.message.includes("exceeds") ? error.message : "The return request could not be recorded." };
  }
  return { ok: true, returnNumber: String(data) };
}

export type BusinessDaySummary = { id: string; businessDate: string; status: "open" | "pending_review" | "verified"; saleCount: number; itemCount: number; grossTotal: number; returnCount: number };
export type PendingReturnSummary = { id: string; businessDayId: string; returnNumber: string; saleNumber: string; reason: string; requestedBy: string; requestedAt: string; itemCount: number; items: Array<{ productName: string; quantity: number; disposition: "restock" | "damaged" | "expired" }> };

export async function loadSalesVerification(): Promise<{ days: BusinessDaySummary[]; returns: PendingReturnSummary[]; error?: string }> {
  const user = await getCurrentUser();
  if (!user || !["administrator", "manager"].includes(user.role)) return { days: [], returns: [], error: "Manager access is required." };
  const supabase = await createClient();
  const [daysResult, returnsResult] = await Promise.all([
    supabase.rpc("get_business_day_summaries", { p_limit: 14 }),
    supabase.rpc("get_pending_return_summaries"),
  ]);
  if (daysResult.error || returnsResult.error) return { days: [], returns: [], error: "Sales verification data could not be loaded." };
  return {
    days: ((daysResult.data ?? []) as BusinessDayRow[]).map((row) => ({ id: row.id, businessDate: row.business_date, status: row.status, saleCount: Number(row.sale_count), itemCount: Number(row.item_count), grossTotal: Number(row.gross_total), returnCount: Number(row.return_count) })),
    returns: ((returnsResult.data ?? []) as PendingReturnRow[]).map((row) => ({ id: row.id, businessDayId: row.business_day_id, returnNumber: String(row.return_number), saleNumber: String(row.sale_number), reason: row.reason, requestedBy: row.requested_by_name, requestedAt: row.requested_at, itemCount: Number(row.item_count), items: row.items.map((item) => ({ productName: item.product_name, quantity: Number(item.quantity), disposition: item.disposition })) })),
  };
}

export async function changeBusinessDayStatus(id: string, action: "submit" | "verify") {
  const user = await getCurrentUser();
  if (!user || !["administrator", "manager"].includes(user.role)) return { ok: false, message: "Manager access is required." };
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { ok: false, message: "Business day identifier is invalid." };
  const supabase = await createClient();
  const { error } = await supabase.rpc(action === "submit" ? "submit_business_day" : "verify_business_day", { p_business_day_id: parsed.data });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: action === "submit" ? "Business day submitted for review." : "Business day verified." };
}

export async function reviewSaleReturn(id: string, approve: boolean) {
  const user = await getCurrentUser();
  if (!user || !["administrator", "manager"].includes(user.role)) return { ok: false, message: "Manager access is required." };
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { ok: false, message: "Return identifier is invalid." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_sale_return", { p_return_id: parsed.data, p_approve: approve });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: approve ? "Return approved and eligible stock restored." : "Return rejected." };
}
