"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, Barcode, CheckCircle, Plus, Warning } from "@phosphor-icons/react";
import { receiveInventoryStock } from "@/app/inventory/actions";
import { useInventory } from "@/components/inventory-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function StockInView({ initialProductId, canRegisterProduct, showMargin, notify, onRegisterProduct }: { initialProductId: string | null; canRegisterProduct: boolean; showMargin: boolean; notify: (message: string) => void; onRegisterProduct: () => void }) {
  const { products, dataSource } = useInventory();
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(initialProductId ?? "");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [manufacturedAt, setManufacturedAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [deliveryReference, setDeliveryReference] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmation, setConfirmation] = useState<{ receivingNumber: string; batchNumber: string; previousQuantity: number; resultingQuantity: number } | null>(null);
  const [isPending, startTransition] = useTransition();
  const selected = useMemo(() => products.find((product) => product.databaseId === selectedId) ?? null, [products, selectedId]);

  const cost = Number(unitCost);
  const margin = selected && selected.price > 0 && cost > 0 ? ((selected.price - cost) / selected.price) * 100 : null;

  function chooseProduct(productId: string) {
    setSelectedId(productId);
    setExpiresAt("");
    setManufacturedAt("");
    setConfirmation(null);
    setError("");
  }

  function findProduct(event: React.FormEvent) {
    event.preventDefault();
    const normalized = query.trim().toLowerCase();
    const match = products.find((product) => product.barcode.toLowerCase() === normalized || product.id.toLowerCase() === normalized);
    if (!match) { setError("No active product matches that barcode or product code."); return; }
    chooseProduct(match.databaseId); setQuery(match.barcode);
  }

  function receive(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) { setError("Select a product before receiving stock."); return; }
    if (dataSource !== "live") { setError("A live database connection is required to receive stock."); return; }
    setError(""); setConfirmation(null);
    startTransition(async () => {
      const result = await receiveInventoryStock({ productId: selected.databaseId, quantity: Number(quantity), unitCost: Number(unitCost), batchNumber, manufacturedAt: manufacturedAt || undefined, expiresAt: expiresAt || undefined, deliveryReference, notes, expiryTracking: selected.expiryTracking });
      if (!result.ok) { setError(result.message); return; }
      setConfirmation(result); setQuantity("1"); setUnitCost(""); setBatchNumber(""); setManufacturedAt(""); setExpiresAt(""); setDeliveryReference(""); setNotes(""); notify(`Receipt #${result.receivingNumber} added ${result.resultingQuantity - result.previousQuantity} ${selected.unit}${result.resultingQuantity - result.previousQuantity === 1 ? "" : "s"}.`); router.refresh();
    });
  }

  return <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(380px,.82fr)]">
    <section className="panel p-5 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="font-bold">Find a product</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">Scan its barcode, enter its code, or select it from the catalog.</p></div>{canRegisterProduct && <Button type="button" variant="secondary" className="shrink-0" onClick={onRegisterProduct}><Plus size={17} />Register new product</Button>}</div>
      <form className="mt-5 flex gap-2" onSubmit={findProduct}><div className="relative flex-1"><Barcode className="absolute left-3.5 top-3.5 text-[var(--muted-foreground)]" size={18} /><Input className="pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Barcode or PRD code" aria-label="Barcode or product code" /></div><Button type="submit">Find</Button></form>
      <div className="mt-3"><select className="select-field" value={selectedId} onChange={(event) => chooseProduct(event.target.value)} aria-label="Choose an existing product"><option value="">Choose a product</option>{products.map((product) => <option key={product.databaseId} value={product.databaseId}>{product.name} · {product.id}</option>)}</select></div>
      {selected ? <div className="mt-6 border-t border-[var(--border)] pt-6"><div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.07em] text-[var(--accent)]">{selected.id}</p><h3 className="mt-1 text-lg font-bold">{selected.name}</h3><p className="mt-1 font-mono text-xs text-[var(--muted-foreground)]">{selected.barcode}</p><p className="mt-3 text-sm text-[var(--muted-foreground)]">{selected.packageSize} {selected.packageUnit} per {selected.unit} · {selected.category}</p></div><div className="sm:text-right"><p className="text-3xl font-bold">{selected.stock}</p><p className="text-xs text-[var(--muted-foreground)]">{selected.unit}{selected.stock === 1 ? "" : "s"} available</p></div></div><div className="mt-5 flex items-center gap-2 text-sm"><span className={`size-2 rounded-full ${selected.expiryTracking === "required" ? "bg-amber-500" : "bg-emerald-500"}`} /><span>{selected.expiryTracking === "required" ? "Expiry date required for each batch" : "This product does not track expiry"}</span></div></div> : <div className="mt-6 rounded-2xl border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--muted-foreground)]">Select the product being delivered.</div>}
    </section>
    <form className="rounded-2xl bg-[#153a2c] p-5 text-white sm:p-6" onSubmit={receive}><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-emerald-300 text-[#153a2c]"><ArrowDown size={21} weight="bold" /></span><div><h2 className="font-bold">Receive one batch</h2><p className="text-sm text-white/55">Quantity and purchase price are required</p></div></div>
      <div className="mt-7 grid gap-5"><div className="grid grid-cols-2 gap-3"><div><label className="mb-2 block text-sm font-semibold" htmlFor="receive-quantity">Quantity</label><Input id="receive-quantity" className="border-white/20 bg-white/10 text-white placeholder:text-white/40" type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} required /></div><div><label className="mb-2 block text-sm font-semibold" htmlFor="receive-cost">Purchase price / {selected?.unit ?? "unit"}</label><Input id="receive-cost" className="border-white/20 bg-white/10 text-white placeholder:text-white/40" type="number" min="0.01" step="0.01" value={unitCost} onChange={(event) => setUnitCost(event.target.value)} required /></div></div>
        {showMargin && selected && margin !== null && margin < 10 && <div className={`flex gap-2 rounded-xl p-3 text-sm ${margin < 0 ? "bg-red-400/20 text-red-100" : "bg-amber-300/15 text-amber-100"}`}><Warning className="mt-0.5 shrink-0" size={17} /><span>{margin < 0 ? "Purchase price is above the selling price." : `Estimated gross margin is only ${margin.toFixed(1)}%.`} Selling price remains unchanged.</span></div>}
        <div><label className="mb-2 block text-sm font-semibold" htmlFor="receive-batch">Supplier batch / lot <span className="font-normal text-white/50">(optional)</span></label><Input id="receive-batch" className="border-white/20 bg-white/10 text-white placeholder:text-white/40" value={batchNumber} onChange={(event) => setBatchNumber(event.target.value)} placeholder="Generated automatically if blank" maxLength={80} /></div>
        <div className="grid grid-cols-2 gap-3"><div><label className="mb-2 block text-sm font-semibold" htmlFor="manufactured-at">Manufactured <span className="font-normal text-white/50">(optional)</span></label><Input id="manufactured-at" className="border-white/20 bg-white/10 text-white scheme-dark" type="date" value={manufacturedAt} onChange={(event) => setManufacturedAt(event.target.value)} /></div><div><label className="mb-2 block text-sm font-semibold" htmlFor="expires-at">Expiry {selected?.expiryTracking === "required" ? "*" : ""}</label><Input id="expires-at" className="border-white/20 bg-white/10 text-white scheme-dark" type="date" min={new Date().toISOString().slice(0, 10)} value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} required={selected?.expiryTracking === "required"} disabled={selected?.expiryTracking !== "required"} /></div></div>
        <div><label className="mb-2 block text-sm font-semibold" htmlFor="delivery-reference">Delivery / invoice reference <span className="font-normal text-white/50">(optional)</span></label><Input id="delivery-reference" className="border-white/20 bg-white/10 text-white placeholder:text-white/40" value={deliveryReference} onChange={(event) => setDeliveryReference(event.target.value)} maxLength={120} /></div>
        <div><label className="mb-2 block text-sm font-semibold" htmlFor="receive-notes">Notes <span className="font-normal text-white/50">(optional)</span></label><Textarea id="receive-notes" className="min-h-20 rounded-xl border-white/20 bg-white/10 text-white placeholder:text-white/40" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} placeholder="Delivery condition or receiving note" /></div>
        {error && <div role="alert" className="rounded-xl bg-red-400/15 p-3 text-sm font-medium text-red-100">{error}</div>}
        {confirmation && <div className="flex gap-3 rounded-xl bg-emerald-300/15 p-3 text-sm text-emerald-100"><CheckCircle className="mt-0.5 shrink-0" size={18} weight="fill" /><div><strong>Receipt #{confirmation.receivingNumber} confirmed</strong><p className="mt-0.5 text-emerald-100/75">Batch {confirmation.batchNumber} · {confirmation.previousQuantity} → {confirmation.resultingQuantity}</p></div></div>}
        <Button className="w-full" type="submit" disabled={!selected || isPending || dataSource !== "live"}>{isPending ? "Receiving…" : "Confirm stock receipt"}</Button>
      </div>
    </form>
  </div>;
}
