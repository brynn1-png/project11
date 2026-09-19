"use server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

export type ReceiptHistoryItem = {
  productName: string;
  barcode: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type ReceiptHistoryEntry = {
  saleNumber: string;
  soldAt: string;
  cashierName: string;
  totalAmount: number;
  status: "completed" | "voided";
  itemCount: number;
  returnedQuantity: number;
  notes?: string;
  items: ReceiptHistoryItem[];
};

export type ReturnHistoryEntry = {
  returnNumber: string;
  saleNumber: string;
  status: "pending_review" | "approved" | "rejected";
  reason: string;
  notes?: string;
  requestedBy: string;
  requestedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  itemCount: number;
  items: Array<{ productName: string; quantity: number; disposition: "restock" | "damaged" | "expired" }>;
};

type ReceiptRow = {
  sale_number: number | string; sold_at: string; cashier_name: string; total_amount: number | string;
  status: ReceiptHistoryEntry["status"]; item_count: number | string; returned_quantity: number | string;
  notes: string | null; items: Array<{ product_name: string; barcode: string; quantity: number | string; unit_price: number | string; line_total: number | string }>;
};

type ReturnRow = {
  return_number: number | string; sale_number: number | string; status: ReturnHistoryEntry["status"];
  reason: string; notes: string | null; requested_by_name: string; requested_at: string;
  reviewed_by_name: string | null; reviewed_at: string | null; item_count: number | string;
  items: Array<{ product_name: string; quantity: number | string; disposition: "restock" | "damaged" | "expired" }>;
};

export async function loadTransactionHistory(): Promise<{ receipts: ReceiptHistoryEntry[]; returns: ReturnHistoryEntry[]; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { receipts: [], returns: [], error: "Sign in again to load transaction history." };

  const supabase = await createClient();
  const [receiptResult, returnResult] = await Promise.all([
    supabase.rpc("get_sales_receipt_history", { p_limit: 100 }),
    supabase.rpc("get_sales_return_history", { p_limit: 100 }),
  ]);
  if (receiptResult.error || returnResult.error) {
    console.error("Transaction history lookup failed", receiptResult.error ?? returnResult.error);
    return { receipts: [], returns: [], error: "Apply the latest database migration to load receipt and return history." };
  }

  return {
    receipts: ((receiptResult.data ?? []) as ReceiptRow[]).map((row) => ({
      saleNumber: String(row.sale_number), soldAt: row.sold_at, cashierName: row.cashier_name,
      totalAmount: Number(row.total_amount), status: row.status, itemCount: Number(row.item_count),
      returnedQuantity: Number(row.returned_quantity), notes: row.notes ?? undefined,
      items: row.items.map((item) => ({ productName: item.product_name, barcode: item.barcode, quantity: Number(item.quantity), unitPrice: Number(item.unit_price), lineTotal: Number(item.line_total) })),
    })),
    returns: ((returnResult.data ?? []) as ReturnRow[]).map((row) => ({
      returnNumber: String(row.return_number), saleNumber: String(row.sale_number), status: row.status,
      reason: row.reason, notes: row.notes ?? undefined, requestedBy: row.requested_by_name,
      requestedAt: row.requested_at, reviewedBy: row.reviewed_by_name ?? undefined,
      reviewedAt: row.reviewed_at ?? undefined, itemCount: Number(row.item_count),
      items: row.items.map((item) => ({ productName: item.product_name, quantity: Number(item.quantity), disposition: item.disposition })),
    })),
  };
}
