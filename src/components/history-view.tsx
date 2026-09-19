"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowCounterClockwise, ArrowDown, ArrowUp, MagnifyingGlass, Package, Printer, Receipt } from "@phosphor-icons/react";
import { loadTransactionHistory, type ReceiptHistoryEntry, type ReturnHistoryEntry } from "@/app/history/actions";
import { useInventory } from "@/components/inventory-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type HistoryTab = "activity" | "receipts" | "returns";

function peso(value: number) { return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value); }
function date(value: string) { return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function statusLabel(value: string) { return value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "); }

export function HistoryView() {
  const { transactions } = useInventory();
  const [tab, setTab] = useState<HistoryTab>("activity");
  const [activityType, setActivityType] = useState<"All" | "Stock In" | "Stock Out">("All");
  const [search, setSearch] = useState("");
  const [receipts, setReceipts] = useState<ReceiptHistoryEntry[]>([]);
  const [returns, setReturns] = useState<ReturnHistoryEntry[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptHistoryEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void loadTransactionHistory().then((result) => {
      if (!active) return;
      setReceipts(result.receipts); setReturns(result.returns); setError(result.error ?? ""); setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const query = search.trim().toLowerCase();
  const shownActivity = useMemo(() => transactions.filter((item) => (activityType === "All" || item.type === activityType) && (!query || [item.productName, item.barcode, item.id, item.user].some((value) => value.toLowerCase().includes(query)))), [activityType, query, transactions]);
  const shownReceipts = useMemo(() => receipts.filter((item) => !query || [`sale ${item.saleNumber}`, item.saleNumber, item.cashierName, ...item.items.map((line) => line.productName)].some((value) => value.toLowerCase().includes(query))), [query, receipts]);
  const shownReturns = useMemo(() => returns.filter((item) => !query || [`return ${item.returnNumber}`, item.returnNumber, item.saleNumber, item.requestedBy, item.reason, ...item.items.map((line) => line.productName)].some((value) => value.toLowerCase().includes(query))), [query, returns]);

  function printReceipt(receipt: ReceiptHistoryEntry) {
    setSelectedReceipt(receipt);
    window.setTimeout(() => window.print(), 0);
  }

  return <div className="grid gap-5">
    <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Transaction history">
        {([['activity', 'Inventory activity'], ['receipts', 'Sales receipts'], ['returns', 'Returns']] as const).map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)} className={cn("min-h-10 rounded-xl px-4 text-sm font-semibold", tab === value ? "bg-[#173b2d] text-white" : "border border-[var(--border)] bg-white text-[var(--muted-foreground)] hover:bg-[var(--muted)]")}>{label}</button>)}
      </div>
      <div className="flex w-full flex-col gap-2 sm:max-w-xl sm:flex-row">{tab === "activity" && <select className="select-field sm:w-36" value={activityType} onChange={(event) => setActivityType(event.target.value as typeof activityType)} aria-label="Filter inventory activity"><option>All</option><option>Stock In</option><option>Stock Out</option></select>}<div className="relative flex-1"><MagnifyingGlass className="absolute left-3.5 top-3.5 text-[var(--muted-foreground)]" size={18} /><Input className="pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${tab === "activity" ? "activity" : tab}`} aria-label={`Search ${tab}`} /></div></div>
    </div>

    {error && tab !== "activity" && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">{error}</div>}
    {tab === "activity" && <ActivityHistory items={shownActivity} />}
    {tab === "receipts" && <ReceiptHistory items={shownReceipts} loading={loading} onPrint={printReceipt} />}
    {tab === "returns" && <ReturnHistory items={shownReturns} loading={loading} />}
    {selectedReceipt && <ReceiptPrintSheet receipt={selectedReceipt} />}
  </div>;
}

function ActivityHistory({ items }: { items: ReturnType<typeof useInventory>["transactions"] }) {
  if (items.length === 0) return <HistoryEmpty icon="activity" title="No matching activity" text="Stock receipts and completed sales will appear here." />;
  return <div className="panel overflow-hidden"><div className="overflow-x-auto"><table className="data-table min-w-[900px]"><thead><tr><th>Transaction</th><th>Product</th><th>Type</th><th>Quantity</th><th>Stock change</th><th>User</th><th>Date</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td className="max-w-36 truncate font-mono text-xs text-[var(--muted-foreground)]" title={item.id}>{item.id}</td><td><p className="font-semibold">{item.productName}</p><p className="text-xs text-[var(--muted-foreground)]">{item.notes || "No notes"}</p></td><td><span className={cn("inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold", item.type === "Stock In" ? "bg-emerald-50 text-emerald-800" : "bg-orange-50 text-orange-800")}>{item.type === "Stock In" ? <ArrowDown size={13} /> : <ArrowUp size={13} />}{item.type}</span></td><td className="font-bold">{item.quantity}</td><td>{item.previousStock === null || item.newStock === null ? <span className="text-[var(--muted-foreground)]">Recorded</span> : <><span className="text-[var(--muted-foreground)]">{item.previousStock}</span> <span aria-hidden="true">→</span> <strong>{item.newStock}</strong></>}</td><td>{item.user}</td><td className="text-[var(--muted-foreground)]">{date(item.createdAt)}</td></tr>)}</tbody></table></div></div>;
}

function ReceiptHistory({ items, loading, onPrint }: { items: ReceiptHistoryEntry[]; loading: boolean; onPrint: (receipt: ReceiptHistoryEntry) => void }) {
  if (loading) return <HistoryLoading />;
  if (items.length === 0) return <HistoryEmpty icon="receipt" title="No matching receipts" text="Confirmed sales receipts will remain available here." />;
  return <div className="panel overflow-hidden"><div className="overflow-x-auto"><table className="data-table min-w-[900px]"><thead><tr><th>Receipt</th><th>Cashier</th><th>Items</th><th>Returns</th><th>Total</th><th>Date</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{items.map((receipt) => <tr key={receipt.saleNumber}><td><p className="font-semibold">Sale #{receipt.saleNumber}</p><p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{statusLabel(receipt.status)}</p></td><td>{receipt.cashierName}</td><td><p className="font-semibold">{receipt.itemCount}</p><p className="mt-0.5 max-w-64 truncate text-xs text-[var(--muted-foreground)]" title={receipt.items.map((item) => item.productName).join(", ")}>{receipt.items.map((item) => `${item.quantity}× ${item.productName}`).join(", ")}</p></td><td>{receipt.returnedQuantity > 0 ? `${receipt.returnedQuantity} returned` : "None"}</td><td className="font-bold">{peso(receipt.totalAmount)}</td><td className="text-[var(--muted-foreground)]">{date(receipt.soldAt)}</td><td><Button size="sm" variant="ghost" onClick={() => onPrint(receipt)}><Printer size={16} />View / print</Button></td></tr>)}</tbody></table></div></div>;
}

function ReturnHistory({ items, loading }: { items: ReturnHistoryEntry[]; loading: boolean }) {
  if (loading) return <HistoryLoading />;
  if (items.length === 0) return <HistoryEmpty icon="return" title="No matching returns" text="Requested, approved, and rejected returns will remain available here." />;
  return <div className="panel overflow-hidden"><div className="overflow-x-auto"><table className="data-table min-w-[960px]"><thead><tr><th>Return</th><th>Original sale</th><th>Products</th><th>Reason</th><th>Status</th><th>Requested</th><th>Reviewed</th></tr></thead><tbody>{items.map((item) => <tr key={item.returnNumber}><td className="font-semibold">Return #{item.returnNumber}</td><td>Sale #{item.saleNumber}</td><td><p className="font-semibold">{item.itemCount} item{item.itemCount === 1 ? "" : "s"}</p><p className="mt-0.5 max-w-64 truncate text-xs text-[var(--muted-foreground)]" title={item.items.map((line) => line.productName).join(", ")}>{item.items.map((line) => `${line.quantity}× ${line.productName} · ${statusLabel(line.disposition)}`).join(", ")}</p></td><td><p className="max-w-64">{item.reason}</p></td><td><span className={cn("inline-flex rounded-lg px-2 py-1 text-xs font-bold", item.status === "approved" ? "bg-emerald-50 text-emerald-800" : item.status === "rejected" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800")}>{statusLabel(item.status)}</span></td><td><p>{item.requestedBy}</p><p className="text-xs text-[var(--muted-foreground)]">{date(item.requestedAt)}</p></td><td>{item.reviewedAt ? <><p>{item.reviewedBy ?? "Manager"}</p><p className="text-xs text-[var(--muted-foreground)]">{date(item.reviewedAt)}</p></> : <span className="text-[var(--muted-foreground)]">Not reviewed</span>}</td></tr>)}</tbody></table></div></div>;
}

function HistoryLoading() { return <div className="panel grid min-h-48 place-items-center text-sm text-[var(--muted-foreground)]">Loading history…</div>; }
function HistoryEmpty({ icon, title, text }: { icon: "activity" | "receipt" | "return"; title: string; text: string }) { const Icon = icon === "receipt" ? Receipt : icon === "return" ? ArrowCounterClockwise : Package; return <div className="panel grid place-items-center px-5 py-14 text-center"><span className="grid size-12 place-items-center rounded-2xl bg-[var(--muted)] text-[var(--muted-foreground)]"><Icon size={23} /></span><h3 className="mt-4 font-bold">{title}</h3><p className="mt-1 max-w-sm text-sm text-[var(--muted-foreground)]">{text}</p></div>; }

function ReceiptPrintSheet({ receipt }: { receipt: ReceiptHistoryEntry }) {
  return <section className="receipt-print-sheet" aria-label={`Sale ${receipt.saleNumber} receipt`}><div className="text-center"><h1>South Emerald Supermarket</h1><p>Sale #{receipt.saleNumber}</p><p>{date(receipt.soldAt)} · {receipt.cashierName}</p></div><div className="receipt-print-lines">{receipt.items.map((item) => <div key={`${receipt.saleNumber}-${item.barcode}`}><span>{item.quantity} × {item.productName}</span><strong>{peso(item.lineTotal)}</strong><small>{peso(item.unitPrice)} each</small></div>)}</div><div className="receipt-print-total"><span>Total</span><strong>{peso(receipt.totalAmount)}</strong></div>{receipt.returnedQuantity > 0 && <p>{receipt.returnedQuantity} item{receipt.returnedQuantity === 1 ? "" : "s"} returned</p>}{receipt.notes && <p>Note: {receipt.notes}</p>}</section>;
}
