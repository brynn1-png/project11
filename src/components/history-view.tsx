"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowCounterClockwise, ArrowDown, ArrowUp, CalendarCheck, CheckCircle, ClockCounterClockwise, MagnifyingGlass, Package, Printer, Receipt } from "@phosphor-icons/react";
import { loadTransactionHistory, type ReceiptHistoryEntry, type ReturnHistoryEntry } from "@/app/history/actions";
import { useInventory } from "@/components/inventory-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SaleReceiptDetails, SaleReceiptPrintSheet } from "@/components/sale-receipt";
import { inventoryActivityLabel } from "@/lib/ui-copy";
import { cn } from "@/lib/utils";

type HistoryTab = "activity" | "receipts" | "returns";

function peso(value: number) { return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value); }
function date(value: string) { return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function calendarDate(value: string) { return new Intl.DateTimeFormat("en-PH", { dateStyle: "long" }).format(new Date(`${value}T00:00:00`)); }
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
  const selectedReturns = selectedReceipt ? returns.filter((item) => item.saleNumber === selectedReceipt.saleNumber) : [];

  return <div className="grid gap-5">
    <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Activity and receipt history">
        {([['activity', 'Stock activity'], ['receipts', 'Sales receipts'], ['returns', 'Customer returns']] as const).map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)} className={cn("min-h-10 rounded-xl px-4 text-sm font-semibold", tab === value ? "bg-[#173b2d] text-white" : "border border-[var(--border)] bg-white text-[var(--muted-foreground)] hover:bg-[var(--muted)]")}>{label}</button>)}
      </div>
      <div className="flex w-full flex-col gap-2 sm:max-w-xl sm:flex-row">{tab === "activity" && <select className="select-field sm:w-44" value={activityType} onChange={(event) => setActivityType(event.target.value as typeof activityType)} aria-label="Filter stock activity"><option value="All">All activity</option><option value="Stock In">Stock received</option><option value="Stock Out">Stock sold</option></select>}<div className="relative flex-1"><MagnifyingGlass className="absolute left-3.5 top-3.5 text-[var(--muted-foreground)]" size={18} /><Input className="pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tab === "activity" ? "Search stock activity" : tab === "receipts" ? "Search sales receipts" : "Search customer returns"} aria-label={tab === "activity" ? "Search stock activity" : tab === "receipts" ? "Search sales receipts" : "Search customer returns"} /></div></div>
    </div>

    {error && tab !== "activity" && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">{error}</div>}
    {tab === "activity" && <ActivityHistory items={shownActivity} />}
    {tab === "receipts" && <ReceiptHistory items={shownReceipts} loading={loading} onSelect={setSelectedReceipt} />}
    {tab === "returns" && <ReturnHistory items={shownReturns} loading={loading} />}
    <ReceiptModal receipt={selectedReceipt} returns={selectedReturns} onClose={() => setSelectedReceipt(null)} />
    {selectedReceipt && <SaleReceiptPrintSheet receipt={selectedReceipt} />}
  </div>;
}

function ReceiptModal({ receipt, returns, onClose }: { receipt: ReceiptHistoryEntry | null; returns: ReturnHistoryEntry[]; onClose: () => void }) {
  return <Dialog open={receipt !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
    {receipt && <DialogContent className="no-print max-h-[90vh] max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-0">
      <DialogHeader className="border-b border-[var(--border)] px-5 py-5 sm:px-6">
        <DialogTitle>Sale #{receipt.saleNumber}</DialogTitle>
        <DialogDescription>Review the receipt, related returns, and verification activity.</DialogDescription>
      </DialogHeader>
      <Tabs defaultValue="receipt" className="min-h-0 overflow-hidden">
        <div className="px-5 pt-4 sm:px-6"><TabsList className="grid w-full grid-cols-3"><TabsTrigger value="receipt">Receipt</TabsTrigger><TabsTrigger value="returns">Returns ({returns.length})</TabsTrigger><TabsTrigger value="activity">Activity</TabsTrigger></TabsList></div>
        <TabsContent value="receipt" className="mt-0 max-h-[calc(90vh-13rem)] overflow-y-auto px-5 py-5 sm:px-6"><SaleReceiptDetails receipt={receipt} /></TabsContent>
        <TabsContent value="returns" className="mt-0 max-h-[calc(90vh-13rem)] overflow-y-auto px-5 py-5 sm:px-6"><ReceiptReturns returns={returns} /></TabsContent>
        <TabsContent value="activity" className="mt-0 max-h-[calc(90vh-13rem)] overflow-y-auto px-5 py-5 sm:px-6"><ReceiptActivity receipt={receipt} returns={returns} /></TabsContent>
      </Tabs>
      <DialogFooter className="border-t border-[var(--border)] px-5 py-4 sm:px-6"><Button variant="secondary" onClick={onClose}>Close</Button><Button onClick={() => window.print()}><Printer data-icon="inline-start" />Print / Save as PDF</Button></DialogFooter>
    </DialogContent>}
  </Dialog>;
}

function ReceiptReturns({ returns }: { returns: ReturnHistoryEntry[] }) {
  if (returns.length === 0) return <Empty className="min-h-56"><EmptyHeader><EmptyMedia variant="icon"><ArrowCounterClockwise /></EmptyMedia><EmptyTitle>No returns for this sale</EmptyTitle><EmptyDescription>Any future return request will appear here.</EmptyDescription></EmptyHeader></Empty>;
  return <div className="grid gap-4">{returns.map((item) => <article key={item.returnNumber} className="rounded-xl border border-[var(--border)] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold">Return #{item.returnNumber}</h3><p className="mt-1 text-xs text-[var(--muted-foreground)]">Requested by {item.requestedBy} · {date(item.requestedAt)}</p></div><ReturnStatus status={item.status} /></div><p className="mt-4 text-sm"><span className="font-semibold">Reason:</span> {item.reason}</p><div className="mt-3 grid gap-2 border-t border-[var(--border)] pt-3">{item.items.map((line, index) => <div key={`${item.returnNumber}-${line.productName}-${index}`} className="flex items-center justify-between gap-4 text-sm"><span>{line.quantity} × {line.productName}</span><span className="text-[var(--muted-foreground)]">{statusLabel(line.disposition)}</span></div>)}</div>{item.reviewedAt && <p className="mt-3 text-xs text-[var(--muted-foreground)]">Reviewed by {item.reviewedBy ?? "Manager"} · {date(item.reviewedAt)}</p>}{item.notes && <p className="mt-2 text-xs text-[var(--muted-foreground)]">Note: {item.notes}</p>}</article>)}</div>;
}

function ReturnStatus({ status }: { status: ReturnHistoryEntry["status"] }) {
  if (status === "approved") return <Badge>Approved</Badge>;
  if (status === "rejected") return <Badge variant="destructive">Rejected</Badge>;
  return <Badge variant="secondary">Pending review</Badge>;
}

function ReceiptActivity({ receipt, returns }: { receipt: ReceiptHistoryEntry; returns: ReturnHistoryEntry[] }) {
  const events = [
    { id: "sale", at: receipt.soldAt, title: "Sale completed", detail: `${receipt.cashierName} recorded ${receipt.itemCount} item${receipt.itemCount === 1 ? "" : "s"} for ${peso(receipt.totalAmount)}.`, icon: Receipt },
    ...returns.flatMap((item) => [
      { id: `return-${item.returnNumber}`, at: item.requestedAt, title: `Return #${item.returnNumber} requested`, detail: `${item.requestedBy} requested ${item.itemCount} item${item.itemCount === 1 ? "" : "s"} for review.`, icon: ArrowCounterClockwise },
      ...(item.reviewedAt ? [{ id: `return-${item.returnNumber}-review`, at: item.reviewedAt, title: `Return #${item.returnNumber} ${statusLabel(item.status).toLowerCase()}`, detail: `${item.reviewedBy ?? "Manager"} completed the return review.`, icon: CheckCircle }] : []),
    ]),
    ...(receipt.submittedAt ? [{ id: "submitted", at: receipt.submittedAt, title: "Daily record submitted", detail: `${receipt.submittedBy ?? "Manager"} submitted the day for verification.`, icon: ClockCounterClockwise }] : []),
    ...(receipt.verifiedAt ? [{ id: "verified", at: receipt.verifiedAt, title: "Daily record verified", detail: `${receipt.verifiedBy ?? "Manager"} verified the recorded activity.`, icon: CalendarCheck }] : []),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return <div className="grid gap-5"><div className="flex flex-wrap items-start justify-between gap-3 rounded-xl bg-[var(--muted)] p-4"><div><p className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--muted-foreground)]">Daily verification</p><p className="mt-1 font-bold">{receipt.businessDate ? calendarDate(receipt.businessDate) : "Daily record unavailable"}</p></div>{receipt.businessDayStatus ? <Badge variant={receipt.businessDayStatus === "verified" ? "default" : "secondary"}>{statusLabel(receipt.businessDayStatus)}</Badge> : <Badge variant="outline">Not recorded</Badge>}</div><ol className="grid gap-0">{events.map((event, index) => { const Icon = event.icon; return <li key={event.id} className="grid grid-cols-[2.5rem_1fr] gap-3"><div className="flex flex-col items-center"><span className="grid size-9 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]"><Icon size={18} /></span>{index < events.length - 1 && <span className="min-h-8 w-px flex-1 bg-[var(--border)]" />}</div><div className="pb-5"><div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="font-semibold">{event.title}</h3><time className="text-xs text-[var(--muted-foreground)]">{date(event.at)}</time></div><p className="mt-1 text-sm text-[var(--muted-foreground)]">{event.detail}</p></div></li>; })}</ol></div>;
}

function ActivityHistory({ items }: { items: ReturnType<typeof useInventory>["transactions"] }) {
  if (items.length === 0) return <HistoryEmpty icon="activity" title="No matching activity" text="Stock receipts and completed sales will appear here." />;
  return <div className="panel overflow-hidden"><div className="overflow-x-auto"><table className="data-table min-w-[900px]"><thead><tr><th>Activity ID</th><th>Product</th><th>Action</th><th>Quantity</th><th>Stock balance</th><th>Recorded by</th><th>Date</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td className="max-w-36 truncate font-mono text-xs text-[var(--muted-foreground)]" title={item.id}>{item.id}</td><td><p className="font-semibold">{item.productName}</p><p className="text-xs text-[var(--muted-foreground)]">{item.notes || "No notes"}</p></td><td><span className={cn("inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold", item.type === "Stock In" ? "bg-emerald-50 text-emerald-800" : "bg-orange-50 text-orange-800")}>{item.type === "Stock In" ? <ArrowDown size={13} /> : <ArrowUp size={13} />}{inventoryActivityLabel(item.type)}</span></td><td className="font-bold">{item.quantity}</td><td>{item.previousStock === null || item.newStock === null ? <span className="text-[var(--muted-foreground)]">Recorded</span> : <><span className="text-[var(--muted-foreground)]">{item.previousStock}</span> <span aria-hidden="true">→</span> <strong>{item.newStock}</strong></>}</td><td>{item.user}</td><td className="text-[var(--muted-foreground)]">{date(item.createdAt)}</td></tr>)}</tbody></table></div></div>;
}

function ReceiptHistory({ items, loading, onSelect }: { items: ReceiptHistoryEntry[]; loading: boolean; onSelect: (receipt: ReceiptHistoryEntry) => void }) {
  if (loading) return <HistoryLoading />;
  if (items.length === 0) return <HistoryEmpty icon="receipt" title="No matching receipts" text="Confirmed sales receipts will remain available here." />;
  return <div className="panel overflow-hidden"><div className="overflow-x-auto"><table className="data-table min-w-[960px]"><thead><tr><th>Receipt</th><th>Cashier</th><th>Items</th><th>Returns</th><th>Payment</th><th>Date</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{items.map((receipt) => <tr key={receipt.saleNumber}><td><p className="font-semibold">Sale #{receipt.saleNumber}</p><p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{statusLabel(receipt.status)}</p></td><td>{receipt.cashierName}</td><td><p className="font-semibold">{receipt.itemCount}</p><p className="mt-0.5 max-w-64 truncate text-xs text-[var(--muted-foreground)]" title={receipt.items.map((item) => item.productName).join(", ")}>{receipt.items.map((item) => `${item.quantity}× ${item.productName}`).join(", ")}</p></td><td>{receipt.returnedQuantity > 0 ? `${receipt.returnedQuantity} returned` : "None"}</td><td><p className="font-bold">{peso(receipt.totalAmount)}</p>{receipt.cashReceived !== undefined ? <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">Cash {peso(receipt.cashReceived)} · Change {peso(receipt.changeDue ?? 0)}</p> : <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">Not recorded</p>}</td><td className="text-[var(--muted-foreground)]">{date(receipt.soldAt)}</td><td><Button size="sm" variant="ghost" onClick={() => onSelect(receipt)}>View receipt</Button></td></tr>)}</tbody></table></div></div>;
}

function ReturnHistory({ items, loading }: { items: ReturnHistoryEntry[]; loading: boolean }) {
  if (loading) return <HistoryLoading />;
  if (items.length === 0) return <HistoryEmpty icon="return" title="No matching returns" text="Requested, approved, and rejected returns will remain available here." />;
  return <div className="panel overflow-hidden"><div className="overflow-x-auto"><table className="data-table min-w-[960px]"><thead><tr><th>Return</th><th>Original sale</th><th>Products</th><th>Reason</th><th>Status</th><th>Requested</th><th>Reviewed</th></tr></thead><tbody>{items.map((item) => <tr key={item.returnNumber}><td className="font-semibold">Return #{item.returnNumber}</td><td>Sale #{item.saleNumber}</td><td><p className="font-semibold">{item.itemCount} item{item.itemCount === 1 ? "" : "s"}</p><p className="mt-0.5 max-w-64 truncate text-xs text-[var(--muted-foreground)]" title={item.items.map((line) => line.productName).join(", ")}>{item.items.map((line) => `${line.quantity}× ${line.productName} · ${statusLabel(line.disposition)}`).join(", ")}</p></td><td><p className="max-w-64">{item.reason}</p></td><td><span className={cn("inline-flex rounded-lg px-2 py-1 text-xs font-bold", item.status === "approved" ? "bg-emerald-50 text-emerald-800" : item.status === "rejected" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800")}>{statusLabel(item.status)}</span></td><td><p>{item.requestedBy}</p><p className="text-xs text-[var(--muted-foreground)]">{date(item.requestedAt)}</p></td><td>{item.reviewedAt ? <><p>{item.reviewedBy ?? "Manager"}</p><p className="text-xs text-[var(--muted-foreground)]">{date(item.reviewedAt)}</p></> : <span className="text-[var(--muted-foreground)]">Not reviewed</span>}</td></tr>)}</tbody></table></div></div>;
}

function HistoryLoading() { return <div className="panel grid min-h-48 place-items-center text-sm text-[var(--muted-foreground)]">Loading history…</div>; }
function HistoryEmpty({ icon, title, text }: { icon: "activity" | "receipt" | "return"; title: string; text: string }) { const Icon = icon === "receipt" ? Receipt : icon === "return" ? ArrowCounterClockwise : Package; return <div className="panel grid place-items-center px-5 py-14 text-center"><span className="grid size-12 place-items-center rounded-2xl bg-[var(--muted)] text-[var(--muted-foreground)]"><Icon size={23} /></span><h3 className="mt-4 font-bold">{title}</h3><p className="mt-1 max-w-sm text-sm text-[var(--muted-foreground)]">{text}</p></div>; }
