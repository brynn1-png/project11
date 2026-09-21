import type { Product } from "@/lib/types";
import { formatQuantity } from "@/lib/units";
import { findBarcodeMatch, normalizeBarcodeValue } from "@/lib/barcode-values";

export type CartLine = { product: Product; quantity: number };
export type SalesScanMode = "sale" | "price";

type CartResult =
  | { ok: true; cart: CartLine[]; quantity: number }
  | { ok: false; message: string };

type ProductScanResult =
  | { ok: true; mode: "price"; product: Product }
  | { ok: true; mode: "sale"; product: Product; cart: CartLine[]; quantity: number }
  | { ok: false; message: string };

export function processProductBarcode(products: Product[], cart: CartLine[], barcode: string, mode: SalesScanMode): ProductScanResult {
  const clean = normalizeBarcodeValue(barcode);
  const product = findBarcodeMatch(products, barcode, (item) => item.barcode);

  if (!clean || !product) {
    return { ok: false, message: clean ? "No active product matches this barcode." : "Scan or enter a barcode first." };
  }
  if (mode === "price") return { ok: true, mode, product };

  const result = addProductToCart(cart, product);
  return result.ok
    ? { ok: true, mode, product, cart: result.cart, quantity: result.quantity }
    : result;
}

export function addProductToCart(cart: CartLine[], product: Product): CartResult {
  const existing = cart.find((line) => line.product.databaseId === product.databaseId);
  const nextQuantity = (existing?.quantity ?? 0) + 1;

  if (product.stock < 1) {
    return { ok: false, message: `${product.name} is out of stock.` };
  }
  if (nextQuantity > product.stock) {
    return { ok: false, message: `Only ${formatQuantity(product.stock, product.unit)} are available.` };
  }

  return {
    ok: true,
    quantity: nextQuantity,
    cart: existing
      ? cart.map((line) => line.product.databaseId === product.databaseId ? { ...line, quantity: nextQuantity } : line)
      : [...cart, { product, quantity: 1 }],
  };
}

export function updateCartQuantity(cart: CartLine[], productId: string, nextQuantity: number): CartResult {
  const line = cart.find((item) => item.product.databaseId === productId);
  if (!line) return { ok: false, message: "That product is no longer in the current sale." };
  if (!Number.isInteger(nextQuantity)) return { ok: false, message: "Quantity must be a whole number." };
  if (nextQuantity <= 0) {
    return { ok: true, quantity: 0, cart: cart.filter((item) => item.product.databaseId !== productId) };
  }
  if (nextQuantity > line.product.stock) {
    return { ok: false, message: `Only ${formatQuantity(line.product.stock, line.product.unit)} are available.` };
  }

  return {
    ok: true,
    quantity: nextQuantity,
    cart: cart.map((item) => item.product.databaseId === productId ? { ...item, quantity: nextQuantity } : item),
  };
}
