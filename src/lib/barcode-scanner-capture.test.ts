import { describe, expect, it } from "vitest";
import {
  advanceScannerCapture,
  EMPTY_SCANNER_CAPTURE,
  type ScannerCaptureState,
} from "@/lib/barcode-scanner-capture";

function enterKeys(keys: string[], editable = false, gap = 20) {
  let state: ScannerCaptureState = EMPTY_SCANNER_CAPTURE;
  let at = 1000;
  let barcode: string | undefined;
  let preventDefault = false;

  for (const key of keys) {
    const result = advanceScannerCapture(state, { key, occurredAt: at, targetIsEditable: editable });
    state = result.state;
    barcode = result.barcode ?? barcode;
    preventDefault = result.preventDefault;
    at += gap;
  }

  return { state, barcode, preventDefault };
}

describe("barcode scanner capture", () => {
  it("captures an F9-prefixed scan while an input is focused", () => {
    const result = enterKeys(["F9", ..."4800194185080", "Enter"], true);
    expect(result).toMatchObject({ barcode: "4800194185080", preventDefault: true });
  });

  it("captures a rapid Enter-terminated scan outside editable fields", () => {
    const result = enterKeys([..."INV-000123", "Enter"]);
    expect(result).toMatchObject({ barcode: "INV-000123", preventDefault: true });
  });

  it("captures mixed-case, punctuation, and spaces from a configured scanner", () => {
    const result = enterKeys(["F9", ..."Part 50-A/2", "Enter"], true);
    expect(result).toMatchObject({ barcode: "Part 50-A/2", preventDefault: true });
  });

  it("keeps a prefixed scan active through Shift events used for uppercase letters", () => {
    const result = enterKeys(["F9", "Shift", "K", "5", "0", "0", "0", "0", "3", "Shift", "T", "Enter"], true);
    expect(result).toMatchObject({ barcode: "K500003T", preventDefault: true });
  });

  it("keeps a rapid scan active through modifier and lock-key events", () => {
    const result = enterKeys(["CapsLock", "K", "5", "0", "0", "0", "0", "3", "NumLock", "T", "Enter"]);
    expect(result).toMatchObject({ barcode: "K500003T", preventDefault: true });
  });

  it("does not capture unprefixed input inside an editable field", () => {
    const result = enterKeys([..."4800194185080", "Enter"], true);
    expect(result.barcode).toBeUndefined();
    expect(result.preventDefault).toBe(false);
  });

  it("does not mistake slow keyboard typing for a scan", () => {
    const result = enterKeys([..."4800194185080", "Enter"], false, 150);
    expect(result.barcode).toBeUndefined();
  });

  it("cancels an incomplete prefixed scan with Escape", () => {
    const result = enterKeys(["F9", "4", "8", "Escape"], true);
    expect(result.barcode).toBeUndefined();
    expect(result.state).toEqual(EMPTY_SCANNER_CAPTURE);
  });
});
