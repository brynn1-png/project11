import { describe, expect, it } from "vitest";
import { addProductToCart, processProductBarcode, updateCartQuantity, type CartLine } from "@/lib/sales-cart";
import type { Product } from "@/lib/types";

const milk: Product = {
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

const soap: Product = { ...milk, id: "PRD-000002", databaseId: "20000000-0000-4000-8000-000000000002", name: "Test Soap", barcode: "4800000000002", stock: 0 };

describe("sales cart", () => {
  it("returns product details for a price check without changing the cart", () => {
    const cart: CartLine[] = [{ product: milk, quantity: 2 }];
    const result = processProductBarcode([milk, soap], cart, milk.barcode, "price");

    expect(result).toMatchObject({ ok: true, mode: "price", product: milk });
    expect(cart).toEqual([{ product: milk, quantity: 2 }]);
  });

  it("uses the normal cart rules when scanning in sale mode", () => {
    const result = processProductBarcode([milk], [], milk.barcode, "sale");

    expect(result).toMatchObject({ ok: true, mode: "sale", quantity: 1 });
  });

  it("matches alphanumeric barcodes without case sensitivity", () => {
    const keySwitch = { ...milk, name: "Key Switch", barcode: "K500003T" };

    expect(processProductBarcode([keySwitch], [], "k500003t", "sale")).toMatchObject({ ok: true, product: keySwitch });
  });

  it("matches punctuation and internal spaces used by Code 39 and Code 128", () => {
    const part = { ...milk, name: "Service Part", barcode: "PART 50-A/2" };

    expect(processProductBarcode([part], [], "PART 50-A/2", "sale")).toMatchObject({ ok: true, product: part });
  });

  it("treats UPC-A and its leading-zero EAN-13 representation as the same code", () => {
    const upcProduct = { ...milk, barcode: "123456789012" };

    expect(processProductBarcode([upcProduct], [], "0123456789012", "sale")).toMatchObject({ ok: true, product: upcProduct });
  });

  it("ignores scanner symbology identifiers before matching", () => {
    const code128Product = { ...milk, barcode: "K500003T" };

    expect(processProductBarcode([code128Product], [], "]C1K500003T", "sale")).toMatchObject({ ok: true, product: code128Product });
  });

  it("adds a scanned product with quantity one", () => {
    const result = addProductToCart([], milk);
    expect(result).toMatchObject({ ok: true, quantity: 1, cart: [{ quantity: 1 }] });
  });

  it("increments one existing line when the same product is scanned again", () => {
    const result = addProductToCart([{ product: milk, quantity: 1 }], milk);
    expect(result).toMatchObject({ ok: true, quantity: 2, cart: [{ quantity: 2 }] });
  });

  it("keeps different scanned products on separate lines", () => {
    const inStockSoap = { ...soap, stock: 3 };
    const result = addProductToCart([{ product: milk, quantity: 1 }], inStockSoap);
    expect(result.ok && result.cart).toHaveLength(2);
  });

  it("rejects out-of-stock products and scans above available stock", () => {
    expect(addProductToCart([], soap)).toMatchObject({ ok: false, message: "Test Soap is out of stock." });
    expect(addProductToCart([{ product: milk, quantity: 2 }], milk).ok).toBe(false);
  });

  it("rejects manual quantities above stock", () => {
    const cart: CartLine[] = [{ product: milk, quantity: 1 }];
    expect(updateCartQuantity(cart, milk.databaseId, 3).ok).toBe(false);
  });

  it("sets a large cashier-entered quantity in one update", () => {
    const bulkMilk = { ...milk, stock: 40 };
    const result = updateCartQuantity([{ product: bulkMilk, quantity: 1 }], bulkMilk.databaseId, 20);

    expect(result).toMatchObject({ ok: true, quantity: 20, cart: [{ quantity: 20 }] });
  });

  it("removes a line when its quantity reaches zero", () => {
    const result = updateCartQuantity([{ product: milk, quantity: 1 }], milk.databaseId, 0);
    expect(result).toMatchObject({ ok: true, quantity: 0, cart: [] });
  });
});
