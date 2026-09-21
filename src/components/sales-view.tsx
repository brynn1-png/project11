"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Barcode, Camera, CheckCircle, MagnifyingGlass, Minus, Plus, Printer, ShoppingCart, Tag, Trash, WarningCircle, WifiHigh, WifiSlash } from "@phosphor-icons/react";
import { recordSale, type ConfirmedSaleReceipt } from "@/app/sales/actions";
import { CameraScanner } from "@/components/camera-scanner";
import { useInventory } from "@/components/inventory-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SaleReceiptDetails, SaleReceiptPrintSheet } from "@/components/sale-receipt";
import { useBarcodeScannerCapture } from "@/hooks/use-barcode-scanner-capture";
import { processProductBarcode, updateCartQuantity, type CartLine, type SalesScanMode } from "@/lib/sales-cart";
import type { Product } from "@/lib/types";
import { formatQuantity } from "@/lib/units";

function peso(value: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);
}

export function SalesView({ notify }: { notify: (message: string) => void }) {
  const { products, dataSource } = useInventory();
  const router = useRouter();
  const barcodeRef = useRef<HTMLInputElement>(null);
  const quantityShortcutRef = useRef<HTMLInputElement>(null);
  const cartRef = useRef<CartLine[]>([]);
  const lastScannedProductIdRef = useRef<string | null>(null);
  const [barcode, setBarcode] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [notes, setNotes] = useState("");
  const [cashReceived, setCashReceived] = useState("");
  const [message, setMessage] = useState("");
  const [scanStatus, setScanStatus] = useState("");
  const [scanMode, setScanMode] = useState<SalesScanMode>("sale");
  const [priceProduct, setPriceProduct] = useState<Product | null>(null);
  const [lastSale, setLastSale] = useState<ConfirmedSaleReceipt | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [quantityShortcutProductId, setQuantityShortcutProductId] = useState<string | null>(null);
  const [quantityDraft, setQuantityDraft] = useState("");
  const [online, setOnline] = useState(true);
  const [saleKey, setSaleKey] = useState(() => crypto.randomUUID());
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    if (scanMode !== "price" || !priceProduct) return;
    const timer = window.setTimeout(() => {
      setScanMode("sale");
      setPriceProduct(null);
      setBarcode("");
      setMessage("");
    }, 15000);
    return () => window.clearTimeout(timer);
  }, [priceProduct, scanMode]);

  const total = useMemo(() => cart.reduce((sum, line) => sum + line.product.price * line.quantity, 0), [cart]);
  const itemCount = useMemo(() => cart.reduce((sum, line) => sum + line.quantity, 0), [cart]);
  const cashValue = cashReceived === "" ? 0 : Number(cashReceived);
  const paymentReady = Number.isFinite(cashValue) && cashValue >= total && total > 0;
  const changeDue = paymentReady ? Math.round((cashValue - total) * 100) / 100 : 0;
  const quantityShortcutLine = quantityShortcutProductId
    ? cart.find((line) => line.product.databaseId === quantityShortcutProductId) ?? null
    : null;

  function commitCart(next: CartLine[]) {
    cartRef.current = next;
    setCart(next);
    setSaleKey(crypto.randomUUID());
  }

  function focusBarcode(select = false) {
    window.setTimeout(() => {
      barcodeRef.current?.focus();
      if (select) barcodeRef.current?.select();
    }, 0);
  }

  function restoreScanFocus() {
    window.setTimeout(() => {
      if (barcodeRef.current) return barcodeRef.current.focus();
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    }, 0);
  }

  function handleBarcode(value: string, source: "scan" | "manual" = "scan") {
    const result = processProductBarcode(products, cartRef.current, value, scanMode);
    if (!result.ok) {
      setBarcode(source === "manual" ? value.trim() : "");
      setScanStatus("");
      setPriceProduct(null);
      setMessage(result.message);
      if (source === "manual") focusBarcode(true);
      return;
    }

    if (result.mode === "price") {
      setPriceProduct(result.product);
      setBarcode("");
      setManualEntryOpen(false);
      setScanStatus("");
      setMessage("");
      return;
    }

    commitCart(result.cart);
    lastScannedProductIdRef.current = result.product.databaseId;
    setBarcode("");
    setMessage("");
    setLastSale(null);
    setManualEntryOpen(false);
    setQuantityShortcutProductId(null);
    setQuantityDraft("");
    setScanStatus(`Added ${result.product.name} — ${result.quantity} in current sale.`);
  }

  useBarcodeScannerCapture(handleBarcode, !lastSale);

  useEffect(() => {
    if (scanMode !== "sale" || lastSale) return;

    function startQuantityShortcut(event: KeyboardEvent) {
      if (event.key !== "*" || event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;

      const target = event.target;
      const targetIsEditable = target instanceof HTMLElement
        && (target.isContentEditable || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target instanceof HTMLInputElement);
      if (targetIsEditable && target !== barcodeRef.current) return;

      event.preventDefault();
      const productId = lastScannedProductIdRef.current;
      const line = productId ? cartRef.current.find((item) => item.product.databaseId === productId) : null;
      if (!line) {
        setScanStatus("Scan a product before using the quantity shortcut.");
        return;
      }

      setMessage("");
      setScanStatus("");
      setQuantityShortcutProductId(line.product.databaseId);
      setQuantityDraft("");
      window.setTimeout(() => quantityShortcutRef.current?.focus(), 0);
    }

    window.addEventListener("keydown", startQuantityShortcut);
    return () => window.removeEventListener("keydown", startQuantityShortcut);
  }, [lastSale, scanMode]);

  function changeScanMode(value: string) {
    if (value !== "sale" && value !== "price") return;
    setScanMode(value);
    setBarcode("");
    setMessage("");
    setScanStatus("");
    setPriceProduct(null);
    setCameraOpen(false);
    setManualEntryOpen(false);
    setQuantityShortcutProductId(null);
    setQuantityDraft("");
  }

  function finishPriceCheck() {
    setScanMode("sale");
    setPriceProduct(null);
    setBarcode("");
    setMessage("");
  }

  function openManualEntry() {
    setBarcode("");
    setMessage("");
    setManualEntryOpen(true);
    window.setTimeout(() => barcodeRef.current?.focus(), 0);
  }

  function closeManualEntry() {
    setBarcode("");
    setMessage("");
    setManualEntryOpen(false);
  }

  function changeQuantity(productId: string, next: number) {
    const result = updateCartQuantity(cartRef.current, productId, next);
    if (!result.ok) return setMessage(result.message);
    commitCart(result.cart);
    if (result.quantity === 0 && lastScannedProductIdRef.current === productId) lastScannedProductIdRef.current = null;
    setMessage("");
    setScanStatus(result.quantity === 0 ? "Product removed from the current sale." : "Quantity updated.");
  }

  function cancelQuantityShortcut() {
    setQuantityShortcutProductId(null);
    setQuantityDraft("");
    restoreScanFocus();
  }

  function applyQuantityShortcut(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quantityShortcutLine) return cancelQuantityShortcut();

    const quantity = Number(quantityDraft);
    if (!Number.isInteger(quantity) || quantity < 1) {
      setMessage("Enter a whole-number quantity of at least 1.");
      window.setTimeout(() => quantityShortcutRef.current?.select(), 0);
      return;
    }

    const result = updateCartQuantity(cartRef.current, quantityShortcutLine.product.databaseId, quantity);
    if (!result.ok) {
      setMessage(result.message);
      window.setTimeout(() => quantityShortcutRef.current?.select(), 0);
      return;
    }

    commitCart(result.cart);
    setQuantityShortcutProductId(null);
    setQuantityDraft("");
    setMessage("");
    setScanStatus(`Set ${quantityShortcutLine.product.name} quantity to ${result.quantity}.`);
    restoreScanFocus();
  }

  function confirmSale() {
    if (!online || dataSource !== "live") return setMessage("Refresh live inventory before confirming this sale.");
    if (cart.length === 0) return setMessage("Add at least one product before confirming the sale.");
    if (!paymentReady) return setMessage("Cash received must cover the complete sale total.");
    setMessage("");
    setLastSale(null);
    startTransition(async () => {
      const result = await recordSale({
        idempotencyKey: saleKey,
        items: cart.map((line) => ({ productId: line.product.databaseId, quantity: line.quantity })),
        notes,
        cashReceived: cashValue,
      });
      if (!result.ok) return setMessage(result.message);
      setLastSale(result.receipt);
      cartRef.current = [];
      lastScannedProductIdRef.current = null;
      setCart([]);
      setManualEntryOpen(false);
      setQuantityShortcutProductId(null);
      setQuantityDraft("");
      setNotes("");
      setSaleKey(crypto.randomUUID());
      notify(`Sale #${result.receipt.saleNumber} confirmed for ${peso(result.receipt.totalAmount)}.`);
      router.refresh();
    });
  }

  function startNextSale() {
    setLastSale(null); setCashReceived(""); setMessage(""); setScanStatus("");
    lastScannedProductIdRef.current = null;
    setManualEntryOpen(false);
    setQuantityShortcutProductId(null); setQuantityDraft("");
    setSaleKey(crypto.randomUUID());
  }

  if (lastSale) return <div className="mx-auto grid max-w-2xl gap-5"><section className="panel p-5 sm:p-6"><div className="mb-5 flex items-start gap-3 rounded-xl bg-emerald-50 p-4 text-emerald-900"><CheckCircle className="mt-0.5 shrink-0" size={22} weight="fill" /><div><h2 className="font-bold">Sale confirmed</h2><p className="mt-1 text-sm">Give the customer {peso(lastSale.changeDue)} change, then print or save their receipt.</p></div></div><SaleReceiptDetails receipt={lastSale} /><div className="mt-6 flex flex-col-reverse gap-2 border-t border-[var(--border)] pt-5 sm:flex-row sm:justify-end"><Button variant="secondary" onClick={startNextSale}>Start next sale</Button><Button onClick={() => window.print()}><Printer size={17} />Print / Save as PDF</Button></div></section><SaleReceiptPrintSheet receipt={lastSale} /></div>;

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="flex min-w-0 flex-col gap-5">
        <Tabs value={scanMode} onValueChange={changeScanMode}>
          <Card className="border-[var(--border)] bg-[var(--surface)] shadow-none">
            <CardHeader className="flex-row items-start justify-between gap-4">
              <CardTitle>{scanMode === "sale" ? "Scan a product" : "Check a product price"}</CardTitle>
              <Badge variant={online && dataSource === "live" ? "default" : "destructive"} className="shrink-0">
                {online && dataSource === "live" ? <WifiHigh weight="bold" /> : <WifiSlash weight="bold" />}
                {!online ? "Offline" : dataSource === "cached" ? "Cached data" : dataSource === "live" ? "Online" : "Unavailable"}
              </Badge>
            </CardHeader>
            <CardContent>
              <TabsList className="grid w-full grid-cols-2 sm:w-[22rem]">
                <TabsTrigger value="sale"><ShoppingCart />Add to sale</TabsTrigger>
                <TabsTrigger value="price"><Tag />Check price</TabsTrigger>
              </TabsList>

              <TabsContent value="sale" className="mt-5 flex flex-col gap-5">
                <div className="flex flex-col gap-3 sm:flex-row">
                  {!manualEntryOpen && <Button type="button" variant="secondary" onClick={openManualEntry}><Barcode data-icon="inline-start" />Enter barcode manually</Button>}
                  <Button type="button" variant="secondary" onClick={() => setCameraOpen((current) => !current)}>
                    <Camera data-icon="inline-start" />{cameraOpen ? "Hide camera" : "Use camera"}
                  </Button>
                </div>
                {manualEntryOpen && (
                  <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(event) => { event.preventDefault(); handleBarcode(barcode, "manual"); }}>
                    <Field className="flex-1" data-invalid={Boolean(message)}>
                      <FieldLabel htmlFor="sale-manual-barcode">Barcode</FieldLabel>
                      <Input ref={barcodeRef} id="sale-manual-barcode" value={barcode} onChange={(event) => setBarcode(event.target.value)} placeholder="Enter barcode" autoComplete="off" aria-invalid={Boolean(message)} />
                    </Field>
                    <Button type="submit"><Plus data-icon="inline-start" />Add to sale</Button>
                    <Button type="button" variant="ghost" onClick={closeManualEntry}>Cancel</Button>
                  </form>
                )}
                {quantityShortcutLine && (
                  <form className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--muted)] p-3 sm:flex-row sm:items-end" onSubmit={applyQuantityShortcut} aria-label={`Set quantity for ${quantityShortcutLine.product.name}`}>
                    <div className="min-w-0 flex-1 self-center">
                      <p className="text-sm font-semibold">Set quantity for {quantityShortcutLine.product.name}</p>
                      <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{formatQuantity(quantityShortcutLine.product.stock, quantityShortcutLine.product.unit)} available</p>
                    </div>
                    <Field className="sm:w-28">
                      <FieldLabel htmlFor="quantity-shortcut">Quantity</FieldLabel>
                      <Input
                        ref={quantityShortcutRef}
                        id="quantity-shortcut"
                        type="number"
                        inputMode="numeric"
                        min="1"
                        max={quantityShortcutLine.product.stock}
                        step="1"
                        value={quantityDraft}
                        onChange={(event) => setQuantityDraft(event.target.value)}
                        onKeyDown={(event) => { if (event.key === "Escape") cancelQuantityShortcut(); }}
                        aria-describedby="quantity-shortcut-help"
                      />
                    </Field>
                    <div className="flex gap-2">
                      <Button type="submit" className="flex-1 sm:flex-none">Apply quantity</Button>
                      <Button type="button" variant="ghost" className="flex-1 sm:flex-none" onClick={cancelQuantityShortcut}>Cancel</Button>
                    </div>
                    <span id="quantity-shortcut-help" className="sr-only">Enter a whole number no greater than available stock, then press Enter.</span>
                  </form>
                )}
                {cameraOpen && <div className="rounded-2xl border border-[var(--border)] p-4"><CameraScanner onDetected={handleBarcode} /></div>}
                {message && <Alert variant="destructive"><WarningCircle /><AlertTitle>Sale needs attention</AlertTitle><AlertDescription>{message}</AlertDescription></Alert>}
                {!message && <div className="flex min-h-6 items-center gap-2 text-sm" role="status" aria-live="polite">{scanStatus ? <><CheckCircle className="shrink-0 text-[var(--accent)]" size={18} weight="fill" /><span className="font-medium">{scanStatus}</span></> : <><span className="size-2 shrink-0 rounded-full bg-emerald-600" aria-hidden="true" /><span className="font-medium text-[var(--muted-foreground)]">Ready to scan</span></>}</div>}
              </TabsContent>

              <TabsContent value="price" className="mt-5 flex flex-col gap-5">
                <Alert>
                  <Tag />
                  <AlertTitle>Price check mode</AlertTitle>
                  <AlertDescription>Scanned products will not be added to the current sale.</AlertDescription>
                </Alert>
                <div className="flex flex-col gap-3 sm:flex-row">
                  {!manualEntryOpen && <Button type="button" variant="secondary" onClick={openManualEntry}><Barcode data-icon="inline-start" />Enter barcode manually</Button>}
                  <Button type="button" variant="secondary" onClick={() => setCameraOpen((current) => !current)}>
                    <Camera data-icon="inline-start" />{cameraOpen ? "Hide camera" : "Use camera"}
                  </Button>
                </div>
                {manualEntryOpen && (
                  <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(event) => { event.preventDefault(); handleBarcode(barcode, "manual"); }}>
                    <Field className="flex-1" data-invalid={Boolean(message)}>
                      <FieldLabel htmlFor="price-manual-barcode">Barcode</FieldLabel>
                      <Input ref={barcodeRef} id="price-manual-barcode" value={barcode} onChange={(event) => setBarcode(event.target.value)} placeholder="Enter barcode" autoComplete="off" aria-invalid={Boolean(message)} />
                    </Field>
                    <Button type="submit"><MagnifyingGlass data-icon="inline-start" />Check price</Button>
                    <Button type="button" variant="ghost" onClick={closeManualEntry}>Cancel</Button>
                  </form>
                )}
                {cameraOpen && <div className="rounded-2xl border border-[var(--border)] p-4"><CameraScanner onDetected={handleBarcode} /></div>}
                {message && <Alert variant="destructive"><WarningCircle /><AlertTitle>Price unavailable</AlertTitle><AlertDescription>{message}</AlertDescription></Alert>}
                {!message && priceProduct && <section className="rounded-2xl bg-[var(--accent-soft)] p-5 sm:p-6" role="status" aria-live="polite">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold">{priceProduct.name}</h3>
                      {priceProduct.description && <p className="mt-1 text-sm text-[var(--muted-foreground)]">{priceProduct.description}</p>}
                    </div>
                    <Badge variant={priceProduct.stock > 0 ? "default" : "destructive"} className="self-start">{priceProduct.stock > 0 ? "Available" : "Out of stock"}</Badge>
                  </div>
                  <div className="mt-6 flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--muted-foreground)]">Selling price</span>
                    <strong className="text-4xl tracking-[-0.035em] sm:text-5xl">{peso(priceProduct.price)}</strong>
                    <span className="text-sm text-[var(--muted-foreground)]">per {priceProduct.unit}</span>
                  </div>
                  <div className="mt-6 flex justify-end"><Button type="button" variant="secondary" onClick={finishPriceCheck}>Done checking price</Button></div>
                </section>}
                {!message && !priceProduct && <div className="flex min-h-20 items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border)] px-4 text-sm text-[var(--muted-foreground)]" role="status" aria-live="polite"><Barcode size={18} />Ready to check a price.</div>}
              </TabsContent>
            </CardContent>
          </Card>
        </Tabs>
      </div>

      <Card className="border-[var(--border)] bg-[var(--surface)] shadow-none xl:sticky xl:top-24">
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5"><CardTitle>Current sale</CardTitle><CardDescription>{itemCount} item{itemCount === 1 ? "" : "s"} across {cart.length} product{cart.length === 1 ? "" : "s"}</CardDescription></div>
          <ShoppingCart size={22} className="text-[var(--accent)]" />
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {cart.length === 0 ? <p className="py-10 text-center text-sm text-[var(--muted-foreground)]">No products added.</p> : cart.map((line) => (
            <div key={line.product.databaseId} className="flex items-center gap-3 rounded-xl border border-[var(--border)] p-3">
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{line.product.name}</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">{peso(line.product.price * line.quantity)}</p></div>
              <div className="flex items-center gap-1">
                <Button type="button" variant="ghost" size="icon" onClick={() => changeQuantity(line.product.databaseId, line.quantity - 1)} aria-label={`Decrease ${line.product.name} quantity`}><Minus /></Button>
                <Input className="w-16 text-center" type="number" min="1" max={line.product.stock} value={line.quantity} onChange={(event) => changeQuantity(line.product.databaseId, Number(event.target.value))} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); restoreScanFocus(); } }} aria-label={`${line.product.name} quantity`} />
                <Button type="button" variant="ghost" size="icon" onClick={() => changeQuantity(line.product.databaseId, line.quantity + 1)} disabled={line.quantity >= line.product.stock} aria-label={`Increase ${line.product.name} quantity`}><Plus /></Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => changeQuantity(line.product.databaseId, 0)} aria-label={`Remove ${line.product.name}`}><Trash /></Button>
              </div>
            </div>
          ))}
          <Field>
            <FieldLabel htmlFor="sale-notes">Sale notes</FieldLabel>
            <Input id="sale-notes" value={notes} maxLength={500} onChange={(event) => setNotes(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); restoreScanFocus(); } }} placeholder="Optional reference or note" />
          </Field>
        </CardContent>
        <Separator />
        <CardFooter className="flex-col items-stretch gap-4 pt-6">
          <div className="flex items-end justify-between"><span className="text-sm text-[var(--muted-foreground)]">Total</span><strong className="text-2xl tracking-[-0.03em]">{peso(total)}</strong></div>
          <div className="grid gap-3 border-t border-[var(--border)] pt-4"><div className="flex items-end gap-2"><Field className="flex-1"><FieldLabel htmlFor="cash-received">Cash received</FieldLabel><Input id="cash-received" type="number" min="0.01" max="100000000" step="0.01" inputMode="decimal" value={cashReceived} onChange={(event) => { setCashReceived(event.target.value); setMessage(""); }} placeholder="0.00" /></Field><Button type="button" variant="secondary" onClick={() => setCashReceived(total.toFixed(2))} disabled={cart.length === 0}>Exact</Button></div><div className="flex justify-between text-sm"><span className="text-[var(--muted-foreground)]">Change</span><strong className={paymentReady ? "text-[var(--accent-strong)]" : ""}>{peso(changeDue)}</strong></div>{cashReceived !== "" && !paymentReady && <p className="text-xs font-medium text-red-700">Cash received is {peso(Math.max(0, total - (Number.isFinite(cashValue) ? cashValue : 0)))} short.</p>}</div>
          <Button size="lg" onClick={confirmSale} disabled={cart.length === 0 || !paymentReady || isPending || !online || dataSource !== "live"}>
            <CheckCircle data-icon="inline-start" weight="bold" />{isPending ? "Completing sale…" : "Complete sale"}
          </Button>
          {(!online || dataSource !== "live") && <p className="text-center text-xs text-[var(--muted-foreground)]">Product lookup remains available, but sale confirmation requires current live inventory.</p>}
        </CardFooter>
      </Card>
    </div>
  );
}
