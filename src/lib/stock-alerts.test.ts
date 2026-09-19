import { describe, expect, it } from "vitest";
import { getStockAlerts } from "@/lib/stock-alerts";
import type { Product } from "@/lib/types";

function product(name: string, stock: number, minimumStock: number): Product {
  return {
    id: `PRD-${name}`,
    databaseId: `database-${name}`,
    name,
    barcode: `barcode-${name}`,
    categoryId: "category",
    category: "Test",
    packageSize: 1,
    packageUnit: "piece",
    unit: "item",
    expiryTracking: "not_applicable",
    stock,
    minimumStock,
    price: 10,
    updatedAt: "2026-09-19T00:00:00.000Z",
  };
}

describe("stock alerts", () => {
  it("flags products at or below their restock level", () => {
    const alerts = getStockAlerts([
      product("Above", 6, 5),
      product("At threshold", 5, 5),
      product("Below", 2, 5),
    ]);

    expect(alerts.map((alert) => alert.product.name)).toEqual(["Below", "At threshold"]);
    expect(alerts.every((alert) => alert.status === "Low Stock")).toBe(true);
  });

  it("places out-of-stock products before low-stock products", () => {
    const alerts = getStockAlerts([
      product("Low two", 2, 5),
      product("Out", 0, 5),
      product("Low one", 1, 5),
    ]);

    expect(alerts.map((alert) => [alert.product.name, alert.status])).toEqual([
      ["Out", "Out of Stock"],
      ["Low one", "Low Stock"],
      ["Low two", "Low Stock"],
    ]);
  });

  it("returns an empty list when every product is above its restock level", () => {
    expect(getStockAlerts([product("Healthy", 11, 10)])).toEqual([]);
  });
});
