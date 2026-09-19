"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Barcode, Camera, CheckCircle, Minus, Plus, ShoppingCart, Trash, WarningCircle, WifiHigh, WifiSlash } from "@phosphor-icons/react";
import { recordSale } from "@/app/sales/actions";
import { CameraScanner } from "@/components/camera-scanner";
import { useInventory } from "@/components/inventory-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useBarcodeScannerCapture } from "@/hooks/use-barcode-scanner-capture";
import { addProductToCart, updateCartQuantity, type CartLine } from "@/lib/sales-cart";

function peso(value: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);
}

export function SalesView({ notify }: { notify: (message: string) => void }) {
  const { products, dataSource } = useInventory();
  const router = useRouter();
  const barcodeRef = useRef<HTMLInputElement>(null);
  const cartRef = useRef<CartLine[]>([]);
  const [barcode, setBarcode] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [scanStatus, setScanStatus] = useState("");
  const [lastSale, setLastSale] = useState<{ number: string; total: number } | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
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

  const total = useMemo(() => cart.reduce((sum, line) => sum + line.product.price * line.quantity, 0), [cart]);
  const itemCount = useMemo(() => cart.reduce((sum, line) => sum + line.quantity, 0), [cart]);

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

  function addBarcodeToCart(value: string) {
    const clean = value.trim();
    const product = products.find((item) => item.barcode === clean) ?? null;
    if (!clean || !product) {
      setBarcode(clean);
      setScanStatus("");
      setMessage(clean ? "No active product matches this barcode." : "Scan or enter a barcode first.");
      focusBarcode(true);
      return;
    }

    const result = addProductToCart(cartRef.current, product);
    if (!result.ok) {
      setBarcode(clean);
      setScanStatus("");
      setMessage(result.message);
      focusBarcode(true);
      return;
    }

    commitCart(result.cart);
    setBarcode("");
    setMessage("");
    setLastSale(null);
    setScanStatus(`Added ${product.name} — ${result.quantity} in current sale.`);
    focusBarcode();
  }

  useBarcodeScannerCapture(addBarcodeToCart);

  function changeQuantity(productId: string, next: number) {
    const result = updateCartQuantity(cartRef.current, productId, next);
    if (!result.ok) return setMessage(result.message);
    commitCart(result.cart);
    setMessage("");
    setScanStatus(result.quantity === 0 ? "Product removed from the current sale." : "Quantity updated.");
  }

  function confirmSale() {
    if (!online || dataSource !== "live") return setMessage("Refresh live inventory before confirming this sale.");
    if (cart.length === 0) return setMessage("Add at least one product before confirming the sale.");
    setMessage("");
    setLastSale(null);
    startTransition(async () => {
      const result = await recordSale({
        idempotencyKey: saleKey,
        items: cart.map((line) => ({ productId: line.product.databaseId, quantity: line.quantity })),
        notes,
      });
      if (!result.ok) return setMessage(result.message);
      setLastSale({ number: result.saleNumber, total: result.totalAmount });
      cartRef.current = [];
      setCart([]);
      setNotes("");
      setSaleKey(crypto.randomUUID());
      notify(`Sale #${result.saleNumber} confirmed for ${peso(result.totalAmount)}.`);
      router.refresh();
      window.setTimeout(() => barcodeRef.current?.focus(), 0);
    });
  }

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="flex min-w-0 flex-col gap-5">
        <Card className="border-[var(--border)] bg-[var(--surface)] shadow-none">
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-1.5">
              <CardTitle>Scan a product</CardTitle>
              <CardDescription>Scan to add one item. Scan again or edit its quantity in the current sale.</CardDescription>
            </div>
            <Badge variant={online && dataSource === "live" ? "default" : "destructive"} className="shrink-0">
              {online && dataSource === "live" ? <WifiHigh weight="bold" /> : <WifiSlash weight="bold" />}
              {!online ? "Offline" : dataSource === "cached" ? "Cached data" : dataSource === "live" ? "Online" : "Unavailable"}
            </Badge>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <form className="flex flex-col gap-3 sm:flex-row" onSubmit={(event) => { event.preventDefault(); addBarcodeToCart(barcode); }}>
              <div className="relative flex-1">
                <Barcode className="absolute left-3.5 top-3.5 text-[var(--muted-foreground)]" size={18} />
                <Input ref={barcodeRef} className="pl-10" value={barcode} onChange={(event) => setBarcode(event.target.value)} placeholder="Scan or enter barcode" aria-label="Product barcode" autoFocus />
              </div>
              <Button type="submit"><Plus data-icon="inline-start" />Add to sale</Button>
              <Button type="button" variant="secondary" onClick={() => setCameraOpen((current) => !current)}>
                <Camera data-icon="inline-start" />{cameraOpen ? "Hide camera" : "Use camera"}
              </Button>
            </form>
            <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
              Scan anywhere: configure the USB scanner to send <kbd className="rounded border border-[var(--border)] bg-[var(--muted)] px-1.5 py-0.5 font-mono text-[0.6875rem] text-[var(--foreground)]">F9</kbd> before the barcode and <kbd className="rounded border border-[var(--border)] bg-[var(--muted)] px-1.5 py-0.5 font-mono text-[0.6875rem] text-[var(--foreground)]">Enter</kbd> after it.
            </p>

            {cameraOpen && <div className="rounded-2xl border border-[var(--border)] p-4"><CameraScanner onDetected={addBarcodeToCart} /></div>}

            {message && <Alert variant="destructive"><WarningCircle /><AlertTitle>Sale needs attention</AlertTitle><AlertDescription>{message}</AlertDescription></Alert>}

            {lastSale && <Alert><CheckCircle /><AlertTitle>Sale #{lastSale.number} confirmed</AlertTitle><AlertDescription>{peso(lastSale.total)} was recorded. Use sale number {lastSale.number} if any item is returned.</AlertDescription></Alert>}
            {!message && <div className="flex min-h-6 items-center gap-2 text-sm" role="status" aria-live="polite">{scanStatus ? <><CheckCircle className="shrink-0 text-[var(--accent)]" size={18} weight="fill" /><span className="font-medium">{scanStatus}</span></> : <><Barcode className="shrink-0 text-[var(--muted-foreground)]" size={18} /><span className="text-[var(--muted-foreground)]">Ready for the next barcode.</span></>}</div>}
          </CardContent>
        </Card>
      </div>

      <Card className="border-[var(--border)] bg-[var(--surface)] shadow-none xl:sticky xl:top-24">
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5"><CardTitle>Current sale</CardTitle><CardDescription>{itemCount} item{itemCount === 1 ? "" : "s"} across {cart.length} product{cart.length === 1 ? "" : "s"}</CardDescription></div>
          <ShoppingCart size={22} className="text-[var(--accent)]" />
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {cart.length === 0 ? <p className="py-10 text-center text-sm text-[var(--muted-foreground)]">Scanned products will collect here until you confirm the sale.</p> : cart.map((line) => (
            <div key={line.product.databaseId} className="flex items-center gap-3 rounded-xl border border-[var(--border)] p-3">
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{line.product.name}</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">{peso(line.product.price * line.quantity)}</p></div>
              <div className="flex items-center gap-1">
                <Button type="button" variant="ghost" size="icon" onClick={() => changeQuantity(line.product.databaseId, line.quantity - 1)} aria-label={`Decrease ${line.product.name} quantity`}><Minus /></Button>
                <Input className="w-16 text-center" type="number" min="1" max={line.product.stock} value={line.quantity} onChange={(event) => changeQuantity(line.product.databaseId, Number(event.target.value))} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); focusBarcode(); } }} aria-label={`${line.product.name} quantity`} />
                <Button type="button" variant="ghost" size="icon" onClick={() => changeQuantity(line.product.databaseId, line.quantity + 1)} disabled={line.quantity >= line.product.stock} aria-label={`Increase ${line.product.name} quantity`}><Plus /></Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => changeQuantity(line.product.databaseId, 0)} aria-label={`Remove ${line.product.name}`}><Trash /></Button>
              </div>
            </div>
          ))}
          <Field>
            <FieldLabel htmlFor="sale-notes">Sale notes</FieldLabel>
            <Input id="sale-notes" value={notes} maxLength={500} onChange={(event) => setNotes(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); focusBarcode(); } }} placeholder="Optional reference or note" />
          </Field>
        </CardContent>
        <Separator />
        <CardFooter className="flex-col items-stretch gap-4 pt-6">
          <div className="flex items-end justify-between"><span className="text-sm text-[var(--muted-foreground)]">Total</span><strong className="text-2xl tracking-[-0.03em]">{peso(total)}</strong></div>
          <Button size="lg" onClick={confirmSale} disabled={cart.length === 0 || isPending || !online || dataSource !== "live"}>
            <CheckCircle data-icon="inline-start" weight="bold" />{isPending ? "Confirming sale…" : "Confirm sale"}
          </Button>
          {(!online || dataSource !== "live") && <p className="text-center text-xs text-[var(--muted-foreground)]">Product lookup remains available, but sale confirmation requires current live inventory.</p>}
        </CardFooter>
      </Card>
    </div>
  );
}
