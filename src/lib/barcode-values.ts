export const BARCODE_MIN_LENGTH = 4;
export const BARCODE_MAX_LENGTH = 64;
export const PRINTABLE_BARCODE_PATTERN = /^[\x20-\x7E]+$/;

const AIM_SYMBOLOGY_IDENTIFIER = /^\][A-Za-z][0-9]/;
const GS1_GROUP_SEPARATOR = /\x1D/g;

export function normalizeBarcodeValue(value: string) {
  return value.trim().toLowerCase();
}

export function barcodeLookupKeys(value: string) {
  const normalized = normalizeBarcodeValue(value);
  if (!normalized) return [];

  const keys = new Set([normalized]);
  const transportClean = normalized
    .replace(AIM_SYMBOLOGY_IDENTIFIER, "")
    .replace(GS1_GROUP_SEPARATOR, "");
  keys.add(transportClean);
  if (/^\d{12}$/.test(transportClean)) keys.add(`0${transportClean}`);
  if (/^0\d{12}$/.test(transportClean)) keys.add(transportClean.slice(1));
  return [...keys];
}

export function barcodeValuesMatch(left: string, right: string) {
  const rightKeys = new Set(barcodeLookupKeys(right));
  return barcodeLookupKeys(left).some((key) => rightKeys.has(key));
}

export function findBarcodeMatch<T>(items: T[], scannedValue: string, barcodeFor: (item: T) => string) {
  const normalizedScan = normalizeBarcodeValue(scannedValue);
  if (!normalizedScan) return null;

  const exact = items.find((item) => normalizeBarcodeValue(barcodeFor(item)) === normalizedScan);
  if (exact) return exact;

  const equivalent = items.filter((item) => barcodeValuesMatch(barcodeFor(item), scannedValue));
  return equivalent.length === 1 ? equivalent[0] : null;
}
