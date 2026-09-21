"use server";

import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { consumeRateLimit, rateLimitMessage } from "@/lib/security/rate-limit";

const dateRangeSchema = z.object({
  startDate: z.iso.date("Start date is invalid."),
  endDate: z.iso.date("End date is invalid."),
}).superRefine((value, context) => {
  if (value.startDate > value.endDate) {
    context.addIssue({ code: "custom", path: ["endDate"], message: "End date must be on or after the start date." });
    return;
  }
  const days = (Date.parse(`${value.endDate}T00:00:00Z`) - Date.parse(`${value.startDate}T00:00:00Z`)) / 86_400_000;
  if (days > 30) context.addIssue({ code: "custom", path: ["endDate"], message: "Choose a range of 31 days or fewer." });
});

export type SalesReportRow = {
  saleNumber: string;
  soldAt: string;
  cashierName: string;
  productCode: string;
  productName: string;
  barcode: string;
  categoryName: string;
  quantity: number;
  returnedQuantity: number;
  unitPrice: number;
  lineTotal: number;
  saleTotal: number;
  cashReceived: number;
  changeDue: number;
  status: "completed" | "voided";
};

type SalesReportDatabaseRow = {
  sale_number: number | string;
  sold_at: string;
  cashier_name: string;
  product_code: string;
  product_name: string;
  barcode: string;
  category_name: string;
  quantity: number | string;
  returned_quantity: number | string;
  unit_price: number | string;
  line_total: number | string;
  sale_total: number | string;
  cash_received: number | string | null;
  change_due: number | string | null;
  sale_status: "completed" | "voided";
};

export async function loadSalesReport(input: { startDate: string; endDate: string }) {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "reports:view_sales_own")) return { ok: false as const, message: "Your account is not allowed to view sales reports." };
  const parsed = dateRangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, message: parsed.error.issues[0]?.message ?? "Review the report dates." };
  const limit = await consumeRateLimit("reports_read");
  if (!limit.allowed) return { ok: false as const, message: rateLimitMessage(limit) };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_sales_report", {
    p_start_date: parsed.data.startDate,
    p_end_date: parsed.data.endDate,
  });
  if (error) {
    console.error("Sales report lookup failed", error);
    return { ok: false as const, message: error.message.includes("schema cache") ? "Apply the latest database migration to use sales reports." : "Sales report data could not be loaded." };
  }

  return {
    ok: true as const,
    rows: ((data ?? []) as SalesReportDatabaseRow[]).map((row) => ({
      saleNumber: String(row.sale_number),
      soldAt: row.sold_at,
      cashierName: row.cashier_name,
      productCode: row.product_code,
      productName: row.product_name,
      barcode: row.barcode,
      categoryName: row.category_name,
      quantity: Number(row.quantity),
      returnedQuantity: Number(row.returned_quantity),
      unitPrice: Number(row.unit_price),
      lineTotal: Number(row.line_total),
      saleTotal: Number(row.sale_total),
      cashReceived: Number(row.cash_received),
      changeDue: Number(row.change_due),
      status: row.sale_status,
    })) satisfies SalesReportRow[],
  };
}

export type StockMovementReportRow = {
  id: string;
  reference: string;
  productCode: string;
  productName: string;
  barcode: string;
  type: string;
  quantityChange: number;
  actorName: string;
  occurredAt: string;
  notes?: string;
};

type StockMovementDatabaseRow = {
  movement_id: string;
  reference_number: string;
  product_code: string;
  product_name: string;
  barcode: string;
  movement_type: string;
  quantity_change: number | string;
  actor_name: string;
  occurred_at: string;
  notes: string | null;
};

export async function loadStockMovementReport(input: { startDate: string; endDate: string }) {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "reports:view_inventory")) return { ok: false as const, message: "Your account is not allowed to view inventory reports." };
  const parsed = dateRangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, message: parsed.error.issues[0]?.message ?? "Review the report dates." };
  const limit = await consumeRateLimit("reports_read");
  if (!limit.allowed) return { ok: false as const, message: rateLimitMessage(limit) };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_stock_movement_report", {
    p_start_date: parsed.data.startDate,
    p_end_date: parsed.data.endDate,
  });
  if (error) {
    console.error("Stock movement report lookup failed", error);
    return { ok: false as const, message: error.message.includes("schema cache") ? "Apply the latest database migration to use stock movement reports." : "Stock movement could not be loaded." };
  }

  return {
    ok: true as const,
    rows: ((data ?? []) as StockMovementDatabaseRow[]).map((row) => ({
      id: row.movement_id,
      reference: row.reference_number,
      productCode: row.product_code,
      productName: row.product_name,
      barcode: row.barcode,
      type: row.movement_type,
      quantityChange: Number(row.quantity_change),
      actorName: row.actor_name,
      occurredAt: row.occurred_at,
      notes: row.notes ?? undefined,
    })) satisfies StockMovementReportRow[],
  };
}

export type ExpiringInventoryReportRow = {
  batchId: string;
  productCode: string;
  productName: string;
  barcode: string;
  categoryName: string;
  stockUnit: string;
  batchNumber?: string;
  quantityRemaining: number;
  expiresAt: string;
  receivedAt: string;
  daysUntilExpiry: number;
};

type ExpiringInventoryDatabaseRow = {
  batch_id: string;
  product_code: string;
  product_name: string;
  barcode: string;
  category_name: string;
  stock_unit: string;
  batch_number: string | null;
  quantity_remaining: number | string;
  expires_at: string;
  received_at: string;
  days_until_expiry: number | string;
};

export async function loadExpiringInventoryReport(input: { asOf: string; daysAhead: number }) {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "reports:view_inventory")) return { ok: false as const, message: "Your account is not allowed to view inventory reports." };
  const parsed = z.object({ asOf: z.iso.date("Report date is invalid."), daysAhead: z.number().int().min(0).max(3650) }).safeParse(input);
  if (!parsed.success) return { ok: false as const, message: parsed.error.issues[0]?.message ?? "Review the expiry report filters." };
  const limit = await consumeRateLimit("reports_read");
  if (!limit.allowed) return { ok: false as const, message: rateLimitMessage(limit) };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_expiring_inventory_report", {
    p_as_of: parsed.data.asOf,
    p_days_ahead: parsed.data.daysAhead,
  });
  if (error) {
    console.error("Expiring inventory report lookup failed", error);
    return { ok: false as const, message: error.message.includes("schema cache") ? "Apply the latest database migration to use expiry reports." : "Expiring inventory could not be loaded." };
  }

  return {
    ok: true as const,
    rows: ((data ?? []) as ExpiringInventoryDatabaseRow[]).map((row) => ({
      batchId: row.batch_id,
      productCode: row.product_code,
      productName: row.product_name,
      barcode: row.barcode,
      categoryName: row.category_name,
      stockUnit: row.stock_unit,
      batchNumber: row.batch_number ?? undefined,
      quantityRemaining: Number(row.quantity_remaining),
      expiresAt: row.expires_at,
      receivedAt: row.received_at,
      daysUntilExpiry: Number(row.days_until_expiry),
    })) satisfies ExpiringInventoryReportRow[],
  };
}
