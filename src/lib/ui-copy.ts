export const STORE_NAME = "South Emerald Supermarket";
export const APP_NAME = "South Emerald Inventory & Sales";
export const APP_SHORT_NAME = "Inventory & Sales";

export type InventoryActivityType = "Stock In" | "Stock Out";

export function inventoryActivityLabel(type: InventoryActivityType) {
  return type === "Stock In" ? "Stock received" : "Stock sold";
}
