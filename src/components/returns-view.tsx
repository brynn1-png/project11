"use client";

import { useState, useTransition } from "react";
import { ArrowCounterClockwise, MagnifyingGlass, WarningCircle } from "@phosphor-icons/react";
import { findSaleForReturn, requestSaleReturn, type ReturnableSaleItem } from "@/app/sales/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type ReturnLine = { quantity: number; disposition: "restock" | "damaged" | "expired" };

export function ReturnsView({ notify }: { notify: (message: string) => void }) {
  const [saleNumber, setSaleNumber] = useState("");
  const [items, setItems] = useState<ReturnableSaleItem[]>([]);
  const [lines, setLines] = useState<Record<string, ReturnLine>>({});
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function lookup() {
    setMessage("");
    startTransition(async () => {
      const result = await findSaleForReturn(Number(saleNumber));
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
      setItems([]); setLines({}); setReason(""); setNotes(""); setSaleNumber("");
    });
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-5">
      <Card className="border-[var(--border)] bg-[var(--surface)] shadow-none">
        <CardHeader><CardTitle>Find the original sale</CardTitle><CardDescription>Returns remain linked to the original sale and do not change its history.</CardDescription></CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3 sm:flex-row" onSubmit={(event) => { event.preventDefault(); lookup(); }}>
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
