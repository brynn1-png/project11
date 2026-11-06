"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Barcode, CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { loadIssueBatches, loadProductIssues, resolveProductIssue, submitProductIssue, type IssueBatch, type ProductIssueReport } from "@/app/issues/actions";
import { useInventory } from "@/components/inventory-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useBarcodeScannerCapture } from "@/hooks/use-barcode-scanner-capture";
import { findReceivingProduct } from "@/lib/receiving-selection";

function issueFlag(report: ProductIssueReport) {
  return report.flagKind === "damage" ? "Damaged" : report.flagKind === "issue" ? "Other issue" : report.customFlag ?? "Custom issue";
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(value));
}

export function ProductIssuesView({ canResolve, notify }: { canResolve: boolean; notify: (message: string) => void }) {
  const { products, dataSource } = useInventory();
  const router = useRouter();
  const selectedIdRef = useRef("");
  const [selectedId, setSelectedId] = useState("");
  const [lookup, setLookup] = useState("");
  const [batchId, setBatchId] = useState("");
  const [batches, setBatches] = useState<IssueBatch[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchError, setBatchError] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [flagKind, setFlagKind] = useState<"damage" | "issue" | "custom">("damage");
  const [customFlag, setCustomFlag] = useState("");
  const [description, setDescription] = useState("");
  const [reports, setReports] = useState<ProductIssueReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [hasMoreReports, setHasMoreReports] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const selected = useMemo(() => products.find((product) => product.databaseId === selectedId) ?? null, [products, selectedId]);

  const refreshReports = useCallback(async () => {
    const result = await loadProductIssues();
    if (result.ok) { setReports(result.reports); setHasMoreReports(result.hasMore); }
    else setError(result.message);
    setReportsLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    void loadProductIssues().then((result) => {
      if (!active) return;
      if (result.ok) { setReports(result.reports); setHasMoreReports(result.hasMore); }
      else setError(result.message);
      setReportsLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    void loadIssueBatches(selectedId).then((result) => {
      if (!active) return;
      setBatches(result.ok ? result.batches : []);
      setBatchError(result.ok ? "" : result.message);
      setBatchLoading(false);
    });
    return () => { active = false; };
  }, [selectedId]);

  function chooseProduct(id: string) {
    if (id === selectedId) { setError(""); return; }
    selectedIdRef.current = id;
    setQuantity("1"); setFlagKind("damage"); setCustomFlag(""); setDescription("");
    setSelectedId(id); setBatchId(""); setBatches([]); setBatchError(""); setBatchLoading(Boolean(id)); setError("");
  }

  function findProduct(value: string) {
    const match = findReceivingProduct(products, value);
    if (!match) { setError("No active product matches that barcode or product code."); return; }
    chooseProduct(match.databaseId);
    setLookup(match.barcode);
  }

  useBarcodeScannerCapture(findProduct, !isPending);

  async function loadMoreReports() {
    setLoadingMore(true);
    const result = await loadProductIssues(reports.length);
    if (result.ok) { setReports((current) => [...current, ...result.reports]); setHasMoreReports(result.hasMore); }
    else setError(result.message);
    setLoadingMore(false);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) { setError("Choose a product first."); return; }
    if (dataSource !== "live") { setError("A live database connection is required to report an issue."); return; }
    setError("");
    startTransition(async () => {
      const result = await submitProductIssue({
        productId: selected.databaseId, batchId: batchId || undefined,
        quantity: Number(quantity), flagKind, customFlag, description,
      });
      if (!result.ok) { setError(result.message); return; }
      if (selectedIdRef.current === selected.databaseId) {
        setQuantity("1"); setBatchId(""); setFlagKind("damage"); setCustomFlag(""); setDescription("");
      }
      notify("Product issue submitted. The affected units are unavailable for sale.");
      await refreshReports();
      if (selectedIdRef.current === selected.databaseId) {
        const refreshed = await loadIssueBatches(selected.databaseId);
        if (refreshed.ok && selectedIdRef.current === selected.databaseId) setBatches(refreshed.batches);
      }
      router.refresh();
    });
  }

  function resolve(report: ProductIssueReport, decision: "confirm" | "release") {
    setError("");
    startTransition(async () => {
      const result = await resolveProductIssue({ issueId: report.id, decision, note: resolutionNotes[report.id] ?? "" });
      if (!result.ok) { setError(result.message); return; }
      setResolutionNotes((current) => ({ ...current, [report.id]: "" }));
      notify(decision === "confirm" ? "Product loss confirmed." : "Affected units returned to stock.");
      await refreshReports();
      if (selectedIdRef.current === report.productId) {
        const refreshed = await loadIssueBatches(report.productId);
        if (refreshed.ok && selectedIdRef.current === report.productId) setBatches(refreshed.batches);
      }
      router.refresh();
    });
  }

  return <div className="grid gap-5 xl:grid-cols-[minmax(330px,.85fr)_minmax(0,1.15fr)]">
    <Card className="h-fit border-[var(--border)] bg-[var(--surface)] shadow-none">
      <CardHeader><CardTitle>Report a product issue</CardTitle><CardDescription>Set aside damaged or questionable units so they cannot be sold while management reviews them.</CardDescription></CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={submit}>
          <div><label className="field-label" htmlFor="issue-lookup">Find product</label><div className="flex gap-2"><div className="relative min-w-0 flex-1"><Barcode className="absolute left-3.5 top-3.5 text-[var(--muted-foreground)]" size={18} /><Input id="issue-lookup" className="pl-10" value={lookup} onChange={(event) => setLookup(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); findProduct(event.currentTarget.value); } }} disabled={isPending} placeholder="Barcode or product code" /></div><Button type="button" variant="secondary" disabled={isPending} onClick={() => findProduct(lookup)}>Find</Button></div></div>
          <div><label className="field-label" htmlFor="issue-product">Product</label><select id="issue-product" className="select-field" value={selectedId} onChange={(event) => chooseProduct(event.target.value)} disabled={isPending} required><option value="">Choose a product</option>{products.map((product) => <option key={product.databaseId} value={product.databaseId}>{product.name} · {product.id}</option>)}</select></div>
          {selected && <p className="text-sm text-[var(--muted-foreground)]">{selected.stock} {selected.unit} on hand · {selected.sellableStock} sellable</p>}
          <div className="grid gap-4 sm:grid-cols-2"><div><label className="field-label" htmlFor="issue-quantity">Quantity affected</label><Input id="issue-quantity" type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} required /></div><div><label className="field-label" htmlFor="issue-batch">Affected batch</label><select id="issue-batch" className="select-field" value={batchId} onChange={(event) => setBatchId(event.target.value)} disabled={!selected || batchLoading || Boolean(batchError)}><option value="">Choose oldest available automatically</option>{batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.batchNumber} · {batch.quantityRemaining} left{batch.expiresAt ? ` · expires ${batch.expiresAt}` : ""}</option>)}</select></div></div>
          {batchLoading && <p className="text-sm text-[var(--muted-foreground)]">Loading batches…</p>}
          {batchError && <p className="text-sm text-red-700" role="alert">{batchError}</p>}
          {selected && !batchLoading && !batchError && batches.length === 0 && <p className="text-sm text-amber-700">No stock is available to set aside for this product.</p>}
          <div><label className="field-label" htmlFor="issue-flag">Flag</label><select id="issue-flag" className="select-field" value={flagKind} onChange={(event) => setFlagKind(event.target.value as typeof flagKind)}><option value="damage">Damaged</option><option value="issue">Other issue</option><option value="custom">Custom flag</option></select></div>
          {flagKind === "custom" && <div><label className="field-label" htmlFor="issue-custom-flag">Name the issue</label><Input id="issue-custom-flag" value={customFlag} onChange={(event) => setCustomFlag(event.target.value)} minLength={2} maxLength={80} required placeholder="For example, broken seal" /></div>}
          <div><label className="field-label" htmlFor="issue-description">What happened?</label><Textarea id="issue-description" value={description} onChange={(event) => setDescription(event.target.value)} minLength={5} maxLength={500} required placeholder="Describe the defect or concern" /></div>
          {error && <Alert variant="destructive"><WarningCircle /><AlertTitle>Action could not be completed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
          <Button type="submit" disabled={!selected || batches.length === 0 || batchLoading || Boolean(batchError) || isPending || dataSource !== "live"}>{isPending ? "Submitting…" : "Submit issue report"}</Button>
        </form>
      </CardContent>
    </Card>

    <Card className="border-[var(--border)] bg-[var(--surface)] shadow-none">
      <CardHeader><CardTitle>Reported issues</CardTitle><CardDescription>All staff can track these reports. Managers and administrators resolve pending items.</CardDescription></CardHeader>
      <CardContent className="grid gap-3">
        {reportsLoading ? <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">Loading reports…</p> : reports.length === 0 ? <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">No product issues have been reported yet.</p> : reports.map((report) => <article key={report.id} className="rounded-xl border border-[var(--border)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{report.productName}</p><p className="text-xs text-[var(--muted-foreground)]">{report.productCode} · {dateTime(report.reportedAt)} · {report.reporterName}</p></div><Badge variant={report.status === "confirmed" ? "default" : "outline"}>{report.status === "pending" ? "Pending review" : report.status === "confirmed" ? "Loss confirmed" : "Returned to stock"}</Badge></div>
          <p className="mt-3 text-sm"><strong>{report.quantity} affected</strong> · {issueFlag(report)}</p>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">{report.description}</p>
          <p className="mt-2 text-xs text-[var(--muted-foreground)]">Batches: {report.batches.map((batch) => `${batch.batchNumber} (${batch.quantity})`).join(", ") || "Unavailable"}</p>
          {report.resolvedAt && <p className="mt-3 border-t border-[var(--border)] pt-3 text-sm text-[var(--muted-foreground)]">Resolved by {report.resolverName ?? "Former staff member"} on {dateTime(report.resolvedAt)}: {report.resolutionNote}</p>}
          {canResolve && report.status === "pending" && <div className="mt-4 grid gap-2 border-t border-[var(--border)] pt-4"><label className="field-label" htmlFor={`issue-resolution-${report.id}`}>Resolution note</label><Textarea id={`issue-resolution-${report.id}`} value={resolutionNotes[report.id] ?? ""} onChange={(event) => setResolutionNotes((current) => ({ ...current, [report.id]: event.target.value }))} minLength={2} maxLength={500} placeholder="Explain the decision" /><div className="flex flex-wrap gap-2"><Button size="sm" disabled={isPending || (resolutionNotes[report.id] ?? "").trim().length < 2} onClick={() => resolve(report, "confirm")}><CheckCircle size={16} />Confirm loss</Button><Button size="sm" variant="secondary" disabled={isPending || (resolutionNotes[report.id] ?? "").trim().length < 2} onClick={() => resolve(report, "release")}>Return to stock</Button></div></div>}
        </article>)}
        {!reportsLoading && hasMoreReports && <Button type="button" variant="secondary" disabled={loadingMore || isPending} onClick={() => void loadMoreReports()}>{loadingMore ? "Loading…" : "Load more reports"}</Button>}
      </CardContent>
    </Card>
  </div>;
}
