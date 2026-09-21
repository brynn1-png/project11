import { BARCODE_MIN_LENGTH } from "@/lib/barcode-values";

export const SCANNER_PREFIX_KEY = "F9";
export const SCANNER_MAX_CHARACTER_GAP_MS = 80;
export const SCANNER_SESSION_TIMEOUT_MS = 1200;
export const SCANNER_MIN_LENGTH = BARCODE_MIN_LENGTH;

export type ScannerCaptureState = {
  mode: "idle" | "prefixed" | "timed";
  buffer: string;
  lastKeyAt: number;
};

export type ScannerKey = {
  key: string;
  occurredAt: number;
  targetIsEditable: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
};

export type ScannerCaptureResult = {
  state: ScannerCaptureState;
  barcode?: string;
  preventDefault: boolean;
};

export const EMPTY_SCANNER_CAPTURE: ScannerCaptureState = {
  mode: "idle",
  buffer: "",
  lastKeyAt: 0,
};

const MODIFIER_ONLY_KEYS = new Set([
  "Shift",
  "Control",
  "Alt",
  "AltGraph",
  "Meta",
  "CapsLock",
  "NumLock",
  "ScrollLock",
]);

function isBarcodeCharacter(event: ScannerKey) {
  const codePoint = event.key.codePointAt(0) ?? 0;
  return event.key.length === 1
    && codePoint >= 0x20
    && codePoint <= 0x7e
    && !event.altKey
    && !event.ctrlKey
    && !event.metaKey;
}

export function advanceScannerCapture(state: ScannerCaptureState, event: ScannerKey): ScannerCaptureResult {
  if (event.key === SCANNER_PREFIX_KEY && !event.altKey && !event.ctrlKey && !event.metaKey) {
    return {
      state: { mode: "prefixed", buffer: "", lastKeyAt: event.occurredAt },
      preventDefault: true,
    };
  }

  if (MODIFIER_ONLY_KEYS.has(event.key)) {
    return { state, preventDefault: false };
  }

  if (state.mode === "prefixed") {
    const expired = event.occurredAt - state.lastKeyAt > SCANNER_SESSION_TIMEOUT_MS;
    if (expired) return { state: EMPTY_SCANNER_CAPTURE, preventDefault: false };

    if (event.key === "Escape") return { state: EMPTY_SCANNER_CAPTURE, preventDefault: true };
    if (event.key === "Backspace") {
      return {
        state: { ...state, buffer: state.buffer.slice(0, -1), lastKeyAt: event.occurredAt },
        preventDefault: true,
      };
    }
    if (event.key === "Enter") {
      return {
        state: EMPTY_SCANNER_CAPTURE,
        barcode: state.buffer.length >= SCANNER_MIN_LENGTH ? state.buffer : undefined,
        preventDefault: true,
      };
    }
    if (isBarcodeCharacter(event)) {
      return {
        state: { ...state, buffer: state.buffer + event.key, lastKeyAt: event.occurredAt },
        preventDefault: true,
      };
    }
    return { state: EMPTY_SCANNER_CAPTURE, preventDefault: false };
  }

  if (event.targetIsEditable) return { state: EMPTY_SCANNER_CAPTURE, preventDefault: false };

  if (isBarcodeCharacter(event)) {
    const continuesTimedScan = state.mode === "timed"
      && event.occurredAt - state.lastKeyAt <= SCANNER_MAX_CHARACTER_GAP_MS;
    return {
      state: {
        mode: "timed",
        buffer: continuesTimedScan ? state.buffer + event.key : event.key,
        lastKeyAt: event.occurredAt,
      },
      preventDefault: false,
    };
  }

  if (event.key === "Enter" && state.mode === "timed") {
    const completedInTime = event.occurredAt - state.lastKeyAt <= SCANNER_MAX_CHARACTER_GAP_MS;
    return {
      state: EMPTY_SCANNER_CAPTURE,
      barcode: completedInTime && state.buffer.length >= SCANNER_MIN_LENGTH ? state.buffer : undefined,
      preventDefault: completedInTime && state.buffer.length >= SCANNER_MIN_LENGTH,
    };
  }

  return { state: EMPTY_SCANNER_CAPTURE, preventDefault: false };
}
