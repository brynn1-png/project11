"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadInventorySnapshot, saveInventorySnapshot } from "@/lib/inventory-cache";
import type { Product, StockTransaction } from "@/lib/types";

type InventoryContextValue = {
  products: Product[];
  transactions: StockTransaction[];
  dataSource: "live" | "cached" | "unavailable";
  lastSyncedAt: string | null;
};

const InventoryContext = createContext<InventoryContextValue | null>(null);

export function InventoryProvider({
  children,
  products,
  transactions,
  serverAvailable,
  cacheScope,
}: Pick<InventoryContextValue, "products" | "transactions"> & { children: React.ReactNode; serverAvailable: boolean; cacheScope: string }) {
  const router = useRouter();
  const [currentProducts, setCurrentProducts] = useState(products);
  const [currentTransactions, setCurrentTransactions] = useState(transactions);
  const [dataSource, setDataSource] = useState<InventoryContextValue["dataSource"]>(serverAvailable ? "live" : "unavailable");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(serverAvailable ? new Date().toISOString() : null);

  useEffect(() => {
    let active = true;
    async function synchronizeCache() {
      try {
        if (serverAvailable) {
          const savedAt = new Date().toISOString();
          await saveInventorySnapshot(cacheScope, { products, transactions, savedAt });
          if (active) {
            setCurrentProducts(products);
            setCurrentTransactions(transactions);
            setDataSource("live");
            setLastSyncedAt(savedAt);
          }
          return;
        }

        const cached = await loadInventorySnapshot(cacheScope);
        if (active && cached) {
          setCurrentProducts(cached.products);
          setCurrentTransactions(cached.transactions);
          setDataSource("cached");
          setLastSyncedAt(cached.savedAt);
        }
      } catch {
        if (active && !serverAvailable) setDataSource("unavailable");
      }
    }
    void synchronizeCache();
    return () => { active = false; };
  }, [cacheScope, products, serverAvailable, transactions]);

  useEffect(() => {
    if (!serverAvailable) return;
    const refresh = () => router.refresh();
    const refreshWhenVisible = () => { if (document.visibilityState === "visible") refresh(); };
    const interval = window.setInterval(refreshWhenVisible, 60000);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [router, serverAvailable]);

  return (
    <InventoryContext.Provider value={{ products: currentProducts, transactions: currentTransactions, dataSource, lastSyncedAt }}>
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory() {
  const context = useContext(InventoryContext);
  if (!context) throw new Error("useInventory must be used inside InventoryProvider");
  return context;
}
