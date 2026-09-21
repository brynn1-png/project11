import type { Product } from "@/lib/types";
import { findBarcodeMatch, normalizeBarcodeValue } from "@/lib/barcode-values";

export function findReceivingProduct(products: Product[], value: string) {
  const normalized = normalizeBarcodeValue(value);
  if (!normalized) return null;
  return findBarcodeMatch(products, value, (product) => product.barcode)
    ?? products.find((product) => product.id.toLowerCase() === normalized)
    ?? null;
}

export function shouldResetReceivingDraft(currentProductId: string, nextProductId: string) {
  return currentProductId !== "" && currentProductId !== nextProductId;
}
