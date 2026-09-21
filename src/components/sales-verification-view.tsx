"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { CheckCircle, Clock, WarningCircle, XCircle } from "@phosphor-icons/react";
import { changeBusinessDayStatus, loadSalesVerification, reviewSaleReturn, type BusinessDaySummary, type PendingReturnSummary } from "@/app/sales/actions";
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

  if (loading) return <div className="grid gap-4"><Skeleton className="h-48 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></div>;
  return <div className="grid gap-5">
    {error && <Alert variant="destructive"><WarningCircle /><AlertTitle>Verification data unavailable</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
    <Card className="border-[var(--border)] bg-[var(--surface)] shadow-none"><CardHeader><CardTitle>Daily sales records</CardTitle><CardDescription>Review each day’s sales and returns before marking its records as verified.</CardDescription></CardHeader><CardContent className="flex flex-col gap-3">{days.length === 0 ? <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">A daily record will open automatically when the first sale is confirmed.</p> : days.map((day) => { const hasPendingReturn = returns.some((item) => item.businessDayId === day.id); return <div key={day.id} className="grid gap-4 rounded-xl border border-[var(--border)] p-4 lg:grid-cols-[1fr_repeat(4,110px)_auto] lg:items-center"><div><p className="font-semibold">{date(day.businessDate)}</p><Badge variant={day.status === "verified" ? "default" : "outline"} className="mt-2">{day.status.replace("_", " ")}</Badge></div><Metric label="Sales" value={day.saleCount} /><Metric label="Items sold" value={day.itemCount} /><Metric label="Returns" value={day.returnCount} /><Metric label="Gross sales" value={peso(day.grossTotal)} /><div>{day.status === "open" ? <Button disabled={isPending} onClick={() => updateDay(day.id, "submit")}><Clock data-icon="inline-start" />Submit for review</Button> : day.status === "pending_review" ? <Button disabled={isPending || hasPendingReturn} onClick={() => updateDay(day.id, "verify")} title={hasPendingReturn ? "Review this day’s pending returns first." : undefined}><CheckCircle data-icon="inline-start" />Mark verified</Button> : <span className="text-sm font-semibold text-[var(--accent)]">Verified</span>}</div></div>; })}</CardContent></Card>
    <Card className="border-[var(--border)] bg-[var(--surface)] shadow-none"><CardHeader><CardTitle>Pending returns</CardTitle><CardDescription>Only approved resellable items return to available inventory.</CardDescription></CardHeader><CardContent className="flex flex-col gap-3">{returns.length === 0 ? <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">There are no returns waiting for review.</p> : returns.map((item) => <div key={item.id} className="flex flex-col gap-4 rounded-xl border border-[var(--border)] p-4"><div className="flex flex-col gap-4 sm:flex-row sm:items-start"><div className="min-w-0 flex-1"><p className="font-semibold">Return #{item.returnNumber} · Sale #{item.saleNumber}</p><p className="mt-1 text-sm text-[var(--muted-foreground)]">{item.itemCount} item{item.itemCount === 1 ? "" : "s"} · {item.reason} · {item.requestedBy}</p></div><div className="flex gap-2"><Button variant="secondary" disabled={isPending} onClick={() => reviewReturn(item.id, false)}><XCircle data-icon="inline-start" />Reject</Button><Button disabled={isPending} onClick={() => reviewReturn(item.id, true)}><CheckCircle data-icon="inline-start" />Approve</Button></div></div><div className="flex flex-col gap-2 border-t border-[var(--border)] pt-3">{item.items.map((line) => <div key={`${item.id}-${line.productName}`} className="flex items-center justify-between gap-4 text-sm"><span className="min-w-0 truncate">{line.productName}</span><span className="shrink-0 text-[var(--muted-foreground)]">{line.quantity} · {line.disposition === "restock" ? "Resellable" : line.disposition === "damaged" ? "Damaged" : "Expired"}</span></div>)}</div></div>)}</CardContent></Card>
  </div>;
}

function Metric({ label, value }: { label: string; value: string | number }) { return <div><p className="text-xs text-[var(--muted-foreground)]">{label}</p><p className="mt-1 font-bold">{value}</p></div>; }
