"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { CaretDown, CheckCircle, Clock, WarningCircle, XCircle } from "@phosphor-icons/react";
import { changeBusinessDayStatus, loadBusinessDaySales, loadSalesVerification, reviewSaleReturn, type BusinessDaySale, type BusinessDaySummary, type PendingReturnSummary } from "@/app/sales/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function peso(value: number) { return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value); }
function date(value: string) { return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`)); }

export function SalesVerificationView({ notify }: { notify: (message: string) => void }) {
  const [days, setDays] = useState<BusinessDaySummary[]>([]);
  const [returns, setReturns] = useState<PendingReturnSummary[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [expandedDayId, setExpandedDayId] = useState<string | null>(null);
  const [daySales, setDaySales] = useState<Record<string, BusinessDaySale[]>>({});
  const [salesLoadingDayId, setSalesLoadingDayId] = useState<string | null>(null);
  const [salesErrors, setSalesErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    const result = await loadSalesVerification();
    setDays(result.days); setReturns(result.returns); setError(result.error ?? ""); setLoading(false);
  }, []);
  useEffect(() => {
    let active = true;
    void loadSalesVerification().then((result) => {
      if (!active) return;
      setDays(result.days); setReturns(result.returns); setError(result.error ?? ""); setLoading(false);
    });
    return () => { active = false; };
  }, []);

  function updateDay(id: string, action: "submit" | "verify") {
    startTransition(async () => { const result = await changeBusinessDayStatus(id, action); if (!result.ok) return setError(result.message); notify(result.message); await refresh(); });
  }
  function reviewReturn(id: string, approve: boolean) {
    startTransition(async () => { const result = await reviewSaleReturn(id, approve); if (!result.ok) return setError(result.message); notify(result.message); await refresh(); });
  }

  async function fetchDaySales(dayId: string) {
    setSalesLoadingDayId(dayId);
    setSalesErrors((current) => ({ ...current, [dayId]: "" }));
    const result = await loadBusinessDaySales(dayId);
    if (result.ok) setDaySales((current) => ({ ...current, [dayId]: result.sales }));
    else setSalesErrors((current) => ({ ...current, [dayId]: result.message }));
    setSalesLoadingDayId((current) => current === dayId ? null : current);
  }

  async function toggleDaySales(dayId: string) {
    if (expandedDayId === dayId) {
      setExpandedDayId(null);
      return;
    }
    setExpandedDayId(dayId);
    if (!daySales[dayId]) await fetchDaySales(dayId);
  }

  if (loading) return <div className="grid gap-4"><Skeleton className="h-48 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></div>;
  return <div className="grid gap-5">
    {error && <Alert variant="destructive"><WarningCircle /><AlertTitle>Verification data unavailable</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
    <Card className="border-[var(--border)] bg-[var(--surface)] shadow-none"><CardHeader><CardTitle>Daily sales records</CardTitle><CardDescription>Open a day to review every completed sale before submitting or verifying its records.</CardDescription></CardHeader><CardContent className="flex flex-col gap-3">{days.length === 0 ? <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">A daily record will open automatically when the first sale is confirmed.</p> : days.map((day) => {
      const hasPendingReturn = returns.some((item) => item.businessDayId === day.id);
      const expanded = expandedDayId === day.id;
      return <article key={day.id} className="overflow-hidden rounded-xl border border-[var(--border)]">
        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(180px,1fr)_repeat(4,100px)_auto] lg:items-center">
          <div className="min-w-0">
            <p className="font-semibold">{date(day.businessDate)}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Badge variant={day.status === "verified" ? "default" : "outline"}>{day.status.replace("_", " ")}</Badge>
              <button type="button" aria-expanded={expanded} aria-controls={`sales-${day.id}`} onClick={() => void toggleDaySales(day.id)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-[var(--accent-strong)] hover:bg-[var(--accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
                {expanded ? "Hide sales" : `Review ${day.saleCount} sale${day.saleCount === 1 ? "" : "s"}`}<CaretDown size={15} className={expanded ? "rotate-180 transition-transform" : "transition-transform"} />
              </button>
            </div>
          </div>
          <Metric label="Sales" value={day.saleCount} />
          <Metric label="Items sold" value={day.itemCount} />
          <Metric label="Returns" value={day.returnCount} />
          <Metric label="Gross sales" value={peso(day.grossTotal)} />
          <div className="lg:justify-self-end">{day.status === "open" ? <Button disabled={isPending} onClick={() => updateDay(day.id, "submit")}><Clock data-icon="inline-start" />Submit for review</Button> : day.status === "pending_review" ? <Button disabled={isPending || hasPendingReturn} onClick={() => updateDay(day.id, "verify")} title={hasPendingReturn ? "Review this day’s pending returns first." : undefined}><CheckCircle data-icon="inline-start" />Mark verified</Button> : <span className="text-sm font-semibold text-[var(--accent)]">Verified</span>}</div>
        </div>
        {expanded && <div id={`sales-${day.id}`} className="border-t border-[var(--border)] bg-[var(--background)] p-4">
          <h3 className="mb-3 text-sm font-bold">Sales for {date(day.businessDate)}</h3>
          {salesLoadingDayId === day.id ? <Skeleton className="h-20 rounded-xl" />
            : salesErrors[day.id] ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"><span>{salesErrors[day.id]}</span><Button variant="secondary" size="sm" onClick={() => void fetchDaySales(day.id)}>Try again</Button></div>
              : (daySales[day.id] ?? []).length === 0 ? <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-6 text-center text-sm text-[var(--muted-foreground)]">No completed sales were recorded for this day.</p>
                : <div className="grid gap-3">{daySales[day.id].map((sale) => <SaleReviewCard key={sale.saleNumber} sale={sale} />)}</div>}
        </div>}
      </article>;
    })}</CardContent></Card>
    <Card className="border-[var(--border)] bg-[var(--surface)] shadow-none"><CardHeader><CardTitle>Pending returns</CardTitle><CardDescription>Only approved resellable items return to available inventory.</CardDescription></CardHeader><CardContent className="flex flex-col gap-3">{returns.length === 0 ? <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">There are no returns waiting for review.</p> : returns.map((item) => <div key={item.id} className="flex flex-col gap-4 rounded-xl border border-[var(--border)] p-4"><div className="flex flex-col gap-4 sm:flex-row sm:items-start"><div className="min-w-0 flex-1"><p className="font-semibold">Return #{item.returnNumber} · Sale #{item.saleNumber}</p><p className="mt-1 text-sm text-[var(--muted-foreground)]">{item.itemCount} item{item.itemCount === 1 ? "" : "s"} · {item.reason} · {item.requestedBy}</p></div><div className="flex gap-2"><Button variant="secondary" disabled={isPending} onClick={() => reviewReturn(item.id, false)}><XCircle data-icon="inline-start" />Reject</Button><Button disabled={isPending} onClick={() => reviewReturn(item.id, true)}><CheckCircle data-icon="inline-start" />Approve</Button></div></div><div className="flex flex-col gap-2 border-t border-[var(--border)] pt-3">{item.items.map((line) => <div key={`${item.id}-${line.productName}`} className="flex items-center justify-between gap-4 text-sm"><span className="min-w-0 truncate">{line.productName}</span><span className="shrink-0 text-[var(--muted-foreground)]">{line.quantity} · {line.disposition === "restock" ? "Resellable" : line.disposition === "damaged" ? "Damaged" : "Expired"}</span></div>)}</div></div>)}</CardContent></Card>
  </div>;
}

function Metric({ label, value }: { label: string; value: string | number }) { return <div><p className="text-xs text-[var(--muted-foreground)]">{label}</p><p className="mt-1 font-bold">{value}</p></div>; }

function SaleReviewCard({ sale }: { sale: BusinessDaySale }) {
  return <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] pb-3">
      <div><p className="font-bold">Sale #{sale.saleNumber}</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">{new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(sale.soldAt))} · {sale.cashierName}</p></div>
      <p className="text-right text-sm"><span className="block text-xs text-[var(--muted-foreground)]">Receipt total</span><span className="font-bold">{peso(sale.totalAmount)}</span></p>
    </div>
    <div className="mt-3 grid gap-2">{sale.items.map((item, index) => <div key={`${sale.saleNumber}-${item.productName}-${index}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 text-sm"><span className="min-w-0"><span className="font-medium">{item.productName}</span><span className="ml-2 text-xs text-[var(--muted-foreground)]">{item.quantity} × {peso(item.unitPrice)}</span></span><span className="font-semibold">{peso(item.lineTotal)}</span></div>)}</div>
  </section>;
}
