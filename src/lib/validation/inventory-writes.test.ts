import { describe, expect, it } from "vitest";
import { productInputSchema, receiveStockInputSchema } from "@/lib/validation/inventory-writes";

const product = {
  name: "Brown Rice 1kg",
  categoryId: "313b3f15-c795-4c44-8126-91a7f6c71871",
  packageSize: 1,
  packageUnit: "kg",
  stockUnit: "bag",
  sellingPrice: 92,
  minimumStock: 5,
  expiryTracking: "required" as const,
  barcodeMode: "manufacturer" as const,
  barcode: "4801234567890",
};

describe("inventory write validation", () => {
  it("accepts complete product details", () => {
    expect(productInputSchema.safeParse(product).success).toBe(true);
  });

  it("allows a generated barcode without a manufacturer code", () => {
    expect(productInputSchema.safeParse({ ...product, barcodeMode: "generated", barcode: "" }).success).toBe(true);
  });

  it("rejects whitespace in a manufacturer barcode", () => {
    expect(productInputSchema.safeParse({ ...product, barcode: "ABC 123" }).success).toBe(false);
  });

  it("requires expiry for products that track it", () => {
    const result = receiveStockInputSchema.safeParse({
      productId: product.categoryId,
      quantity: 12,
      unitCost: 60,
      expiryTracking: "required",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a non-expiring receipt without expiry", () => {
    const result = receiveStockInputSchema.safeParse({
      productId: product.categoryId,
      quantity: 12,
      unitCost: 60,
      expiryTracking: "not_applicable",
    });
    expect(result.success).toBe(true);
  });
});
