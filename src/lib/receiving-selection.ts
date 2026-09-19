import type { Product } from "@/lib/types";

export function findReceivingProduct(products: Product[], value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  return products.find((product) => (
    product.barcode.toLowerCase() === normalized
    || product.id.toLowerCase() === normalized
  )) ?? null;
}

export function shouldResetReceivingDraft(currentProductId: string, nextProductId: string) {
  return currentProductId !== "" && currentProductId !== nextProductId;
}
