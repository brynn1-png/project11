export type StockStatus = "In Stock" | "Low Stock" | "Out of Stock";

export type Product = {
  id: string;
  databaseId: string;
  name: string;
  description?: string;
  barcode: string;
  categoryId: string;
  category: string;
  packageSize: number;
  packageUnit: string;
  unit: string;
  expiryTracking: "required" | "not_applicable";
  stock: number;
  minimumStock: number;
  price: number;
  updatedAt: string;
};

export type StockTransaction = {
  id: string;
  productId: string;
  productName: string;
  barcode: string;
  type: "Stock In" | "Stock Out";
  quantity: number;
  previousStock: number | null;
  newStock: number | null;
  user: string;
  createdAt: string;
  notes?: string;
};

export type UserProfile = {
  id: string;
  fullName: string;
  role: import("@/lib/auth/permissions").AppRole;
  status: "active" | "inactive";
};

export function getStockStatus(product: Product): StockStatus {
  if (product.stock === 0) return "Out of Stock";
  if (product.stock <= product.minimumStock) return "Low Stock";
  return "In Stock";
}
