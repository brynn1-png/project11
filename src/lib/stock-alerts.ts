import { getStockStatus, type Product } from "@/lib/types";

export type StockAlert = {
  product: Product;
  status: "Low Stock" | "Out of Stock";
};

export function getStockAlerts(products: Product[]): StockAlert[] {
  return products
    .map((product) => ({ product, status: getStockStatus(product) }))
    .filter((alert): alert is StockAlert => alert.status !== "In Stock")
    .sort((left, right) => {
      if (left.status !== right.status) return left.status === "Out of Stock" ? -1 : 1;
      if (left.product.stock !== right.product.stock) return left.product.stock - right.product.stock;
      return left.product.name.localeCompare(right.product.name);
    });
}
