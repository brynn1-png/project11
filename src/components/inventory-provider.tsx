"use client";

import { createContext, useContext } from "react";
import type { Product, StockTransaction } from "@/lib/types";

type InventoryContextValue = {
  products: Product[];
  transactions: StockTransaction[];
};

const InventoryContext = createContext<InventoryContextValue | null>(null);

export function InventoryProvider({
  children,
  products,
  transactions,
}: InventoryContextValue & { children: React.ReactNode }) {
  return (
    <InventoryContext.Provider value={{ products, transactions }}>
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory() {
  const context = useContext(InventoryContext);
  if (!context) throw new Error("useInventory must be used inside InventoryProvider");
  return context;
}
