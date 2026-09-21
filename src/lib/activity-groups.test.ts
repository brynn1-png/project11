import { describe, expect, it } from "vitest";
import { groupActivityByReceipt } from "@/lib/activity-groups";
import type { StockTransaction } from "@/lib/types";

function transaction(overrides: Partial<StockTransaction>): StockTransaction {
  return {
    id: "SAL-item-1",
    groupId: "SAL-sale-1",
    reference: "Sale #42",
    productId: "PRD-1",
    productName: "Product one",
    barcode: "1001",
    type: "Stock Out",
    quantity: 2,
    previousStock: null,
    newStock: null,
    user: "Cashier",
    createdAt: "2026-09-21T05:00:00.000Z",
    ...overrides,
  };
}

describe("groupActivityByReceipt", () => {
  it("combines sale items that belong to the same receipt", () => {
    const result = groupActivityByReceipt([
      transaction({ id: "SAL-item-1", productId: "PRD-1", quantity: 2 }),
      transaction({ id: "SAL-item-2", productId: "PRD-2", productName: "Product two", quantity: 3 }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ reference: "Sale #42", productCount: 2, totalQuantity: 5 });
  });

  it("keeps separate receiving receipts separate", () => {
    const result = groupActivityByReceipt([
      transaction({ id: "RCV-1", groupId: "RCV-1", reference: "Receiving #7", type: "Stock In" }),
      transaction({ id: "RCV-2", groupId: "RCV-2", reference: "Receiving #8", type: "Stock In" }),
    ]);

    expect(result.map((item) => item.reference)).toEqual(["Receiving #7", "Receiving #8"]);
  });

  it("groups legacy sale rows by their shared sale metadata", () => {
    const result = groupActivityByReceipt([
      transaction({ id: "SAL-item-1", groupId: undefined, reference: undefined }),
      transaction({ id: "SAL-item-2", groupId: undefined, reference: undefined, productId: "PRD-2" }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ reference: "Sale receipt", productCount: 2, totalQuantity: 4 });
  });
});
