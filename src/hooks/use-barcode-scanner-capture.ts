"use client";

import { useEffect, useRef } from "react";
import {
  advanceScannerCapture,
  EMPTY_SCANNER_CAPTURE,
  SCANNER_SESSION_TIMEOUT_MS,
  type ScannerCaptureState,
} from "@/lib/barcode-scanner-capture";

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement;
}

export function useBarcodeScannerCapture(onScan: (barcode: string) => void, enabled = true) {
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;
    let state: ScannerCaptureState = EMPTY_SCANNER_CAPTURE;
    let resetTimer: number | undefined;

    function scheduleReset() {
      window.clearTimeout(resetTimer);
      if (state.mode === "idle") return;
      resetTimer = window.setTimeout(() => {
        state = EMPTY_SCANNER_CAPTURE;
      }, SCANNER_SESSION_TIMEOUT_MS);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.repeat) return;
      const result = advanceScannerCapture(state, {
        key: event.key,
        occurredAt: event.timeStamp,
        targetIsEditable: isEditableTarget(event.target),
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
      });
      state = result.state;
      scheduleReset();

      if (result.preventDefault) {
        event.preventDefault();
        event.stopPropagation();
      }
      if (result.barcode) onScanRef.current(result.barcode);
    }

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.clearTimeout(resetTimer);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [enabled]);
}
