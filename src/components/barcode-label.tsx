"use client";

import { useEffect, useId, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { Printer } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type LabelProduct = { name: string; barcode: string; productCode: string };

function BarcodeSvg({ product }: { product: LabelProduct }) {
  const ref = useRef<SVGSVGElement>(null);
  const id = useId();

  useEffect(() => {
    if (!ref.current) return;
    JsBarcode(ref.current, product.barcode, {
      format: "CODE128",
      displayValue: true,
      font: "monospace",
      fontSize: 13,
      height: 52,
      margin: 8,
      width: 1.7,
    });
  }, [product.barcode]);

  return <svg ref={ref} aria-labelledby={id} role="img"><title id={id}>Barcode {product.barcode}</title></svg>;
}

export function BarcodeGenerationPreview({ productName }: { productName: string }) {
  const previewProduct: LabelProduct = {
    name: productName.trim() || "Your product name",
    barcode: "INV-######",
    productCode: "Assigned after registration",
  };

  return (
    <figure className="border-t border-[var(--border)] pt-4" aria-labelledby="generated-barcode-preview-title">
      <div className="flex items-center justify-between gap-3">
        <figcaption id="generated-barcode-preview-title" className="text-sm font-bold">Generated label preview</figcaption>
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-900">Preview only</span>
      </div>
      <div className="mt-4 bg-white py-3 text-center">
        <p className="truncate text-sm font-bold">{previewProduct.name}</p>
        <div className="mt-2 flex justify-center overflow-hidden"><BarcodeSvg product={previewProduct} /></div>
      </div>
      <p className="mt-3 text-xs leading-5 text-[var(--muted-foreground)]">The actual unique `INV-######` number is assigned after registration. Only the saved barcode can be printed and used for inventory.</p>
    </figure>
  );
}

export function BarcodePrintPanel({ product, onClose, onReceive }: { product: LabelProduct; onClose: () => void; onReceive?: () => void }) {
  const [format, setFormat] = useState<"single" | "sheet">("single");
  const [copies, setCopies] = useState(1);

  function print() {
    document.documentElement.dataset.barcodePrint = format;
    window.print();
    window.setTimeout(() => { delete document.documentElement.dataset.barcodePrint; }, 100);
  }

  const count = format === "single" ? Math.min(Math.max(copies, 1), 10) : Math.min(Math.max(copies, 1), 30);
  return (
    <section className="panel overflow-hidden" aria-labelledby="barcode-print-title">
      <div className="flex flex-col gap-4 border-b border-[var(--border)] p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--accent)]">Printable label</p>
          <h2 id="barcode-print-title" className="mt-1 text-lg font-bold">{product.name}</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">Code 128 · {product.productCode}</p>
        </div>
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </div>
      <div className="grid gap-6 p-5 lg:grid-cols-[minmax(280px,.8fr)_1fr] lg:items-center">
        <div className="barcode-label-preview mx-auto w-full max-w-sm border border-dashed border-[var(--border)] bg-white p-4 text-center">
          <p className="truncate text-sm font-bold">{product.name}</p>
          <p className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">{product.productCode}</p>
          <div className="mt-2 flex justify-center overflow-hidden"><BarcodeSvg product={product} /></div>
        </div>
        <div className="grid gap-4">
          <fieldset>
            <legend className="field-label">Print layout</legend>
            <div className="grid grid-cols-2 gap-2">
              {([['single', 'Individual labels'], ['sheet', 'A4 label sheet']] as const).map(([value, label]) => (
                <label key={value} className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-semibold ${format === value ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "border-[var(--border)] bg-white"}`}>
                  <input className="accent-[var(--accent)]" type="radio" name="label-format" value={value} checked={format === value} onChange={() => { setFormat(value); setCopies(value === "sheet" ? 24 : 1); }} />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <div><label className="field-label" htmlFor="label-copies">Number of labels</label><Input id="label-copies" type="number" min="1" max={format === "single" ? 10 : 30} value={copies} onChange={(event) => setCopies(Number(event.target.value))} /></div>
        <div className="flex flex-col gap-2 sm:flex-row"><Button className="flex-1" onClick={print}><Printer size={17} />Print {count} {count === 1 ? "label" : "labels"}</Button>{onReceive && <Button className="flex-1" variant="secondary" onClick={onReceive}>Receive opening stock</Button>}</div>
        </div>
      </div>
      <div className={`barcode-print-sheet barcode-layout-${format}`} aria-hidden="true">
        {Array.from({ length: count }, (_, index) => (
          <div className="barcode-print-label" key={index}>
            <p>{product.name}</p><small>{product.productCode}</small><BarcodeSvg product={product} />
          </div>
        ))}
      </div>
    </section>
  );
}
