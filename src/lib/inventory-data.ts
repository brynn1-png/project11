import "server-only";

import type { AppRole } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import type { Product, StockTransaction, UserProfile } from "@/lib/types";

type CatalogRow = {
  id: string;
  product_code: string;
  barcode: string;
  name: string;
  description: string | null;
  category_id: string;
  category: string;
  package_size: number | string;
  package_unit: string;
  stock_unit: string;
  expiry_tracking: "required" | "not_applicable";
  selling_price: number | string;
  minimum_stock: number;
  quantity_on_hand: number | string;
  updated_at: string;
};

type ActivityRow = {
  activity_id: string;
  activity_group_id?: string;
  reference_number?: string;
  product_id: string;
  product_code: string;
  product_name: string;
  barcode: string;
  activity_type: "Stock In" | "Stock Out";
  quantity: number;
  actor_name: string;
  occurred_at: string;
  notes: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string;
  role: AppRole;
  status: "active" | "inactive";
};

export type InventorySnapshot = {
  products: Product[];
  transactions: StockTransaction[];
  users: UserProfile[];
  error: string | null;
};

export async function getInventorySnapshot(role: AppRole): Promise<InventorySnapshot> {
  const supabase = await createClient();
  const profilesRequest = role === "administrator"
    ? supabase.from("profiles").select("id, full_name, role, status").order("full_name")
    : Promise.resolve({ data: [], error: null });

  const [catalogResult, activityResult, profilesResult] = await Promise.all([
    supabase.rpc("get_inventory_catalog"),
    supabase.rpc("get_inventory_activity", { activity_limit: 100 }),
    profilesRequest,
  ]);

  const errors = [catalogResult.error, activityResult.error, profilesResult.error].filter(Boolean);
  if (errors.length > 0) {
    console.error("Unable to load inventory snapshot", errors);
    return {
      products: [],
      transactions: [],
      users: [],
      error: "Inventory data could not be loaded. Apply the latest database migration, then refresh this page.",
    };
  }

  const products = ((catalogResult.data ?? []) as CatalogRow[]).map((row) => ({
    id: row.product_code,
    databaseId: row.id,
    name: row.name,
    description: row.description ?? undefined,
    barcode: row.barcode,
    categoryId: row.category_id,
    category: row.category,
    packageSize: Number(row.package_size),
    packageUnit: row.package_unit,
    unit: row.stock_unit,
    expiryTracking: row.expiry_tracking,
    stock: Number(row.quantity_on_hand),
    minimumStock: row.minimum_stock,
    price: Number(row.selling_price),
    updatedAt: row.updated_at,
  }));

  const transactions = ((activityResult.data ?? []) as ActivityRow[]).map((row) => ({
    id: row.activity_id,
    groupId: row.activity_group_id,
    reference: row.reference_number,
    productId: row.product_code,
    productName: row.product_name,
    barcode: row.barcode,
    type: row.activity_type,
    quantity: row.quantity,
    previousStock: null,
    newStock: null,
    user: row.actor_name,
    createdAt: row.occurred_at,
    notes: row.notes ?? undefined,
  }));

  const users = ((profilesResult.data ?? []) as ProfileRow[]).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    role: row.role,
    status: row.status,
  }));

  return { products, transactions, users, error: null };
}
