"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

export function BarcodeLabel({ value, compact = false }: { value: string; compact?: boolean }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      JsBarcode(ref.current, value, {
        format: "CODE128",
        width: compact ? 1.25 : 2,
        height: compact ? 28 : 54,
        margin: 0,
        displayValue: !compact,
        font: "Figtree",
        fontSize: 13,
      });
    } catch {
      ref.current.replaceChildren();
    }
  }, [value, compact]);

  return <svg ref={ref} role="img" aria-label={`Barcode ${value}`} className="max-w-full" />;
}

