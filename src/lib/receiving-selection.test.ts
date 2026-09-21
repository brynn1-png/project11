import { describe, expect, it } from "vitest";
import { findReceivingProduct, shouldResetReceivingDraft } from "@/lib/receiving-selection";
import type { Product } from "@/lib/types";

const product: Product = {
  id: "PRD-000001",
  databaseId: "20000000-0000-4000-8000-000000000001",
  name: "Test Milk",
  barcode: "4800194185080",
  categoryId: "10000000-0000-4000-8000-000000000001",
  category: "Beverages",
  packageSize: 1,
  packageUnit: "L",
  unit: "bottle",
  expiryTracking: "required",
  stock: 2,
  minimumStock: 1,
  price: 75,
  updatedAt: "2026-09-19T00:00:00.000Z",
};

describe("receiving product selection", () => {
  it("finds a product by scanned barcode", () => {
    expect(findReceivingProduct([product], " 4800194185080 ")?.databaseId).toBe(product.databaseId);
  });

  it("finds alphanumeric barcodes regardless of scanner casing", () => {
    const keySwitch = { ...product, barcode: "K500003T" };
    expect(findReceivingProduct([keySwitch], "k500003t")?.databaseId).toBe(product.databaseId);
  });

  it("finds a product code without case sensitivity", () => {
    expect(findReceivingProduct([product], "prd-000001")?.databaseId).toBe(product.databaseId);
  });

  it("resets a draft only when switching away from an existing selection", () => {
    expect(shouldResetReceivingDraft(product.databaseId, product.databaseId)).toBe(false);
    expect(shouldResetReceivingDraft("", product.databaseId)).toBe(false);
    expect(shouldResetReceivingDraft(product.databaseId, "another-product")).toBe(true);
  });
});
