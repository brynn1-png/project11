export type StockStatus = "In Stock" | "Low Stock" | "Out of Stock";

export type Product = {
  id: string;
  name: string;
  barcode: string;
  category: string;
  unit: string;
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
  previousStock: number;
  newStock: number;
  user: string;
  createdAt: string;
  notes?: string;
};

export function getStockStatus(product: Product): StockStatus {
  if (product.stock === 0) return "Out of Stock";
  if (product.stock <= product.minimumStock) return "Low Stock";
  return "In Stock";
}

