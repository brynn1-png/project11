"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowsDownUp,
  CalendarBlank,
  DownloadSimple,
  MagnifyingGlass,
  Package,
  Printer,
  Receipt,
  Warning,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  loadExpiringInventoryReport,
  loadSalesReport,
  loadStockMovementReport,
  type ExpiringInventoryReportRow,
  type SalesReportRow,
  type StockMovementReportRow,
} from "@/app/reports/actions";
import { useInventory } from "@/components/inventory-provider";
import { TablePagination } from "@/components/table-pagination";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createCsv, groupSalesByReceipt } from "@/lib/reporting";
import { paginateItems } from "@/lib/pagination";
import { getStockStatus } from "@/lib/types";
import { formatQuantity } from "@/lib/units";

type ReportType = "sales" | "inventory" | "movement" | "low-stock" | "expiry";
type SalesLayout = "receipts" | "items";
type ReportPaginationProps = {
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

function manilaToday() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function offsetDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function monthStart(date: string) {
  return `${date.slice(0, 8)}01`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(
    new Date(`${value}T00:00:00+08:00`),
  );
}

function peso(value: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);
}

function includesSearch(values: unknown[], search: string) {
  const query = search.trim().toLocaleLowerCase();
  return !query || values.some((value) => String(value ?? "").toLocaleLowerCase().includes(query));
}

function downloadCsv(filename: string, rows: unknown[][]) {
  const blob = new Blob([createCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function ReportsView({
  notify,
  canViewSales,
  canViewAllSales,
}: {
  notify: (message: string) => void;
  canViewSales: boolean;
  canViewAllSales: boolean;
}) {
  const { products } = useInventory();
  const [today] = useState(manilaToday);
  const [report, setReport] = useState<ReportType>(canViewSales ? "sales" : "inventory");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [salesLayout, setSalesLayout] = useState<SalesLayout>("receipts");
  const [search, setSearch] = useState("");
  const [movementType, setMovementType] = useState("All movements");
  const [expiryDays, setExpiryDays] = useState(30);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [salesRows, setSalesRows] = useState<SalesReportRow[]>([]);
  const [movementRows, setMovementRows] = useState<StockMovementReportRow[]>([]);
  const [expiryRows, setExpiryRows] = useState<ExpiringInventoryReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  const loadRemoteReport = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError("");

    if ((report === "sales" || report === "movement") && (
      startDate > endDate
      || (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000 > 30
    )) {
      setLoading(false);
      setError("Choose a valid date range of 31 days or fewer.");
      return;
    }

    const result = report === "sales"
      ? await loadSalesReport({ startDate, endDate })
      : report === "movement"
        ? await loadStockMovementReport({ startDate, endDate })
        : await loadExpiringInventoryReport({ asOf: today, daysAhead: expiryDays });

    if (currentRequest !== requestId.current) return;
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    if (report === "sales") setSalesRows(result.rows as SalesReportRow[]);
    if (report === "movement") setMovementRows(result.rows as StockMovementReportRow[]);
    if (report === "expiry") setExpiryRows(result.rows as ExpiringInventoryReportRow[]);
  }, [endDate, expiryDays, report, startDate, today]);

  useEffect(() => {
    if (report !== "sales" && report !== "movement" && report !== "expiry") return;
    const timer = window.setTimeout(() => void loadRemoteReport(), 0);
    return () => window.clearTimeout(timer);
  }, [loadRemoteReport, report]);

  const receiptRows = useMemo(() => groupSalesByReceipt(salesRows), [salesRows]);
  const filteredReceiptRows = useMemo(() => receiptRows.filter((row) => includesSearch([
    row.saleNumber,
    row.cashierName,
    row.products,
    row.status,
  ], search)), [receiptRows, search]);
  const filteredSalesItems = useMemo(() => salesRows.filter((row) => includesSearch([
    row.saleNumber,
    row.cashierName,
    row.productCode,
    row.productName,
    row.barcode,
    row.categoryName,
  ], search)), [salesRows, search]);
  const filteredInventory = useMemo(() => products.filter((product) => includesSearch([
    product.id,
    product.name,
    product.barcode,
    product.category,
    getStockStatus(product),
  ], search)), [products, search]);
  const lowStock = useMemo(() => filteredInventory.filter((product) => getStockStatus(product) !== "In Stock"), [filteredInventory]);
  const filteredMovement = useMemo(() => movementRows.filter((row) =>
    (movementType === "All movements" || row.type === movementType)
    && includesSearch([row.reference, row.productCode, row.productName, row.barcode, row.actorName, row.notes], search)),
  [movementRows, movementType, search]);
  const filteredExpiry = useMemo(() => expiryRows.filter((row) => includesSearch([
    row.productCode,
    row.productName,
    row.barcode,
    row.categoryName,
    row.batchNumber,
  ], search)), [expiryRows, search]);

  const reportCount = report === "sales"
    ? salesLayout === "receipts" ? filteredReceiptRows.length : filteredSalesItems.length
    : report === "inventory" ? filteredInventory.length
      : report === "movement" ? filteredMovement.length
        : report === "low-stock" ? lowStock.length
          : filteredExpiry.length;

  function setDatePreset(value: string) {
    setPage(1);
    if (value === "today") {
      setStartDate(today);
      setEndDate(today);
    } else if (value === "yesterday") {
      setStartDate(offsetDate(today, -1));
      setEndDate(offsetDate(today, -1));
    } else if (value === "seven-days") {
      setStartDate(offsetDate(today, -6));
      setEndDate(today);
    } else if (value === "month") {
      setStartDate(monthStart(today));
      setEndDate(today);
    }
  }

  function exportCurrentReport() {
    const stamp = report === "sales" || report === "movement" ? `${startDate}-to-${endDate}` : today;
    if (report === "sales" && salesLayout === "receipts") {
      downloadCsv(`daily-sales-receipts-${stamp}.csv`, [
        ["Receipt", "Date and time", "Cashier", "Products", "Product count", "Item count", "Returned items", "Total", "Cash received", "Change", "Status"],
        ...filteredReceiptRows.map((row) => [row.saleNumber, formatDateTime(row.soldAt), row.cashierName, row.products, row.productCount, row.itemCount, row.returnedItemCount, row.total, row.cashReceived, row.changeDue, row.status]),
      ]);
    } else if (report === "sales") {
      downloadCsv(`daily-sales-items-${stamp}.csv`, [
        ["Receipt", "Date and time", "Cashier", "Product code", "Product", "Barcode", "Category", "Quantity", "Returned quantity", "Unit price", "Line total", "Receipt total", "Status"],
        ...filteredSalesItems.map((row) => [row.saleNumber, formatDateTime(row.soldAt), row.cashierName, row.productCode, row.productName, row.barcode, row.categoryName, row.quantity, row.returnedQuantity, row.unitPrice, row.lineTotal, row.saleTotal, row.status]),
      ]);
    } else if (report === "movement") {
      downloadCsv(`stock-movement-${stamp}.csv`, [
        ["Date and time", "Reference", "Type", "Product code", "Product", "Barcode", "Quantity change", "Recorded by", "Notes"],
        ...filteredMovement.map((row) => [formatDateTime(row.occurredAt), row.reference, row.type, row.productCode, row.productName, row.barcode, row.quantityChange, row.actorName, row.notes ?? ""]),
      ]);
    } else if (report === "expiry") {
      downloadCsv(`expiring-products-${today}.csv`, [
        ["Product code", "Product", "Barcode", "Category", "Batch", "Quantity remaining", "Unit", "Expiry date", "Days until expiry"],
        ...filteredExpiry.map((row) => [row.productCode, row.productName, row.barcode, row.categoryName, row.batchNumber ?? "—", row.quantityRemaining, row.stockUnit, row.expiresAt, row.daysUntilExpiry]),
      ]);
    } else {
      const rows = report === "low-stock" ? lowStock : filteredInventory;
      downloadCsv(`${report === "low-stock" ? "low-stock" : "current-inventory"}-${today}.csv`, [
        ["Product code", "Product", "Barcode", "Category", "Quantity", "Unit", "Minimum stock", "Unit price", "Retail value", "Status"],
        ...rows.map((product) => [product.id, product.name, product.barcode, product.category, product.stock, product.unit, product.minimumStock, product.price, product.stock * product.price, getStockStatus(product)]),
      ]);
    }
    notify("Report downloaded as CSV.");
  }

  const dateRangeInvalid = startDate > endDate || (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000 > 30;
  const pagination: ReportPaginationProps = {
    page,
    pageSize,
    onPageChange: setPage,
    onPageSizeChange: (size) => { setPageSize(size); setPage(1); },
  };

  return (
    <Tabs value={report} onValueChange={(value) => { requestId.current += 1; setLoading(false); setReport(value as ReportType); setSearch(""); setError(""); setPage(1); }} className="grid gap-4">
      <div className="no-print overflow-x-auto pb-1">
        <TabsList className="h-auto min-w-max justify-start">
          {canViewSales && <TabsTrigger value="sales"><Receipt aria-hidden="true" />Daily Sales</TabsTrigger>}
          <TabsTrigger value="inventory"><Package aria-hidden="true" />Current Inventory</TabsTrigger>
          <TabsTrigger value="movement"><ArrowsDownUp aria-hidden="true" />Stock Movement</TabsTrigger>
          <TabsTrigger value="low-stock"><Warning aria-hidden="true" />Low Stock</TabsTrigger>
          <TabsTrigger value="expiry"><CalendarBlank aria-hidden="true" />Expiring Products</TabsTrigger>
        </TabsList>
      </div>

      <section className="panel overflow-hidden">
        <ReportHeader report={report} startDate={startDate} endDate={endDate} expiryDays={expiryDays} />

        <div className="no-print grid gap-4 border-b border-[var(--border)] bg-[var(--muted)]/45 p-4 sm:p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex flex-1 flex-wrap items-end gap-3">
              {(report === "sales" || report === "movement") && (
                <>
                  <FilterField label="Date range" htmlFor="report-date-preset">
                    <select id="report-date-preset" className="select-field min-w-40" defaultValue="today" onChange={(event) => setDatePreset(event.target.value)}>
                      <option value="today">Today</option>
                      <option value="yesterday">Yesterday</option>
                      <option value="seven-days">Last 7 days</option>
                      <option value="month">This month</option>
                      <option value="custom">Custom range</option>
                    </select>
                  </FilterField>
                  <FilterField label="From" htmlFor="report-start-date"><Input id="report-start-date" type="date" value={startDate} max={endDate} onChange={(event) => { setStartDate(event.target.value); setPage(1); }} /></FilterField>
                  <FilterField label="To" htmlFor="report-end-date"><Input id="report-end-date" type="date" value={endDate} min={startDate} onChange={(event) => { setEndDate(event.target.value); setPage(1); }} /></FilterField>
                </>
              )}
              {report === "sales" && (
                <FilterField label="Report detail" htmlFor="sales-layout">
                  <select id="sales-layout" className="select-field min-w-44" value={salesLayout} onChange={(event) => { setSalesLayout(event.target.value as SalesLayout); setPage(1); }}>
                    <option value="receipts">One row per receipt</option>
                    <option value="items">Item details</option>
                  </select>
                </FilterField>
              )}
              {report === "movement" && (
                <FilterField label="Movement" htmlFor="movement-type">
                  <select id="movement-type" className="select-field min-w-44" value={movementType} onChange={(event) => { setMovementType(event.target.value); setPage(1); }}>
                    <option>All movements</option><option>Stock received</option><option>Stock sold</option><option>Stock restored</option><option>Stock adjusted</option>
                  </select>
                </FilterField>
              )}
              {report === "expiry" && (
                <FilterField label="Expiry window" htmlFor="expiry-days">
                  <select id="expiry-days" className="select-field min-w-44" value={expiryDays} onChange={(event) => { setExpiryDays(Number(event.target.value)); setPage(1); }}>
                    <option value={7}>Next 7 days</option><option value={30}>Next 30 days</option><option value={90}>Next 90 days</option><option value={365}>Next 12 months</option>
                  </select>
                </FilterField>
              )}
              <div className="relative min-w-60 flex-1 xl:max-w-sm">
                <label className="field-label" htmlFor="report-search">Search report</label>
                <MagnifyingGlass className="absolute bottom-3 left-3.5 text-[var(--muted-foreground)]" size={18} aria-hidden="true" />
                <Input id="report-search" className="pl-10" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Product, barcode, receipt, or staff" />
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="secondary" onClick={() => window.print()} disabled={loading || dateRangeInvalid || reportCount === 0}><Printer aria-hidden="true" />Print / Save PDF</Button>
              <Button onClick={exportCurrentReport} disabled={loading || dateRangeInvalid || reportCount === 0}><DownloadSimple aria-hidden="true" />Download CSV</Button>
            </div>
          </div>
        </div>

        {error && <div className="p-5"><Alert variant="destructive"><WarningCircle aria-hidden="true" /><AlertTitle>Report unavailable</AlertTitle><AlertDescription>{error}</AlertDescription></Alert></div>}
        {loading ? <ReportLoading /> : !error && (
          <>
            {report === "sales" && <SalesReport rows={salesLayout === "receipts" ? filteredReceiptRows : filteredSalesItems} layout={salesLayout} canViewAllSales={canViewAllSales} pagination={pagination} />}
            {report === "inventory" && <InventoryReport rows={filteredInventory} pagination={pagination} />}
            {report === "movement" && <MovementReport rows={filteredMovement} pagination={pagination} />}
            {report === "low-stock" && <LowStockReport rows={lowStock} pagination={pagination} />}
            {report === "expiry" && <ExpiryReport rows={filteredExpiry} pagination={pagination} />}
          </>
        )}
      </section>
    </Tabs>
  );
}

function ReportHeader({ report, startDate, endDate, expiryDays }: { report: ReportType; startDate: string; endDate: string; expiryDays: number }) {
  const copy: Record<ReportType, { title: string; description: string }> = {
    sales: { title: "Daily sales report", description: `Sales recorded from ${formatDate(startDate)} to ${formatDate(endDate)}.` },
    inventory: { title: "Current inventory report", description: "Live quantities, selling prices, and retail value for active products." },
    movement: { title: "Stock movement report", description: `Stock received, sold, restored, or adjusted from ${formatDate(startDate)} to ${formatDate(endDate)}.` },
    "low-stock": { title: "Low-stock report", description: "Products at or below their restock level, including out-of-stock items." },
    expiry: { title: "Expiring products report", description: `Remaining batches that are expired or due within ${expiryDays} days.` },
  };
  return <header className="flex flex-col gap-2 border-b border-[var(--border)] p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--accent)]">South Emerald</p><h2 className="mt-1 text-xl font-bold tracking-[-0.02em]">{copy[report].title}</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">{copy[report].description}</p></div><p className="text-xs text-[var(--muted-foreground)]">Generated {formatDateTime(new Date().toISOString())}</p></header>;
}

function FilterField({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return <div><label className="field-label" htmlFor={htmlFor}>{label}</label>{children}</div>;
}

function SummaryStrip({ items }: { items: { label: string; value: string | number; tone?: "warning" | "danger" }[] }) {
  return <div className="grid border-b border-[var(--border)] sm:grid-cols-2 lg:grid-cols-4">{items.map((item, index) => <div key={item.label} className={`p-4 sm:p-5 ${index > 0 ? "border-t border-[var(--border)] sm:border-t-0 sm:border-l" : ""}`}><p className="text-xs font-semibold text-[var(--muted-foreground)]">{item.label}</p><p className={`mt-1 text-xl font-bold tracking-[-0.02em] ${item.tone === "danger" ? "text-red-700" : item.tone === "warning" ? "text-amber-800" : ""}`}>{item.value}</p></div>)}</div>;
}

function SalesReport({ rows, layout, canViewAllSales, pagination }: { rows: ReturnType<typeof groupSalesByReceipt> | SalesReportRow[]; layout: SalesLayout; canViewAllSales: boolean; pagination: ReportPaginationProps }) {
  const receipts = layout === "receipts" ? rows as ReturnType<typeof groupSalesByReceipt> : groupSalesByReceipt(rows as SalesReportRow[]);
  const completed = receipts.filter((row) => row.status === "completed");
  const revenue = completed.reduce((sum, row) => sum + row.total, 0);
  const items = completed.reduce((sum, row) => sum + row.itemCount, 0);
  return <>
    <SummaryStrip items={[{ label: "Completed receipts", value: completed.length }, { label: "Sales total", value: peso(revenue) }, { label: "Items sold", value: items }, { label: "Report scope", value: canViewAllSales ? "All staff" : "Your sales" }]} />
    {rows.length > 0 ? layout === "receipts"
      ? <PaginatedReportTable rows={rows as ReturnType<typeof groupSalesByReceipt>} itemLabel="receipts" {...pagination}>{(items) => <table className="data-table min-w-[980px]"><thead><tr><th>Receipt</th><th>Date and time</th><th>Cashier</th><th>Products</th><th>Items</th><th>Returned</th><th>Total</th><th>Status</th></tr></thead><tbody>{items.map((row) => <tr key={row.saleNumber}><td className="font-semibold">#{row.saleNumber}</td><td>{formatDateTime(row.soldAt)}</td><td>{row.cashierName}</td><td><p className="max-w-72 truncate font-semibold" title={row.products}>{row.products}</p><p className="text-xs text-[var(--muted-foreground)]">{row.productCount} product{row.productCount === 1 ? "" : "s"}</p></td><td className="font-semibold">{row.itemCount}</td><td>{row.returnedItemCount || "—"}</td><td className="font-semibold">{peso(row.total)}</td><td><SaleStatus status={row.status} /></td></tr>)}</tbody></table>}</PaginatedReportTable>
      : <PaginatedReportTable rows={rows as SalesReportRow[]} itemLabel="sale items" {...pagination}>{(items) => <table className="data-table min-w-[1120px]"><thead><tr><th>Receipt</th><th>Date and time</th><th>Cashier</th><th>Product</th><th>Barcode</th><th>Qty</th><th>Returned</th><th>Unit price</th><th>Line total</th><th>Status</th></tr></thead><tbody>{items.map((row) => <tr key={`${row.saleNumber}-${row.productCode}`}><td className="font-semibold">#{row.saleNumber}</td><td>{formatDateTime(row.soldAt)}</td><td>{row.cashierName}</td><td><p className="font-semibold">{row.productName}</p><p className="text-xs text-[var(--muted-foreground)]">{row.productCode}</p></td><td className="font-mono text-xs">{row.barcode}</td><td className="font-semibold">{row.quantity}</td><td>{row.returnedQuantity || "—"}</td><td>{peso(row.unitPrice)}</td><td className="font-semibold">{peso(row.lineTotal)}</td><td><SaleStatus status={row.status} /></td></tr>)}</tbody></table>}</PaginatedReportTable>
      : <ReportEmpty title="No sales found" description="No sales match the selected date range and search." icon={<Receipt />} />}
  </>;
}

function InventoryReport({ rows, pagination }: { rows: ReturnType<typeof useInventory>["products"]; pagination: ReportPaginationProps }) {
  const totalUnits = rows.reduce((sum, product) => sum + product.stock, 0);
  const value = rows.reduce((sum, product) => sum + product.stock * product.price, 0);
  const attention = rows.filter((product) => getStockStatus(product) !== "In Stock").length;
  return <><SummaryStrip items={[{ label: "Active products", value: rows.length }, { label: "Units on hand", value: totalUnits }, { label: "Retail inventory value", value: peso(value) }, { label: "Needs attention", value: attention, tone: attention ? "warning" : undefined }]} />{rows.length > 0 ? <PaginatedReportTable rows={rows} itemLabel="products" {...pagination}>{(items) => <InventoryTable rows={items} />}</PaginatedReportTable> : <ReportEmpty title="No inventory found" description="No products match your search." icon={<Package />} />}</>;
}

function LowStockReport({ rows, pagination }: { rows: ReturnType<typeof useInventory>["products"]; pagination: ReportPaginationProps }) {
  const out = rows.filter((product) => product.stock === 0).length;
  const shortfall = rows.reduce((sum, product) => sum + Math.max(product.minimumStock - product.stock, 0), 0);
  return <><SummaryStrip items={[{ label: "Products to restock", value: rows.length, tone: rows.length ? "warning" : undefined }, { label: "Out of stock", value: out, tone: out ? "danger" : undefined }, { label: "Units below minimum", value: shortfall }, { label: "Stock status", value: rows.length ? "Action needed" : "Healthy" }]} />{rows.length > 0 ? <PaginatedReportTable rows={rows} itemLabel="products" {...pagination}>{(items) => <InventoryTable rows={items} />}</PaginatedReportTable> : <ReportEmpty title="Stock levels look healthy" description="Every matching product is above its minimum stock level." icon={<Warning />} />}</>;
}

function InventoryTable({ rows }: { rows: ReturnType<typeof useInventory>["products"] }) {
  return <table className="data-table min-w-[900px]"><thead><tr><th>Product</th><th>Barcode</th><th>Category</th><th>Current stock</th><th>Minimum</th><th>Unit price</th><th>Retail value</th><th>Status</th></tr></thead><tbody>{rows.map((product) => <tr key={product.databaseId}><td><p className="font-semibold">{product.name}</p><p className="text-xs text-[var(--muted-foreground)]">{product.id}</p></td><td className="font-mono text-xs">{product.barcode}</td><td>{product.category}</td><td className="font-semibold">{formatQuantity(product.stock, product.unit)}</td><td>{formatQuantity(product.minimumStock, product.unit)}</td><td>{peso(product.price)}</td><td className="font-semibold">{peso(product.stock * product.price)}</td><td><StatusBadge status={getStockStatus(product)} /></td></tr>)}</tbody></table>;
}

function MovementReport({ rows, pagination }: { rows: StockMovementReportRow[]; pagination: ReportPaginationProps }) {
  const received = rows.filter((row) => row.quantityChange > 0).reduce((sum, row) => sum + row.quantityChange, 0);
  const released = rows.filter((row) => row.quantityChange < 0).reduce((sum, row) => sum + Math.abs(row.quantityChange), 0);
  return <><SummaryStrip items={[{ label: "Movements", value: rows.length }, { label: "Units added", value: `+${received}` }, { label: "Units removed", value: `−${released}` }, { label: "Net change", value: `${received - released >= 0 ? "+" : ""}${received - released}` }]} />{rows.length > 0 ? <PaginatedReportTable rows={rows} itemLabel="movements" {...pagination}>{(items) => <table className="data-table min-w-[1040px]"><thead><tr><th>Date and time</th><th>Reference</th><th>Type</th><th>Product</th><th>Quantity change</th><th>Recorded by</th><th>Notes</th></tr></thead><tbody>{items.map((row) => <tr key={row.id}><td>{formatDateTime(row.occurredAt)}</td><td className="font-semibold">{row.reference}</td><td><Badge variant="outline">{row.type}</Badge></td><td><p className="font-semibold">{row.productName}</p><p className="text-xs text-[var(--muted-foreground)]">{row.productCode} · {row.barcode}</p></td><td className={`font-bold ${row.quantityChange > 0 ? "text-emerald-700" : "text-orange-700"}`}>{row.quantityChange > 0 ? "+" : ""}{row.quantityChange}</td><td>{row.actorName}</td><td className="max-w-64 text-[var(--muted-foreground)]">{row.notes || "—"}</td></tr>)}</tbody></table>}</PaginatedReportTable> : <ReportEmpty title="No stock movement found" description="No inventory changes match the selected filters." icon={<ArrowsDownUp />} />}</>;
}

function ExpiryReport({ rows, pagination }: { rows: ExpiringInventoryReportRow[]; pagination: ReportPaginationProps }) {
  const expired = rows.filter((row) => row.daysUntilExpiry < 0).length;
  const sevenDays = rows.filter((row) => row.daysUntilExpiry >= 0 && row.daysUntilExpiry <= 7).length;
  const units = rows.reduce((sum, row) => sum + row.quantityRemaining, 0);
  return <><SummaryStrip items={[{ label: "Affected batches", value: rows.length }, { label: "Expired", value: expired, tone: expired ? "danger" : undefined }, { label: "Due within 7 days", value: sevenDays, tone: sevenDays ? "warning" : undefined }, { label: "Units affected", value: units }]} />{rows.length > 0 ? <PaginatedReportTable rows={rows} itemLabel="batches" {...pagination}>{(items) => <table className="data-table min-w-[980px]"><thead><tr><th>Product</th><th>Barcode</th><th>Category</th><th>Batch</th><th>Remaining</th><th>Expiry date</th><th>Status</th></tr></thead><tbody>{items.map((row) => <tr key={row.batchId}><td><p className="font-semibold">{row.productName}</p><p className="text-xs text-[var(--muted-foreground)]">{row.productCode}</p></td><td className="font-mono text-xs">{row.barcode}</td><td>{row.categoryName}</td><td>{row.batchNumber || "—"}</td><td className="font-semibold">{formatQuantity(row.quantityRemaining, row.stockUnit)}</td><td>{formatDate(row.expiresAt)}</td><td><ExpiryStatus days={row.daysUntilExpiry} /></td></tr>)}</tbody></table>}</PaginatedReportTable> : <ReportEmpty title="No expiring products" description="No remaining batches expire within the selected window." icon={<CalendarBlank />} />}</>;
}

function PaginatedReportTable<T>({ rows, page, pageSize, itemLabel, onPageChange, onPageSizeChange, children }: ReportPaginationProps & { rows: T[]; itemLabel: string; children: (items: T[]) => React.ReactNode }) {
  const result = paginateItems(rows, page, pageSize);
  return <div><div className="overflow-x-auto">{children(result.items)}</div><div className="no-print"><TablePagination {...result} pageSize={pageSize} itemLabel={itemLabel} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} /></div></div>;
}

function SaleStatus({ status }: { status: SalesReportRow["status"] }) {
  return <Badge variant={status === "completed" ? "outline" : "destructive"} className={status === "completed" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : ""}>{status === "completed" ? "Completed" : "Voided"}</Badge>;
}

function ExpiryStatus({ days }: { days: number }) {
  if (days < 0) return <Badge variant="destructive">Expired {Math.abs(days)}d ago</Badge>;
  if (days === 0) return <Badge variant="destructive">Expires today</Badge>;
  if (days <= 7) return <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-900">{days}d remaining</Badge>;
  return <Badge variant="outline">{days}d remaining</Badge>;
}

function ReportEmpty({ title, description, icon }: { title: string; description: string; icon: React.ReactNode }) {
  return <Empty className="min-h-72"><EmptyHeader><EmptyMedia variant="icon">{icon}</EmptyMedia><EmptyTitle>{title}</EmptyTitle><EmptyDescription>{description}</EmptyDescription></EmptyHeader></Empty>;
}

function ReportLoading() {
  return <div aria-label="Loading report" className="grid gap-0"><div className="grid border-b border-[var(--border)] sm:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="border-b border-[var(--border)] p-5 last:border-b-0 sm:border-b-0 sm:border-r"><Skeleton className="h-3 w-24" /><Skeleton className="mt-3 h-7 w-32" /></div>)}</div><div className="grid gap-3 p-5">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-11 w-full" />)}</div></div>;
}
