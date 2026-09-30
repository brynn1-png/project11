import { describe, expect, it } from "vitest";
import {
  barcodeLookupKeys,
  barcodeValuesMatch,
  sanitizeScannedBarcode,
} from "@/lib/barcode-values";

describe("sanitizeScannedBarcode", () => {
  it("keeps a plain scanned code unchanged apart from surrounding space", () => {
    expect(sanitizeScannedBarcode(" 4800194185080 ")).toBe("4800194185080");
  });

  it("preserves the scanned casing", () => {
    expect(sanitizeScannedBarcode("Inv-000123")).toBe("Inv-000123");
  });

  it("removes the AIM symbology identifier sent by configured scanners", () => {
    expect(sanitizeScannedBarcode("]C04800194185080")).toBe("4800194185080");
  });

  it("removes GS1 group separators so the value passes printable-only validation", () => {
    expect(sanitizeScannedBarcode("01034531200000111719112510ABCD\u001D1\u001D")).toBe("01034531200000111719112510ABCD1");
  });

  it("removes control characters that would otherwise be rejected on save", () => {
    expect(sanitizeScannedBarcode("INV\u0001-000123\u007F")).toBe("INV-000123");
  });
});

describe("barcode matching", () => {
  it("treats 12 and 13 digit equivalents as the same barcode", () => {
    expect(barcodeValuesMatch("012345678905", "0012345678905")).toBe(true);
  });

  it("still matches codes that only differ by case or padding space", () => {
    expect(barcodeValuesMatch("inv-000123", " INV-000123 ")).toBe(true);
  });

  it("does not match unrelated codes", () => {
    expect(barcodeValuesMatch("inv-000123", "inv-000124")).toBe(false);
  });

  it("keeps both the raw and transport-cleaned lookup keys", () => {
    expect(barcodeLookupKeys("]E04800194185080")).toEqual(
      expect.arrayContaining(["]e04800194185080", "4800194185080"]),
    );
  });
});
