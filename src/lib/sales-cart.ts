import type { Product } from "@/lib/types";
import { formatQuantity } from "@/lib/units";

export type CartLine = { product: Product; quantity: number };

type CartResult =
  | { ok: true; cart: CartLine[]; quantity: number }
  | { ok: false; message: string };

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
