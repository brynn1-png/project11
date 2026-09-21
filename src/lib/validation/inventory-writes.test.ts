import { describe, expect, it } from "vitest";
import { initialStockInputSchema, productInputSchema, receiveStockInputSchema } from "@/lib/validation/inventory-writes";

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

  it("accepts printable spaces used by Code 39 and Code 128", () => {
    expect(productInputSchema.safeParse({ ...product, barcode: "ABC 123" }).success).toBe(true);
  });

  it("rejects non-printable characters in a manufacturer barcode", () => {
    expect(productInputSchema.safeParse({ ...product, barcode: "ABC\n123" }).success).toBe(false);
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

  it("rejects calendar dates that do not exist", () => {
    const result = receiveStockInputSchema.safeParse({
      productId: product.categoryId,
      quantity: 12,
      unitCost: 60,
      expiryTracking: "required",
      expiresAt: "2026-99-99",
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

  it("accepts opening stock for a non-expiring product", () => {
    expect(initialStockInputSchema.safeParse({ quantity: 12, unitCost: 60, expiryTracking: "not_applicable" }).success).toBe(true);
  });

  it("requires an expiry date for opening stock that tracks expiry", () => {
    expect(initialStockInputSchema.safeParse({ quantity: 12, unitCost: 60, expiryTracking: "required" }).success).toBe(false);
  });

  it("rejects zero opening quantity", () => {
    expect(initialStockInputSchema.safeParse({ quantity: 0, unitCost: 60, expiryTracking: "not_applicable" }).success).toBe(false);
  });
});
