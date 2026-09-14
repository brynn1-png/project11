import type { Product, StockTransaction } from "./types";

export const INITIAL_PRODUCTS: Product[] = [
  { id: "PRD-1001", name: "Lucky Me Pancit Canton Original", barcode: "4807770270142", category: "Instant Noodles", unit: "pack", stock: 84, minimumStock: 24, price: 16.5, updatedAt: "2026-09-14T08:42:00+08:00" },
  { id: "PRD-1002", name: "Argentina Corned Beef 175g", barcode: "748485801021", category: "Canned Goods", unit: "can", stock: 42, minimumStock: 18, price: 46.75, updatedAt: "2026-09-14T08:16:00+08:00" },
  { id: "PRD-1003", name: "Datu Puti Vinegar 1L", barcode: "4801668501028", category: "Condiments", unit: "bottle", stock: 12, minimumStock: 15, price: 42, updatedAt: "2026-09-13T17:05:00+08:00" },
  { id: "PRD-1004", name: "Bear Brand Powdered Milk 320g", barcode: "4800361418336", category: "Beverages", unit: "pack", stock: 0, minimumStock: 10, price: 126.5, updatedAt: "2026-09-13T15:24:00+08:00" },
  { id: "PRD-1005", name: "White Sugar Repacked 1kg", barcode: "2000000001058", category: "Repacked Goods", unit: "bag", stock: 36, minimumStock: 12, price: 78, updatedAt: "2026-09-14T07:50:00+08:00" },
  { id: "PRD-1006", name: "Sinandomeng Rice", barcode: "2000000001065", category: "Rice", unit: "kg", stock: 128, minimumStock: 40, price: 58, updatedAt: "2026-09-14T07:42:00+08:00" },
  { id: "PRD-1007", name: "Piattos Cheese 85g", barcode: "4800016023588", category: "Snacks", unit: "pack", stock: 18, minimumStock: 20, price: 38.5, updatedAt: "2026-09-13T16:10:00+08:00" },
  { id: "PRD-1008", name: "Safeguard Pure White 135g", barcode: "4902430861398", category: "Household", unit: "bar", stock: 31, minimumStock: 12, price: 59.75, updatedAt: "2026-09-12T14:35:00+08:00" },
  { id: "PRD-1009", name: "Alaska Evaporated Milk 370ml", barcode: "4800575120063", category: "Canned Goods", unit: "can", stock: 9, minimumStock: 12, price: 39.25, updatedAt: "2026-09-14T09:05:00+08:00" },
  { id: "PRD-1010", name: "Coca-Cola Original 1.5L", barcode: "5449000054227", category: "Beverages", unit: "bottle", stock: 27, minimumStock: 18, price: 76, updatedAt: "2026-09-14T08:55:00+08:00" },
];

export const INITIAL_TRANSACTIONS: StockTransaction[] = [
  { id: "TXN-240914-06", productId: "PRD-1009", productName: "Alaska Evaporated Milk 370ml", barcode: "4800575120063", type: "Stock Out", quantity: 4, previousStock: 13, newStock: 9, user: "Maria Santos", createdAt: "2026-09-14T09:05:00+08:00", notes: "Store release" },
  { id: "TXN-240914-05", productId: "PRD-1010", productName: "Coca-Cola Original 1.5L", barcode: "5449000054227", type: "Stock In", quantity: 12, previousStock: 15, newStock: 27, user: "Maria Santos", createdAt: "2026-09-14T08:55:00+08:00", notes: "Morning delivery" },
  { id: "TXN-240914-04", productId: "PRD-1001", productName: "Lucky Me Pancit Canton Original", barcode: "4807770270142", type: "Stock Out", quantity: 6, previousStock: 90, newStock: 84, user: "Carlo Mendoza", createdAt: "2026-09-14T08:42:00+08:00" },
  { id: "TXN-240914-03", productId: "PRD-1002", productName: "Argentina Corned Beef 175g", barcode: "748485801021", type: "Stock In", quantity: 24, previousStock: 18, newStock: 42, user: "Maria Santos", createdAt: "2026-09-14T08:16:00+08:00" },
  { id: "TXN-240914-02", productId: "PRD-1005", productName: "White Sugar Repacked 1kg", barcode: "2000000001058", type: "Stock In", quantity: 20, previousStock: 16, newStock: 36, user: "Maria Santos", createdAt: "2026-09-14T07:50:00+08:00", notes: "Repacked stock" },
  { id: "TXN-240914-01", productId: "PRD-1006", productName: "Sinandomeng Rice", barcode: "2000000001065", type: "Stock In", quantity: 50, previousStock: 78, newStock: 128, user: "Maria Santos", createdAt: "2026-09-14T07:42:00+08:00" },
];

