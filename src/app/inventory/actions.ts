"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  categoryInputSchema,
  initialStockInputSchema,
  productInputSchema,
  receiveStockInputSchema,
  type CategoryInput,
  type InitialStockInput,
  type ProductInput,
  type ReceiveStockInput,
} from "@/lib/validation/inventory-writes";
import { z } from "zod";

export type CategoryOption = {
  id: string;
  name: string;
  description?: string;
  defaultExpiryTracking: "required" | "not_applicable";
};

export type SavedProduct = {
  databaseId: string;
  productCode: string;
  barcode: string;
  name: string;
};

export type ArchivedProduct = {
  databaseId: string;
  productCode: string;
  barcode: string;
  name: string;
  description?: string;
  categoryName: string;
  stockUnit: string;
  quantity: number;
  archivedAt: string;
  archiveReason: string;
  archivedBy?: string;
};

type ProductRow = {
  id: string;
  product_code: string;
  barcode: string;
  name: string;
};

type ProductWithInitialStockRow = ProductRow & {
  receiving_number: number | string;
  batch_number: string;
  resulting_quantity: number | string;
};

type ArchivedProductRow = {
  id: string; product_code: string; barcode: string; name: string; description: string | null;
  category_name: string; stock_unit: string; quantity: number | string; archived_at: string;
  archive_reason: string | null; archived_by_name: string | null;
};

function errorMessage(error: { message: string }, fallback: string) {
  if (error.message.includes("register_inventory_product_with_initial_stock") || error.message.includes("schema cache")) {
    return "Apply the latest database migration, then try again.";
  }
  if (error.message.includes("already registered or retired") || error.message.includes("duplicate key")) {
    return "That barcode is already registered or was previously used.";
  }
  if (error.message.includes("batch_number")) return "That batch or lot number already exists for this product.";
  if (error.message.includes("Manager access") || error.message.includes("not allowed")) return error.message;
  if (error.message.includes("zero stock") || error.message.includes("pending resellable returns")) return error.message;
  if (error.message.includes("expiry") || error.message.includes("Expired") || error.message.includes("Manufactured")) return error.message;
  return fallback;
}

export async function listInventoryCategories(): Promise<{ ok: true; categories: CategoryOption[] } | { ok: false; message: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sign in again to load categories." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, description, default_expiry_tracking")
    .is("archived_at", null)
    .order("name");

  if (error) return { ok: false, message: "Categories could not be loaded." };
  return {
    ok: true,
    categories: (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      defaultExpiryTracking: row.default_expiry_tracking,
    })),
  };
}

export async function createInventoryCategory(input: CategoryInput) {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "products:manage")) {
    return { ok: false as const, message: "Manager access is required to add categories." };
  }
  const parsed = categoryInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, message: parsed.error.issues[0]?.message ?? "Review the category details." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_inventory_category", {
    p_name: parsed.data.name,
    p_description: parsed.data.description || null,
    p_default_expiry_tracking: parsed.data.defaultExpiryTracking,
  });
  if (error) return { ok: false as const, message: errorMessage(error, "The category could not be created.") };

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { ok: false as const, message: "The database did not return the new category." };
  return {
    ok: true as const,
    category: {
      id: row.id as string,
      name: row.name as string,
      description: (row.description as string | null) ?? undefined,
      defaultExpiryTracking: row.default_expiry_tracking as CategoryOption["defaultExpiryTracking"],
    },
  };
}

export async function updateInventoryCategory(categoryId: string, input: CategoryInput) {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "products:manage")) {
    return { ok: false as const, message: "Manager access is required to edit categories." };
  }
  const id = z.uuid().safeParse(categoryId);
  const parsed = categoryInputSchema.safeParse(input);
  if (!id.success || !parsed.success) return { ok: false as const, message: parsed.success ? "Category identifier is invalid." : parsed.error.issues[0]?.message ?? "Review the category details." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_inventory_category", {
    p_category_id: id.data,
    p_name: parsed.data.name,
    p_description: parsed.data.description || null,
    p_default_expiry_tracking: parsed.data.defaultExpiryTracking,
  });
  if (error) return { ok: false as const, message: errorMessage(error, "The category could not be updated.") };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { ok: false as const, message: "The database did not return the updated category." };
  revalidatePath("/");
  return { ok: true as const, category: { id: row.id as string, name: row.name as string, description: (row.description as string | null) ?? undefined, defaultExpiryTracking: row.default_expiry_tracking as CategoryOption["defaultExpiryTracking"] } };
}

async function saveProduct(input: ProductInput, mode: "create" | "update") {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "products:manage")) {
    return { ok: false as const, message: "Manager access is required to save products." };
  }
  const parsed = productInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, message: parsed.error.issues[0]?.message ?? "Review the product details." };
  if (mode === "update" && !parsed.data.productId) return { ok: false as const, message: "Product identifier is missing." };

  const supabase = await createClient();
  const params = {
    p_name: parsed.data.name,
    p_description: parsed.data.description || null,
    p_category_id: parsed.data.categoryId,
    p_package_size: parsed.data.packageSize,
    p_package_unit: parsed.data.packageUnit,
    p_stock_unit: parsed.data.stockUnit,
    p_selling_price: parsed.data.sellingPrice,
    p_minimum_stock: parsed.data.minimumStock,
    p_expiry_tracking: parsed.data.expiryTracking,
    p_barcode: parsed.data.barcodeMode === "manufacturer" ? parsed.data.barcode?.trim() || null : null,
    p_generate_barcode: parsed.data.barcodeMode === "generated",
    ...(mode === "update" ? { p_product_id: parsed.data.productId } : {}),
  };
  const { data, error } = await supabase.rpc(mode === "create" ? "create_inventory_product" : "update_inventory_product", params);
  if (error) {
    console.error("Product save failed", error);
    return { ok: false as const, message: errorMessage(error, "The product could not be saved. No changes were made.") };
  }

  const row = (Array.isArray(data) ? data[0] : data) as ProductRow | null;
  if (!row) return { ok: false as const, message: "The database did not return the saved product." };
  revalidatePath("/");
  return {
    ok: true as const,
    product: { databaseId: row.id, productCode: row.product_code, barcode: row.barcode, name: row.name } satisfies SavedProduct,
  };
}

export async function createInventoryProduct(input: ProductInput) {
  return saveProduct(input, "create");
}

export async function createInventoryProductWithInitialStock(input: ProductInput, initialStock: InitialStockInput) {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "products:manage") || !hasPermission(user.role, "stock:receive")) {
    return { ok: false as const, message: "Manager access is required to register a product with initial stock." };
  }

  const parsedProduct = productInputSchema.safeParse(input);
  if (!parsedProduct.success) return { ok: false as const, message: parsedProduct.error.issues[0]?.message ?? "Review the product details." };
  const parsedStock = initialStockInputSchema.safeParse(initialStock);
  if (!parsedStock.success) return { ok: false as const, message: parsedStock.error.issues[0]?.message ?? "Review the initial stock details." };

  const product = parsedProduct.data;
  const stock = parsedStock.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("register_inventory_product_with_initial_stock", {
    p_name: product.name,
    p_description: product.description || null,
    p_category_id: product.categoryId,
    p_package_size: product.packageSize,
    p_package_unit: product.packageUnit,
    p_stock_unit: product.stockUnit,
    p_selling_price: product.sellingPrice,
    p_minimum_stock: product.minimumStock,
    p_expiry_tracking: product.expiryTracking,
    p_barcode: product.barcodeMode === "manufacturer" ? product.barcode?.trim() || null : null,
    p_generate_barcode: product.barcodeMode === "generated",
    p_initial_quantity: stock.quantity,
    p_initial_unit_cost: stock.unitCost,
    p_initial_expires_at: stock.expiresAt || null,
  });

  if (error) {
    console.error("Product registration with initial stock failed", error);
    return { ok: false as const, message: errorMessage(error, "The product and initial stock could not be saved. No changes were made.") };
  }

  const row = (Array.isArray(data) ? data[0] : data) as ProductWithInitialStockRow | null;
  if (!row) return { ok: false as const, message: "The database did not return the registered product and stock receipt." };
  revalidatePath("/");
  return {
    ok: true as const,
    product: { databaseId: row.id, productCode: row.product_code, barcode: row.barcode, name: row.name } satisfies SavedProduct,
    receivingNumber: String(row.receiving_number),
    batchNumber: row.batch_number,
    resultingQuantity: Number(row.resulting_quantity),
  };
}

export async function updateInventoryProduct(input: ProductInput) {
  return saveProduct(input, "update");
}

export async function listArchivedInventoryProducts(): Promise<{ ok: true; products: ArchivedProduct[] } | { ok: false; message: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sign in again to load archived products." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_archived_inventory_products");
  if (error) {
    console.error("Archived products lookup failed", error);
    return { ok: false, message: errorMessage(error, "Archived products could not be loaded.") };
  }
  return {
    ok: true,
    products: ((data ?? []) as ArchivedProductRow[]).map((row) => ({
      databaseId: row.id as string,
      productCode: row.product_code as string,
      barcode: row.barcode as string,
      name: row.name as string,
      description: (row.description as string | null) ?? undefined,
      categoryName: row.category_name as string,
      stockUnit: row.stock_unit as string,
      quantity: Number(row.quantity),
      archivedAt: row.archived_at as string,
      archiveReason: (row.archive_reason as string | null) ?? "No reason recorded",
      archivedBy: (row.archived_by_name as string | null) ?? undefined,
    })),
  };
}

export async function archiveInventoryProduct(productId: string, reason: string) {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "products:archive")) {
    return { ok: false as const, message: "Manager access is required to archive products." };
  }
  const parsed = z.uuid().safeParse(productId);
  const parsedReason = z.string().trim().min(2, "Enter an archive reason.").max(160).safeParse(reason);
  if (!parsed.success) return { ok: false as const, message: "Product identifier is invalid." };
  if (!parsedReason.success) return { ok: false as const, message: parsedReason.error.issues[0]?.message ?? "Enter an archive reason." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("archive_inventory_product", { p_product_id: parsed.data, p_reason: parsedReason.data });
  if (error) return { ok: false as const, message: errorMessage(error, error.message.includes("zero stock") ? error.message : "The product could not be archived.") };
  revalidatePath("/");
  return { ok: true as const };
}

export async function restoreInventoryProduct(productId: string) {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "products:archive")) {
    return { ok: false as const, message: "Manager access is required to restore products." };
  }
  const parsed = z.uuid().safeParse(productId);
  if (!parsed.success) return { ok: false as const, message: "Product identifier is invalid." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("restore_inventory_product", { p_product_id: parsed.data });
  if (error) return { ok: false as const, message: errorMessage(error, "The product could not be restored.") };
  revalidatePath("/");
  return { ok: true as const };
}

export async function receiveInventoryStock(input: ReceiveStockInput) {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "stock:receive")) {
    return { ok: false as const, message: "Your account is not allowed to receive stock." };
  }
  const parsed = receiveStockInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, message: parsed.error.issues[0]?.message ?? "Review the stock receipt." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("receive_inventory_stock", {
    p_product_id: parsed.data.productId,
    p_quantity: parsed.data.quantity,
    p_unit_cost: parsed.data.unitCost,
    p_batch_number: parsed.data.batchNumber || null,
    p_manufactured_at: parsed.data.manufacturedAt || null,
    p_expires_at: parsed.data.expiresAt || null,
    p_delivery_reference: parsed.data.deliveryReference || null,
    p_notes: parsed.data.notes || null,
  });
  if (error) {
    console.error("Stock receipt failed", error);
    return { ok: false as const, message: errorMessage(error, "Stock could not be received. Inventory was not changed.") };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { ok: false as const, message: "The database did not return a receiving confirmation." };
  revalidatePath("/");
  return {
    ok: true as const,
    receivingNumber: String(row.receiving_number),
    batchNumber: String(row.batch_number),
    previousQuantity: Number(row.previous_quantity),
    resultingQuantity: Number(row.resulting_quantity),
  };
}
