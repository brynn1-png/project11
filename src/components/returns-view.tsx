"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowCounterClockwise, MagnifyingGlass, Receipt, WarningCircle } from "@phosphor-icons/react";
import { findSaleForReturn, listRecentSales, requestSaleReturn, type RecentSaleSummary, type ReturnableSaleItem } from "@/app/sales/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type ReturnLine = { quantity: number; disposition: "restock" | "damaged" | "expired" };

export function ReturnsView({ notify }: { notify: (message: string) => void }) {
  const [saleNumber, setSaleNumber] = useState("");
  const [items, setItems] = useState<ReturnableSaleItem[]>([]);
  const [lines, setLines] = useState<Record<string, ReturnLine>>({});
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [recentSales, setRecentSales] = useState<RecentSaleSummary[]>([]);
  const [salesSearch, setSalesSearch] = useState("");
  const [salesMessage, setSalesMessage] = useState("");
  const [recentLoading, setRecentLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    listRecentSales().then((result) => {
      if (result.ok) setRecentSales(result.sales);
      else setSalesMessage(result.message);
      setRecentLoading(false);
    });
  }, []);

  const shownSales = useMemo(() => {
    const query = salesSearch.trim().toLowerCase();
    if (!query) return recentSales;
    return recentSales.filter((sale) => `#${sale.saleNumber} ${sale.cashierName}`.toLowerCase().includes(query));
  }, [recentSales, salesSearch]);

  function lookup(selectedSaleNumber = Number(saleNumber)) {
    setMessage("");
    setSaleNumber(String(selectedSaleNumber));
    startTransition(async () => {
      const result = await findSaleForReturn(selectedSaleNumber);
      if (!result.ok) { setItems([]); return setMessage(result.message); }
      setItems(result.items);
      setLines(Object.fromEntries(result.items.map((item) => [item.saleItemId, { quantity: 0, disposition: "restock" as const }])));
    });
  }

  function submit() {
    const selected = items.flatMap((item) => {
      const line = lines[item.saleItemId];
      return line?.quantity > 0 ? [{ saleItemId: item.saleItemId, quantity: line.quantity, disposition: line.disposition }] : [];
    });
    setMessage("");
    startTransition(async () => {
      const result = await requestSaleReturn({ saleNumber: Number(saleNumber), items: selected, reason, notes });
      if (!result.ok) return setMessage(result.message);
      notify(`Return #${result.returnNumber} submitted for manager review.`);
      setRecentSales((current) => current.map((sale) => sale.saleNumber === saleNumber ? { ...sale, hasPendingReturn: true } : sale));
      setItems([]); setLines({}); setReason(""); setNotes(""); setSaleNumber("");
    });
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-5">
      <Card className="border-[var(--border)] bg-[var(--surface)] shadow-none">
        <CardHeader><CardTitle>Recent sales</CardTitle><CardDescription>Select a completed sale or search the latest 50 by sale number or cashier.</CardDescription></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="relative">
            <MagnifyingGlass className="absolute left-3.5 top-3.5 text-[var(--muted-foreground)]" size={18} />
            <Input className="pl-10" value={salesSearch} onChange={(event) => setSalesSearch(event.target.value)} placeholder="Search sale number or cashier" aria-label="Search recent sales" />
          </div>
          {salesMessage && <Alert variant="destructive"><WarningCircle /><AlertTitle>Recent sales unavailable</AlertTitle><AlertDescription>{salesMessage}</AlertDescription></Alert>}
          {recentLoading ? <div className="flex flex-col gap-2"><Skeleton className="h-20 rounded-xl" /><Skeleton className="h-20 rounded-xl" /><Skeleton className="h-20 rounded-xl" /></div> : shownSales.length === 0 ? <Empty className="min-h-32 border"><EmptyHeader><EmptyMedia variant="icon"><Receipt /></EmptyMedia><EmptyTitle>{recentSales.length === 0 ? "No completed sales yet" : "No matching sales"}</EmptyTitle><EmptyDescription>{recentSales.length === 0 ? "Confirmed sales will appear here." : "Try another sale number or cashier name."}</EmptyDescription></EmptyHeader></Empty> : <div className="flex max-h-[28rem] flex-col gap-2 overflow-y-auto pr-1">{shownSales.map((sale) => {
            const unavailable = sale.returnableQuantity === 0 || sale.hasPendingReturn;
            return <div key={sale.saleNumber} className="flex flex-col gap-4 rounded-xl border border-[var(--border)] p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">Sale #{sale.saleNumber}</p>{sale.hasPendingReturn && <Badge variant="outline">Return pending</Badge>}</div><p className="mt-1 truncate text-sm text-[var(--muted-foreground)]">{new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(sale.soldAt))} · {sale.cashierName}</p><p className="mt-2 text-sm">{sale.itemCount} item{sale.itemCount === 1 ? "" : "s"} · {new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(sale.totalAmount)} · {sale.returnableQuantity} returnable</p></div>
              <Button type="button" variant={unavailable ? "secondary" : "default"} disabled={isPending || unavailable} onClick={() => lookup(Number(sale.saleNumber))}>{unavailable ? sale.hasPendingReturn ? "Review pending" : "Fully returned" : "Select sale"}</Button>
            </div>;
          })}</div>}
        </CardContent>
      </Card>

      <Card className="border-[var(--border)] bg-[var(--surface)] shadow-none">
        <CardHeader><CardTitle>Find the original sale</CardTitle><CardDescription>Returns remain linked to the original sale and do not change its history.</CardDescription></CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3 sm:flex-row" onSubmit={(event) => { event.preventDefault(); lookup(Number(saleNumber)); }}>
            <Input value={saleNumber} onChange={(event) => setSaleNumber(event.target.value)} inputMode="numeric" placeholder="Sale number" aria-label="Sale number" />
            <Button type="submit" disabled={isPending}><MagnifyingGlass data-icon="inline-start" />{isPending ? "Searching…" : "Find sale"}</Button>
          </form>
        </CardContent>
      </Card>

      {message && <Alert variant="destructive"><WarningCircle /><AlertTitle>Return needs attention</AlertTitle><AlertDescription>{message}</AlertDescription></Alert>}

      {items.length > 0 && <Card className="border-[var(--border)] bg-[var(--surface)] shadow-none">
        <CardHeader><CardTitle>Select returned items</CardTitle><CardDescription>Resellable items stay pending and only return to available stock after approval.</CardDescription></CardHeader>
        <CardContent className="flex flex-col gap-4">
          {items.map((item) => {
            const remaining = item.quantitySold - item.quantityReturned;
            const line = lines[item.saleItemId];
            return <div key={item.saleItemId} className="grid gap-4 rounded-xl border border-[var(--border)] p-4 md:grid-cols-[minmax(0,1fr)_130px_180px] md:items-end">
              <div className="min-w-0"><p className="truncate font-semibold">{item.productName}</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">{item.barcode} · {remaining} of {item.quantitySold} eligible</p></div>
              <Field><FieldLabel htmlFor={`return-qty-${item.saleItemId}`}>Quantity</FieldLabel><Input id={`return-qty-${item.saleItemId}`} type="number" min="0" max={remaining} value={line?.quantity ?? 0} onChange={(event) => setLines((current) => ({ ...current, [item.saleItemId]: { ...current[item.saleItemId], quantity: Math.min(Math.max(Number(event.target.value), 0), remaining) } }))} /></Field>
              <Field><FieldLabel htmlFor={`return-condition-${item.saleItemId}`}>Condition</FieldLabel><select id={`return-condition-${item.saleItemId}`} className="select-field" value={line?.disposition ?? "restock"} onChange={(event) => setLines((current) => ({ ...current, [item.saleItemId]: { ...current[item.saleItemId], disposition: event.target.value as ReturnLine["disposition"] } }))}><option value="restock">Resellable</option><option value="damaged">Damaged</option><option value="expired">Expired</option></select></Field>
            </div>;
          })}
          <div className="grid gap-4 md:grid-cols-2">
            <Field><FieldLabel htmlFor="return-reason">Return reason</FieldLabel><Input id="return-reason" value={reason} maxLength={160} onChange={(event) => setReason(event.target.value)} placeholder="Why was the item returned?" /></Field>
            <Field><FieldLabel htmlFor="return-notes">Notes</FieldLabel><Input id="return-notes" value={notes} maxLength={500} onChange={(event) => setNotes(event.target.value)} placeholder="Optional details" /><FieldDescription>Do not include payment information.</FieldDescription></Field>
          </div>
        </CardContent>
        <CardFooter className="justify-end"><Button onClick={submit} disabled={isPending}><ArrowCounterClockwise data-icon="inline-start" />{isPending ? "Submitting…" : "Submit return for review"}</Button></CardFooter>
      </Card>}
    </div>
  );
}
