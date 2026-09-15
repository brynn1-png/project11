import { describe, expect, it } from "vitest";
import { recordSaleSchema } from "@/lib/validation/sales";

const validSale = {
  idempotencyKey: "10000000-0000-4000-8000-000000000001",
  items: [{ productId: "20000000-0000-4000-8000-000000000001", quantity: 2 }],
};

describe("recordSaleSchema", () => {
  it("accepts a whole-number sale quantity", () => {
    expect(recordSaleSchema.safeParse(validSale).success).toBe(true);
  });

  it("rejects empty carts", () => {
    expect(recordSaleSchema.safeParse({ ...validSale, items: [] }).success).toBe(false);
  });

  it("rejects fractional and negative quantities", () => {
    expect(recordSaleSchema.safeParse({ ...validSale, items: [{ ...validSale.items[0], quantity: 1.5 }] }).success).toBe(false);
    expect(recordSaleSchema.safeParse({ ...validSale, items: [{ ...validSale.items[0], quantity: -1 }] }).success).toBe(false);
  });
});
