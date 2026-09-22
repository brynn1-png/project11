"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowCounterClockwise, ArrowDown, ArrowUp, Bell, CaretRight, ChartBar,
  Check, CirclesFour, ClockCounterClockwise, List,
  Package, Scan, ShoppingCart, SignOut, Storefront, Users, Warning, X,
} from "@phosphor-icons/react";
import { logout } from "@/app/login/actions";
import { useInventory } from "@/components/inventory-provider";
import { SalesView } from "@/components/sales-view";
import { ReturnsView } from "@/components/returns-view";
import { SalesVerificationView } from "@/components/sales-verification-view";
import { ProductManagementView } from "@/components/product-management-view";
import { StockInView } from "@/components/stock-in-view";
import { HistoryView } from "@/components/history-view";
import { DashboardCharts } from "@/components/dashboard-charts";
import { ReportsView } from "@/components/reports-view";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import { getStockStatus, type UserProfile } from "@/lib/types";
import { groupActivityByReceipt, type ReceiptActivity } from "@/lib/activity-groups";
import { getStockAlerts, type StockAlert } from "@/lib/stock-alerts";
import { formatQuantity, pluralizeUnit } from "@/lib/units";
import { formatRole, hasPermission, type Permission } from "@/lib/auth/permissions";
import type { CurrentUser } from "@/lib/auth/current-user";
import { APP_SHORT_NAME } from "@/lib/ui-copy";

type View = "dashboard" | "products" | "sales" | "returns" | "stock-in" | "inventory" | "transactions" | "sales-review" | "reports" | "users";
type InventoryFilter = "All" | "In Stock" | "Low Stock" | "Out of Stock";

type NavItem = { id: View; label: string; icon: typeof CirclesFour };

const NAV_GROUPS: { id: string; label: string; items: NavItem[] }[] = [
  {
    id: "overview",
    label: "Overview",
    items: [{ id: "dashboard", label: "Dashboard", icon: CirclesFour }],
  },
  {
    id: "sales",
    label: "Sales",
    items: [
      { id: "sales", label: "Sales", icon: ShoppingCart },
      { id: "returns", label: "Returns", icon: ArrowCounterClockwise },
    ],
  },
  {
    id: "inventory",
    label: "Inventory",
    items: [
      { id: "products", label: "Products", icon: Package },
      { id: "stock-in", label: "Receive Stock", icon: ArrowDown },
      { id: "inventory", label: "Stock Levels", icon: Storefront },
    ],
  },
  {
    id: "records-control",
    label: "Records & Control",
    items: [
      { id: "transactions", label: "Activity & Receipts", icon: ClockCounterClockwise },
      { id: "sales-review", label: "Daily Verification", icon: Check },
      { id: "reports", label: "Reports", icon: ChartBar },
    ],
  },
  {
    id: "administration",
    label: "Administration",
    items: [{ id: "users", label: "Staff Accounts", icon: Users }],
  },
];

const VIEW_PERMISSIONS: Partial<Record<View, Permission>> = {
  dashboard: "dashboard:view",
  products: "products:view",
  "stock-in": "stock:receive",
  sales: "sales:record",
  returns: "sales:record",
  inventory: "products:view",
  transactions: "transactions:view_own",
  "sales-review": "sales:verify",
  reports: "reports:view_sales_own",
  users: "users:manage",
};

const VIEW_TITLES: Record<View, string> = {
  dashboard: "Dashboard",
  products: "Products",
  sales: "Sales",
  returns: "Returns",
  "stock-in": "Receive Stock",
  inventory: "Stock Levels",
  transactions: "Activity & Receipts",
  "sales-review": "Daily Verification",
  reports: "Reports",
  users: "Staff Accounts",
};

function formatDate(value: string, withTime = true) {
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}) }).format(new Date(value));
}

function peso(value: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);
}

export function InventoryApp({ currentUser, users, dataError }: { currentUser: CurrentUser; users: UserProfile[]; dataError: string | null }) {
  const [view, setView] = useState<View>("dashboard");
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState("");
  const [receivingProductId, setReceivingProductId] = useState<string | null>(null);
  const [startProductRegistration, setStartProductRegistration] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [inventoryFilter, setInventoryFilter] = useState<InventoryFilter>("All");
  const notificationRef = useRef<HTMLDivElement>(null);
  const notificationButtonRef = useRef<HTMLButtonElement>(null);
  const toastTimerRef = useRef<number | null>(null);
  const reduceMotion = useReducedMotion();
  const { products, dataSource, lastSyncedAt } = useInventory();
  const stockAlerts = useMemo(() => getStockAlerts(products), [products]);
  const previousAlertCount = useRef(stockAlerts.length);
  const [alertAttention, setAlertAttention] = useState(false);
  const canReceiveStock = hasPermission(currentUser.role, "stock:receive");

  useEffect(() => {
    const previousCount = previousAlertCount.current;
    previousAlertCount.current = stockAlerts.length;

    if (stockAlerts.length <= previousCount || stockAlerts.length === 0 || notificationOpen || reduceMotion) {
      setAlertAttention(false);
      return;
    }

    setAlertAttention(true);
    const attentionTimer = window.setTimeout(() => setAlertAttention(false), 900);
    return () => window.clearTimeout(attentionTimer);
  }, [notificationOpen, reduceMotion, stockAlerts.length]);

  useEffect(() => {
    if (!notificationOpen) return;

    function closeOnOutsidePointer(event: PointerEvent) {
      if (notificationRef.current?.contains(event.target as Node)) return;
      setNotificationOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setNotificationOpen(false);
      notificationButtonRef.current?.focus();
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [notificationOpen]);

  useEffect(() => () => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
  }, []);

  function notify(message: string) {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    setToast(message);
    toastTimerRef.current = window.setTimeout(() => {
      setToast("");
      toastTimerRef.current = null;
    }, 3200);
  }

  function navigate(next: View) {
    if (next === "stock-in") setReceivingProductId(null);
    if (next === "products") setStartProductRegistration(false);
    setNotificationOpen(false);
    setView(next);
  }

  function openStockAlert(alert: StockAlert) {
    setNotificationOpen(false);
    if (canReceiveStock) {
      setReceivingProductId(alert.product.databaseId);
      setView("stock-in");
      return;
    }
    setInventoryFilter(alert.status);
    setView("inventory");
  }

  const pageTitle = view === "dashboard" ? `Good morning, ${currentUser.fullName.split(" ")[0]}` : VIEW_TITLES[view];
  return (
    <div className="min-h-[100dvh] bg-[var(--background)]">
      <Sidebar currentUser={currentUser} view={view} open={mobileNav} onClose={() => setMobileNav(false)} onNavigate={(next) => { navigate(next); setMobileNav(false); }} />

      <div className="lg:pl-[264px]">
        <header className="no-print sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[var(--border)] bg-[color:rgba(247,249,242,.92)] px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <button className="grid size-11 place-items-center rounded-xl hover:bg-[var(--muted)] lg:hidden" onClick={() => setMobileNav(true)} aria-label="Open navigation"><List size={22} /></button>
          <div className="hidden items-center gap-2 text-sm text-[var(--muted-foreground)] lg:flex"><span>South Emerald</span><CaretRight size={14} /><span className="font-semibold text-[var(--foreground)]">{VIEW_TITLES[view]}</span></div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden rounded-lg bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-bold text-[var(--accent-strong)] sm:inline" title={lastSyncedAt ? `Last synchronized ${formatDate(lastSyncedAt)}` : undefined}>{dataSource === "live" ? "Live inventory" : dataSource === "cached" ? "Cached inventory" : "Data unavailable"}</span>
            <div className="relative" ref={notificationRef}>
              <button
                ref={notificationButtonRef}
                className={cn(
                  "relative flex min-h-11 items-center justify-center gap-2 rounded-xl transition-[background-color,border-color,color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2",
                  stockAlerts.length > 0
                    ? "min-w-11 border border-amber-300 bg-amber-50 px-2 text-amber-950 hover:bg-amber-100 sm:px-3"
                    : "size-11 text-[var(--muted-foreground)] hover:bg-[var(--muted)]",
                  alertAttention && "stock-alert-attention",
                )}
                aria-label={stockAlerts.length === 0 ? "No stock alerts" : `${stockAlerts.length} stock alert${stockAlerts.length === 1 ? "" : "s"}`}
                aria-expanded={notificationOpen}
                aria-controls="stock-alerts-panel"
                onClick={() => setNotificationOpen((open) => !open)}
              >
                <Bell aria-hidden="true" size={20} weight={stockAlerts.length > 0 ? "fill" : "regular"} />
                {stockAlerts.length > 0 && (
                  <>
                    <span aria-hidden="true" className="hidden text-xs font-bold sm:inline">Stock alerts</span>
                    <span aria-hidden="true" className="grid min-h-5 min-w-5 place-items-center rounded-md bg-red-700 px-1.5 text-[0.6875rem] font-bold leading-none text-white">{stockAlerts.length > 99 ? "99+" : stockAlerts.length}</span>
                  </>
                )}
              </button>
              <span className="sr-only" aria-live="polite">{stockAlerts.length > 0 ? `${stockAlerts.length} products need stock attention.` : "No products need stock attention."}</span>
              {notificationOpen && (
                <section id="stock-alerts-panel" aria-labelledby="stock-alerts-title" className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_18px_50px_rgba(12,45,33,.16)]">
                  <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] p-4">
                    <div className="min-w-0">
                      <h2 id="stock-alerts-title" className="font-bold">Stock alerts</h2>
                      <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">Products at or below their restock level{dataSource === "cached" ? " · cached inventory" : ""}</p>
                    </div>
                    <button className="grid size-9 shrink-0 place-items-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--muted)]" onClick={() => { setNotificationOpen(false); notificationButtonRef.current?.focus(); }} aria-label="Close stock alerts"><X size={18} /></button>
                  </div>
                  {stockAlerts.length > 0 ? (
                    <div className="max-h-[min(26rem,calc(100dvh-8rem))] overflow-y-auto p-2">
                      {stockAlerts.map((alert) => (
                        <button key={alert.product.databaseId} className="flex min-h-16 w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]" onClick={() => openStockAlert(alert)}>
                          <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", alert.status === "Out of Stock" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700")}><Warning size={18} weight="fill" /></span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">{alert.product.name}</span>
                            <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">{formatQuantity(alert.product.stock, alert.product.unit)} available · Restock at {formatQuantity(alert.product.minimumStock, alert.product.unit)}</span>
                          </span>
                          <span className={cn("shrink-0 text-xs font-bold", alert.status === "Out of Stock" ? "text-red-700" : "text-amber-700")}>{alert.status}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-5 py-10 text-center">
                      <span className="mx-auto grid size-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Check size={20} weight="bold" /></span>
                      <p className="mt-3 text-sm font-semibold">No stock alerts</p>
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">Every product is above its restock level.</p>
                    </div>
                  )}
                </section>
              )}
            </div>
            <div className="ml-1 grid size-9 place-items-center rounded-xl bg-[#24483a] text-sm font-bold text-white">{initials(currentUser.fullName)}</div>
          </div>
        </header>

        <main className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <h1 className="text-2xl font-bold tracking-[-0.025em] sm:text-[1.8rem]">{pageTitle}</h1>
          </div>

          {dataError && <div role="alert" className={cn("mb-6 rounded-2xl border p-4 text-sm font-medium", dataSource === "cached" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-red-200 bg-red-50 text-red-800")}>{dataSource === "cached" ? "Live inventory is unavailable. You can search the last synchronized catalog, but sales cannot be confirmed until the connection returns." : dataError}</div>}

          <div key={view === "stock-in" ? `${view}:${receivingProductId ?? "none"}` : view} className="view-enter">
            {view === "dashboard" && <Dashboard role={currentUser.role} canReceive={hasPermission(currentUser.role, "stock:receive")} onNavigate={navigate} />}
            {view === "products" && <ProductManagementView startCreating={startProductRegistration} canManage={hasPermission(currentUser.role, "products:manage")} canArchive={hasPermission(currentUser.role, "products:archive")} canPermanentlyDelete={hasPermission(currentUser.role, "products:delete")} canReceive={hasPermission(currentUser.role, "stock:receive")} notify={notify} onReceive={(productId) => { setReceivingProductId(productId); setView("stock-in"); }} />}
            {view === "sales" && <SalesView notify={notify} />}
            {view === "returns" && <ReturnsView notify={notify} />}
            {view === "stock-in" && <StockInView initialProductId={receivingProductId} canRegisterProduct={hasPermission(currentUser.role, "products:manage")} showMargin={hasPermission(currentUser.role, "reports:view_costs")} notify={notify} onRegisterProduct={() => { setStartProductRegistration(true); setView("products"); }} />}
            {view === "inventory" && <InventoryView status={inventoryFilter} onStatusChange={setInventoryFilter} />}
            {view === "transactions" && <HistoryView />}
            {view === "sales-review" && <SalesVerificationView notify={notify} />}
            {view === "reports" && <ReportsView notify={notify} canViewSales={hasPermission(currentUser.role, "reports:view_sales_own")} canViewAllSales={hasPermission(currentUser.role, "reports:view_sales_all")} canViewInventory={hasPermission(currentUser.role, "reports:view_inventory")} />}
            {view === "users" && <UsersView users={users} />}
          </div>
        </main>
      </div>

      <AnimatePresence>
        {toast && <motion.div role="status" initial={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "translateY(100%)" }} animate={{ opacity: 1, transform: "translateY(0%)" }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "translateY(100%)" }} transition={{ duration: reduceMotion ? 0.2 : 0.4, ease: "easeInOut" }} className="fixed bottom-5 right-5 z-50 flex max-w-sm items-start gap-3 rounded-2xl bg-[#16452e] px-4 py-3 text-sm font-medium text-white shadow-[0_14px_40px_rgba(12,45,33,.22)]"><Check size={18} weight="bold" className="mt-0.5 shrink-0 text-[#f4e90b]" />{toast}</motion.div>}
      </AnimatePresence>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
}

function Sidebar({ currentUser, view, open, onClose, onNavigate }: { currentUser: CurrentUser; view: View; open: boolean; onClose: () => void; onNavigate: (view: View) => void }) {
  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      const permission = VIEW_PERMISSIONS[item.id];
      return !permission || hasPermission(currentUser.role, permission);
    }),
  })).filter((group) => group.items.length > 0);
  return <>
    <button disabled={!open} className={cn("fixed inset-0 z-30 bg-black/30 transition-opacity duration-[180ms] ease-[var(--ease-out)] lg:hidden", open ? "opacity-100" : "pointer-events-none opacity-0")} onClick={onClose} aria-label="Close navigation overlay" />
    <aside className={cn("no-print fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col border-r border-[#27603f] bg-[#16452e] p-4 text-white transition-transform duration-[250ms] ease-[var(--ease-drawer)] lg:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
      <div className="mb-7 flex h-12 items-center justify-between px-2"><div className="flex min-w-0 items-center gap-3"><Image src="/brand/south-emerald-mark.svg" alt="" width={40} height={40} className="size-10 shrink-0 rounded-xl bg-white p-0.5" priority /><div className="min-w-0"><p className="truncate font-bold leading-tight">South Emerald</p><p className="truncate text-xs text-white/55">{APP_SHORT_NAME}</p></div></div><button className="grid size-10 shrink-0 place-items-center rounded-lg text-white/70 hover:bg-white/10 lg:hidden" onClick={onClose} aria-label="Close navigation"><X size={19} /></button></div>
      <nav className="min-h-0 flex-1 overflow-y-auto pr-1" aria-label="Main navigation">
        {visibleGroups.map((group, groupIndex) => <section key={group.id} className={cn(groupIndex > 0 && "mt-4")} aria-labelledby={`nav-group-${group.id}`}>
          <p id={`nav-group-${group.id}`} className="px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">{group.label}</p>
          <div className="mt-1 grid gap-1">
            {group.items.map((item) => { const Icon = item.icon; const active = view === item.id; return <button key={item.id} onClick={() => onNavigate(item.id)} className={cn("flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-left text-sm font-medium transition-colors", active ? "bg-[#f4e90b] text-[#173b27]" : "text-white/70 hover:bg-white/[.08] hover:text-white")}><Icon size={19} weight={active ? "fill" : "regular"} />{item.label}</button>; })}
          </div>
        </section>)}
      </nav>
      <div className="mt-4 border-t border-white/10 pt-4"><div className="mb-3 flex items-center gap-3 rounded-xl bg-white/[.055] p-3"><div className="grid size-9 place-items-center rounded-lg bg-white/10 text-xs font-bold">{initials(currentUser.fullName)}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{currentUser.fullName}</p><p className="text-xs text-white/45">{formatRole(currentUser.role)}</p></div></div><form action={logout}><button className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm text-white/60 hover:bg-white/[.07] hover:text-white" type="submit"><SignOut size={19} />Sign out</button></form></div>
    </aside>
  </>;
}

function Dashboard({ role, canReceive, onNavigate }: { role: CurrentUser["role"]; canReceive: boolean; onNavigate: (view: View) => void }) {
  const { products, transactions } = useInventory();
  const recentReceipts = groupActivityByReceipt(transactions).slice(0, 6);
  const low = products.filter((p) => getStockStatus(p) === "Low Stock");
  const out = products.filter((p) => p.stock === 0);
  const totalUnits = products.reduce((sum, p) => sum + p.stock, 0);
  const value = products.reduce((sum, p) => sum + p.stock * p.price, 0);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const todayActivity = transactions.filter((transaction) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(transaction.createdAt)) === today);
  const receivedToday = todayActivity.filter((transaction) => transaction.type === "Stock In").reduce((sum, transaction) => sum + transaction.quantity, 0);
  const releasedToday = todayActivity.filter((transaction) => transaction.type === "Stock Out").reduce((sum, transaction) => sum + transaction.quantity, 0);
  const managementMetrics = [
    { label: "Products", value: products.length.toLocaleString("en-PH"), note: "active catalog items", icon: Package },
    { label: "Units on hand", value: totalUnits.toLocaleString("en-PH"), note: "available across all products", icon: Storefront },
    { label: "Retail inventory value", value: peso(value), note: "on-hand quantity × selling price", icon: ChartBar },
    { label: "Needs attention", value: (low.length + out.length).toLocaleString("en-PH"), note: `${out.length} out · ${low.length} low`, icon: Warning },
  ];
  const inventoryMetrics = [
    { label: "Products", value: products.length.toLocaleString("en-PH"), note: "active catalog items", icon: Package },
    { label: "Units on hand", value: totalUnits.toLocaleString("en-PH"), note: "available across all products", icon: Storefront },
    { label: "Units received today", value: receivedToday.toLocaleString("en-PH"), note: "recorded stock receipts", icon: ArrowDown },
    { label: "Needs attention", value: (low.length + out.length).toLocaleString("en-PH"), note: `${out.length} out · ${low.length} low`, icon: Warning },
  ];
  const cashierReceiptsToday = groupActivityByReceipt(todayActivity.filter((transaction) => transaction.type === "Stock Out")).length;
  const cashierMetrics = [
    { label: "Available products", value: products.filter((product) => product.stock > 0).length.toLocaleString("en-PH"), note: "ready to add to a sale", icon: Package },
    { label: "Items sold today", value: releasedToday.toLocaleString("en-PH"), note: "from your recorded sales", icon: ShoppingCart },
    { label: "Receipts today", value: cashierReceiptsToday.toLocaleString("en-PH"), note: "sales you completed", icon: ClockCounterClockwise },
    { label: "Needs attention", value: (low.length + out.length).toLocaleString("en-PH"), note: "check availability before selling", icon: Warning },
  ];
  const metrics = role === "cashier" ? cashierMetrics : role === "inventory_staff" ? inventoryMetrics : managementMetrics;
  return <div className="dashboard-reveal grid gap-5">
    <section aria-label="Inventory summary" className="panel overflow-hidden">
      <div className="grid sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric, index) => { const Icon = metric.icon; const alert = index === 3 && low.length + out.length > 0; return <div key={metric.label} className={cn("p-5 sm:p-6", index > 0 && "border-t border-[var(--border)] sm:border-t-0", index % 2 === 1 && "sm:border-l", index > 1 && "sm:border-t xl:border-t-0", index > 0 && "xl:border-l", alert && "bg-amber-50/45")}><div className="flex items-center justify-between gap-4"><span className="text-xs font-semibold text-[var(--muted-foreground)]">{metric.label}</span><Icon size={19} className={alert ? "text-amber-700" : "text-[var(--accent)]"} aria-hidden="true" /></div><p className="mt-4 text-2xl font-bold tracking-[-0.03em] sm:text-3xl">{metric.value}</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">{metric.note}</p></div>; })}
      </div>
    </section>

    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,.55fr)]">
      <div className="panel p-5 sm:p-6"><div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="font-bold">Stock movement</h2><p className="mt-1 text-xs text-[var(--muted-foreground)]">Last 7 days, based on the latest 100 activity records</p></div><div className="flex gap-4 text-xs"><span><strong className="text-[var(--foreground)]">+{receivedToday}</strong> <span className="text-[var(--muted-foreground)]">received today</span></span><span><strong className="text-[var(--foreground)]">−{releasedToday}</strong> <span className="text-[var(--muted-foreground)]">sold today</span></span></div></div><DashboardCharts products={products} transactions={transactions} variant="movement" /></div>
      <div className="panel p-5 sm:p-6"><div><h2 className="font-bold">Inventory health</h2><p className="mt-1 text-xs text-[var(--muted-foreground)]">Products grouped by replenishment status</p></div><div className="mt-5"><DashboardCharts products={products} transactions={transactions} variant="health" /></div><div className="mt-6 border-t border-[var(--border)] pt-5"><p className="text-xs font-semibold text-[var(--muted-foreground)]">Common tasks</p><div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1"><Button onClick={() => onNavigate("sales")}><Scan />Open sales</Button>{canReceive && <Button variant="secondary" onClick={() => onNavigate("stock-in")}><ArrowDown />Receive stock</Button>}</div></div></div>
    </section>

    <section className="grid gap-5 xl:grid-cols-[minmax(320px,.55fr)_minmax(0,1.45fr)]">
      <div className="panel p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div><h2 className="font-bold">Needs attention</h2><p className="mt-1 text-xs text-[var(--muted-foreground)]">Out-of-stock products appear first</p></div><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700"><Warning size={19} weight="fill" aria-hidden="true" /></span></div><div className="mt-4 flex flex-col gap-1">{[...out, ...low].slice(0, 6).map((product) => <button key={product.id} disabled={!canReceive} onClick={() => onNavigate("stock-in")} className="flex min-h-14 w-full items-center justify-between rounded-xl px-2 text-left transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-default"><div className="min-w-0"><p className="truncate text-sm font-semibold">{product.name}</p><p className="text-xs text-[var(--muted-foreground)]">Restock at {formatQuantity(product.minimumStock, product.unit)}</p></div><div className="ml-3 text-right"><p className={cn("font-bold", product.stock === 0 ? "text-red-700" : "text-amber-800")}>{product.stock}</p><p className="text-[11px] text-[var(--muted-foreground)]">on hand</p></div></button>)}{low.length + out.length === 0 && <div className="py-8 text-center"><Check size={22} weight="bold" className="mx-auto text-[var(--accent)]" /><p className="mt-2 text-sm font-semibold">Stock levels look healthy</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">Every product is above its restock level.</p></div>}</div>{canReceive && low.length + out.length > 0 && <Button className="mt-4 w-full" variant="secondary" onClick={() => onNavigate("stock-in")}><ArrowDown />Restock inventory</Button>}</div>
      <div className="panel overflow-hidden"><div className="flex items-center justify-between gap-4 p-5 sm:px-6"><div><h2 className="font-bold">Recent activity</h2><p className="mt-1 text-xs text-[var(--muted-foreground)]">Latest sales and stock receipts</p></div><Button variant="ghost" size="sm" onClick={() => onNavigate("transactions")}>View all<CaretRight /></Button></div>{recentReceipts.length > 0 ? <div className="overflow-x-auto"><ReceiptActivityTable receipts={recentReceipts} /></div> : <EmptyState title="No inventory activity yet" text="Received stock and completed sales will appear here." />}</div>
    </section>
  </div>;
}

function InventoryView({ status, onStatusChange }: { status: InventoryFilter; onStatusChange: (status: InventoryFilter) => void }) {
  const { products } = useInventory();
  const filtered = products.filter((p) => status === "All" || getStockStatus(p) === status);
  const filters: InventoryFilter[] = ["All", "In Stock", "Low Stock", "Out of Stock"];
  return <div className="grid gap-4"><div className="flex flex-wrap gap-2">{filters.map((item) => <button key={item} onClick={() => onStatusChange(item)} className={cn("min-h-10 rounded-xl px-4 text-sm font-semibold", status === item ? "bg-[#173b2d] text-white" : "border border-[var(--border)] bg-white text-[var(--muted-foreground)] hover:bg-[var(--muted)]")}>{item}</button>)}</div><div className="panel overflow-hidden">{filtered.length > 0 ? <div className="overflow-x-auto"><table className="data-table min-w-[760px]"><thead><tr><th>Product</th><th>Category</th><th>Current stock</th><th>Minimum</th><th>Status</th><th>Updated</th></tr></thead><tbody>{filtered.map((p) => <tr key={p.id}><td><p className="font-semibold">{p.name}</p><p className="mt-0.5 font-mono text-xs text-[var(--muted-foreground)]">{p.barcode}</p></td><td>{p.category}</td><td><span className="text-lg font-bold">{p.stock}</span> <span className="text-xs text-[var(--muted-foreground)]">{pluralizeUnit(p.stock, p.unit)}</span></td><td>{formatQuantity(p.minimumStock, p.unit)}</td><td><StatusBadge status={getStockStatus(p)} /></td><td className="text-[var(--muted-foreground)]">{formatDate(p.updatedAt)}</td></tr>)}</tbody></table></div> : <EmptyState title={products.length === 0 ? "No inventory yet" : `No ${status.toLowerCase()} products`} text={products.length === 0 ? "Inventory quantities will appear after products and batches are added." : "Choose another stock-status filter."} />}</div></div>;
}

function ReceiptActivityTable({ receipts }: { receipts: ReceiptActivity[] }) {
  return <table className="data-table min-w-[760px]"><thead><tr><th>Receipt</th><th>Products</th><th>Type</th><th>Quantity</th><th>User</th><th>Date</th></tr></thead><tbody>{receipts.map((receipt) => {
    const productNames = receipt.transactions.map((transaction) => transaction.productName);
    return <tr key={receipt.id}><td className="font-semibold">{receipt.reference}</td><td><p className="font-semibold">{receipt.productCount} product{receipt.productCount === 1 ? "" : "s"}</p><p className="mt-0.5 max-w-64 truncate text-xs text-[var(--muted-foreground)]" title={productNames.join(", ")}>{productNames.join(", ")}</p></td><td><span className={cn("inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold", receipt.type === "Stock In" ? "bg-emerald-50 text-emerald-800" : "bg-orange-50 text-orange-800")}>{receipt.type === "Stock In" ? <ArrowDown size={13} /> : <ArrowUp size={13} />}{receipt.type === "Stock In" ? "Stock received" : "Sale"}</span></td><td className="font-bold">{receipt.totalQuantity}</td><td>{receipt.user}</td><td className="text-[var(--muted-foreground)]">{formatDate(receipt.createdAt)}</td></tr>;
  })}</tbody></table>;
}

function UsersView({ users }: { users: UserProfile[] }) { return <div className="panel overflow-hidden">{users.length > 0 ? <div className="overflow-x-auto"><table className="data-table min-w-[600px]"><thead><tr><th>User</th><th>Role</th><th>Status</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#24483a] text-xs font-bold text-white">{initials(user.fullName)}</span><span className="font-semibold">{user.fullName}</span></div></td><td>{formatRole(user.role)}</td><td><span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", user.status === "active" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-[#52605a]")}>{user.status === "active" ? "Active" : "Inactive"}</span></td></tr>)}</tbody></table></div> : <EmptyState title="No user profiles found" text="Authenticated user profiles will appear here." />}</div>; }

function EmptyState({ title, text }: { title: string; text: string }) { return <div className="grid place-items-center px-5 py-12 text-center"><span className="grid size-12 place-items-center rounded-2xl bg-[var(--muted)] text-[var(--muted-foreground)]"><Package size={23} /></span><h3 className="mt-4 font-bold">{title}</h3><p className="mt-1 max-w-sm text-sm text-[var(--muted-foreground)]">{text}</p></div>; }
