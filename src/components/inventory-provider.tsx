"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { INITIAL_PRODUCTS, INITIAL_TRANSACTIONS } from "@/lib/mock-data";
import type { Product, StockTransaction } from "@/lib/types";

type NewProduct = Omit<Product, "id" | "updatedAt">;

type InventoryContextValue = {
  products: Product[];
  transactions: StockTransaction[];
  hydrated: boolean;
  addProduct: (product: NewProduct) => Product;
  adjustStock: (productId: string, type: "Stock In" | "Stock Out", quantity: number, notes?: string) => { ok: boolean; message: string };
  resetDemo: () => void;
};

const InventoryContext = createContext<InventoryContextValue | null>(null);
const STORAGE_KEY = "inventory-system-demo-v1";

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [transactions, setTransactions] = useState<StockTransaction[]>(INITIAL_TRANSACTIONS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { products: Product[]; transactions: StockTransaction[] };
        queueMicrotask(() => {
          setProducts(parsed.products);
          setTransactions(parsed.transactions);
        });
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      queueMicrotask(() => setHydrated(true));
    }
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify({ products, transactions }));
  }, [products, transactions, hydrated]);

  const value = useMemo<InventoryContextValue>(() => ({
    products,
    transactions,
    hydrated,
    addProduct: (newProduct) => {
      const product: Product = {
        ...newProduct,
        id: `PRD-${String(1001 + products.length).padStart(4, "0")}`,
        updatedAt: new Date().toISOString(),
      };
      setProducts((current) => [product, ...current]);
      return product;
    },
    adjustStock: (productId, type, quantity, notes) => {
      const product = products.find((item) => item.id === productId);
      if (!product) return { ok: false, message: "Product could not be found." };
      if (!Number.isFinite(quantity) || quantity <= 0) return { ok: false, message: "Enter a quantity greater than zero." };
      if (type === "Stock Out" && quantity > product.stock) return { ok: false, message: `Only ${product.stock} ${product.unit}${product.stock === 1 ? "" : "s"} are available.` };

      const nextStock = type === "Stock In" ? product.stock + quantity : product.stock - quantity;
      const now = new Date().toISOString();
      const transaction: StockTransaction = {
        id: `TXN-${Date.now()}`,
        productId: product.id,
        productName: product.name,
        barcode: product.barcode,
        type,
        quantity,
        previousStock: product.stock,
        newStock: nextStock,
        user: "Maria Santos",
        createdAt: now,
        notes,
      };
      setProducts((current) => current.map((item) => item.id === productId ? { ...item, stock: nextStock, updatedAt: now } : item));
      setTransactions((current) => [transaction, ...current]);
      return { ok: true, message: `${product.name} is now at ${nextStock} ${product.unit}${nextStock === 1 ? "" : "s"}.` };
    },
    resetDemo: () => {
      setProducts(INITIAL_PRODUCTS);
      setTransactions(INITIAL_TRANSACTIONS);
      localStorage.removeItem(STORAGE_KEY);
    },
  }), [products, transactions, hydrated]);

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
}

export function useInventory() {
  const context = useContext(InventoryContext);
  if (!context) throw new Error("useInventory must be used inside InventoryProvider");
  return context;
}
