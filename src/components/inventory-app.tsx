"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowCounterClockwise, ArrowDown, ArrowUp, Barcode, Bell, CaretRight, ChartBar,
  Check, CirclesFour, ClockCounterClockwise, DownloadSimple, List, MagnifyingGlass,
  Package, Plus, Printer, Scan, SignOut, Storefront, Users, Warning, X,
} from "@phosphor-icons/react";
import { BarcodeLabel } from "@/components/barcode-label";
import { CameraScanner } from "@/components/camera-scanner";
import { useInventory } from "@/components/inventory-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import { getStockStatus, type Product, type StockTransaction } from "@/lib/types";

type View = "dashboard" | "products" | "scanner" | "stock-in" | "stock-out" | "inventory" | "transactions" | "reports" | "users";

const NAV_ITEMS: { id: View; label: string; icon: typeof CirclesFour }[] = [
  { id: "dashboard", label: "Dashboard", icon: CirclesFour },
  { id: "products", label: "Products", icon: Package },
  { id: "scanner", label: "Barcode Scanner", icon: Scan },
  { id: "stock-in", label: "Stock In", icon: ArrowDown },
  { id: "stock-out", label: "Stock Out", icon: ArrowUp },
  { id: "inventory", label: "Inventory", icon: Storefront },
  { id: "transactions", label: "Transactions", icon: ClockCounterClockwise },
  { id: "reports", label: "Reports", icon: ChartBar },
  { id: "users", label: "User Management", icon: Users },
];

const VIEW_META: Record<View, { title: string; description: string }> = {
  dashboard: { title: "Good morning, Maria", description: "Here is today’s inventory activity and the items that need attention." },
  products: { title: "Products", description: "Register products, assign barcodes, and keep product details organized." },
  scanner: { title: "Barcode scanner", description: "Identify products with any compatible camera or enter a barcode manually." },
  "stock-in": { title: "Stock in", description: "Record products received and update available quantities immediately." },
  "stock-out": { title: "Stock out", description: "Record inventory releases with automatic stock validation." },
  inventory: { title: "Inventory", description: "Review every product’s current quantity and stock status." },
  transactions: { title: "Transactions", description: "Trace each change made to inventory quantities." },
  reports: { title: "Reports", description: "Present inventory health and export sample records." },
  users: { title: "User management", description: "Preview the roles that will control access in the production system." },
};

function formatDate(value: string, withTime = true) {
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}) }).format(new Date(value));
}

function peso(value: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);
}

export function InventoryApp() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [view, setView] = useState<View>("dashboard");
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState("");
  const reduceMotion = useReducedMotion();
  const { resetDemo } = useInventory();

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  }

  if (!loggedIn) return <LoginScreen onLogin={() => setLoggedIn(true)} />;

  const meta = VIEW_META[view];
  return (
    <div className="min-h-[100dvh] bg-[var(--background)]">
      <Sidebar view={view} open={mobileNav} onClose={() => setMobileNav(false)} onNavigate={(next) => { setView(next); setMobileNav(false); }} onLogout={() => setLoggedIn(false)} />

      <div className="lg:pl-[264px]">
        <header className="no-print sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[var(--border)] bg-[color:rgba(244,247,246,.92)] px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <button className="grid size-11 place-items-center rounded-xl hover:bg-[var(--muted)] lg:hidden" onClick={() => setMobileNav(true)} aria-label="Open navigation"><List size={22} /></button>
          <div className="hidden items-center gap-2 text-sm text-[var(--muted-foreground)] lg:flex"><span>Inventory System</span><CaretRight size={14} /><span className="font-semibold text-[var(--foreground)]">{meta.title.replace("Good morning, Maria", "Dashboard")}</span></div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden rounded-lg bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-bold text-[var(--accent-strong)] sm:inline">Demo mode</span>
            <button className="relative grid size-11 place-items-center rounded-xl text-[var(--muted-foreground)] hover:bg-[var(--muted)]" aria-label="Notifications"><Bell size={20} /><span className="absolute right-2.5 top-2.5 size-1.5 rounded-full bg-red-500" /></button>
            <div className="ml-1 grid size-9 place-items-center rounded-xl bg-[#24483a] text-sm font-bold text-white">MS</div>
          </div>
        </header>

        <main className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div><h1 className="text-2xl font-bold tracking-[-0.025em] sm:text-[1.8rem]">{meta.title}</h1><p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">{meta.description}</p></div>
            {view === "dashboard" && <Button variant="secondary" onClick={() => { resetDemo(); notify("Sample inventory has been restored."); }}><ArrowCounterClockwise size={17} />Reset demo data</Button>}
          </div>

          <div key={view} className="view-enter">
            {view === "dashboard" && <Dashboard onNavigate={setView} />}
            {view === "products" && <ProductsView notify={notify} />}
            {view === "scanner" && <ScannerView onNavigate={setView} notify={notify} />}
            {view === "stock-in" && <StockMovementView type="Stock In" notify={notify} />}
            {view === "stock-out" && <StockMovementView type="Stock Out" notify={notify} />}
            {view === "inventory" && <InventoryView />}
            {view === "transactions" && <TransactionsView />}
            {view === "reports" && <ReportsView notify={notify} />}
            {view === "users" && <UsersView />}
          </div>
        </main>
      </div>

      <AnimatePresence>
        {toast && <motion.div role="status" initial={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "translateY(100%)" }} animate={{ opacity: 1, transform: "translateY(0%)" }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "translateY(100%)" }} transition={{ duration: reduceMotion ? 0.2 : 0.4, ease: "easeInOut" }} className="fixed bottom-5 right-5 z-50 flex max-w-sm items-start gap-3 rounded-2xl bg-[#153a2c] px-4 py-3 text-sm font-medium text-white shadow-[0_14px_40px_rgba(12,45,33,.22)]"><Check size={18} weight="bold" className="mt-0.5 shrink-0 text-emerald-300" />{toast}</motion.div>}
      </AnimatePresence>
    </div>
  );
}

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  return (
    <main className="grid min-h-[100dvh] bg-[#e8efec] lg:grid-cols-[1.08fr_.92fr]">
      <section className="relative hidden overflow-hidden bg-[#163a2d] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 size-80 rounded-full border-[56px] border-white/[.035]" />
        <div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-xl bg-emerald-400 text-[#14392b]"><Barcode size={25} weight="bold" /></div><span className="text-lg font-bold">Inventory System</span></div>
        <div className="relative max-w-xl">
          <p className="mb-5 text-sm font-semibold text-emerald-300">Client presentation demo</p>
          <h1 className="text-5xl font-semibold leading-[1.05] tracking-[-0.035em]">Know what is on every shelf.</h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-white/70">Scan products, record stock movement, and see inventory change as it happens.</p>
        </div>
        <div className="grid grid-cols-3 gap-8 border-t border-white/15 pt-6 text-sm text-white/60"><span>Camera ready</span><span>Mock data</span><span>Responsive web</span></div>
      </section>
      <section className="flex items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center gap-3 lg:hidden"><div className="grid size-11 place-items-center rounded-xl bg-[var(--accent)] text-white"><Barcode size={25} weight="bold" /></div><span className="text-lg font-bold">Inventory System</span></div>
          <h2 className="text-3xl font-bold tracking-[-0.03em]">Welcome back</h2>
          <p className="mt-2 text-[var(--muted-foreground)]">Use the demo account to explore the proposed system.</p>
          <form className="mt-8 grid gap-5" onSubmit={(event) => { event.preventDefault(); onLogin(); }}>
            <div><label className="field-label" htmlFor="email">Email address</label><Input id="email" type="email" defaultValue="manager@inventory.demo" /></div>
            <div><div className="flex items-center justify-between"><label className="field-label" htmlFor="password">Password</label><span className="mb-1 text-xs font-medium text-[var(--accent)]">Demo credentials filled in</span></div><Input id="password" type="password" defaultValue="inventory-demo" /></div>
            <Button className="mt-2 w-full">Enter demo</Button>
          </form>
          <div className="mt-6 rounded-xl border border-[var(--border)] bg-white/55 p-4 text-sm leading-6 text-[var(--muted-foreground)]"><strong className="text-[var(--foreground)]">Presentation note:</strong> This login is simulated. Production authentication will use secure user accounts and role-based access.</div>
        </div>
      </section>
    </main>
  );
}

function Sidebar({ view, open, onClose, onNavigate, onLogout }: { view: View; open: boolean; onClose: () => void; onNavigate: (view: View) => void; onLogout: () => void }) {
  return <>
    <button disabled={!open} className={cn("fixed inset-0 z-30 bg-black/30 transition-opacity duration-[180ms] ease-[var(--ease-out)] lg:hidden", open ? "opacity-100" : "pointer-events-none opacity-0")} onClick={onClose} aria-label="Close navigation overlay" />
    <aside className={cn("no-print fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col border-r border-[#24473a] bg-[#17362b] p-4 text-white transition-transform duration-[250ms] ease-[var(--ease-drawer)] lg:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
      <div className="mb-7 flex h-12 items-center justify-between px-2"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-emerald-400 text-[#17362b]"><Barcode size={23} weight="bold" /></div><div><p className="font-bold leading-tight">Inventory System</p><p className="text-xs text-white/50">Grocery operations</p></div></div><button className="grid size-10 place-items-center rounded-lg text-white/70 hover:bg-white/10 lg:hidden" onClick={onClose} aria-label="Close navigation"><X size={19} /></button></div>
      <nav className="flex-1 space-y-1" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => { const Icon = item.icon; const active = view === item.id; return <button key={item.id} onClick={() => onNavigate(item.id)} className={cn("flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-left text-sm font-medium transition-colors", active ? "bg-emerald-300 text-[#133328]" : "text-white/68 hover:bg-white/[.07] hover:text-white")}><Icon size={19} weight={active ? "fill" : "regular"} />{item.label}</button>; })}
      </nav>
      <div className="mt-4 border-t border-white/10 pt-4"><div className="mb-3 flex items-center gap-3 rounded-xl bg-white/[.055] p-3"><div className="grid size-9 place-items-center rounded-lg bg-white/10 text-xs font-bold">MS</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">Maria Santos</p><p className="text-xs text-white/45">Manager</p></div></div><button className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm text-white/60 hover:bg-white/[.07] hover:text-white" onClick={onLogout}><SignOut size={19} />Sign out</button></div>
    </aside>
  </>;
}

function Dashboard({ onNavigate }: { onNavigate: (view: View) => void }) {
  const { products, transactions } = useInventory();
  const low = products.filter((p) => getStockStatus(p) === "Low Stock");
  const out = products.filter((p) => p.stock === 0);
  const totalUnits = products.reduce((sum, p) => sum + p.stock, 0);
  const value = products.reduce((sum, p) => sum + p.stock * p.price, 0);
  const metrics = [
    { label: "Products", value: products.length, note: "registered items", icon: Package },
    { label: "Units on hand", value: totalUnits, note: peso(value) + " stock value", icon: Storefront },
    { label: "Low stock", value: low.length, note: "need replenishment", icon: Warning },
    { label: "Out of stock", value: out.length, note: "unavailable items", icon: X },
  ];
  return <div className="dashboard-reveal grid gap-5">
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric, index) => { const Icon = metric.icon; return <div key={metric.label} className={cn("panel p-5", index === 2 && low.length > 0 && "border-amber-200 bg-amber-50/45", index === 3 && out.length > 0 && "border-red-200 bg-red-50/45")}><div className="mb-5 flex items-center justify-between"><span className="text-sm font-semibold text-[var(--muted-foreground)]">{metric.label}</span><Icon size={20} className={index > 1 ? (index === 2 ? "text-amber-700" : "text-red-600") : "text-[var(--accent)]"} /></div><p className="text-3xl font-bold tracking-[-0.03em]">{metric.value}</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">{metric.note}</p></div>; })}
    </section>
    <section className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
      <div className="panel overflow-hidden"><div className="flex items-center justify-between p-5"><div><h2 className="font-bold">Recent activity</h2><p className="mt-1 text-xs text-[var(--muted-foreground)]">Latest stock movement from sample records</p></div><Button variant="ghost" size="sm" onClick={() => onNavigate("transactions")}>View all<CaretRight size={14} /></Button></div><div className="overflow-x-auto"><TransactionTable transactions={transactions.slice(0, 6)} compact /></div></div>
      <div className="panel p-5"><div className="flex items-center justify-between"><div><h2 className="font-bold">Needs attention</h2><p className="mt-1 text-xs text-[var(--muted-foreground)]">At or below minimum level</p></div><span className="grid size-9 place-items-center rounded-xl bg-amber-50 text-amber-700"><Warning size={19} weight="fill" /></span></div><div className="mt-5 space-y-1">{[...out, ...low].slice(0, 5).map((product) => <button key={product.id} onClick={() => onNavigate("stock-in")} className="flex min-h-14 w-full items-center justify-between rounded-xl px-2 text-left hover:bg-[var(--muted)]"><div className="min-w-0"><p className="truncate text-sm font-semibold">{product.name}</p><p className="text-xs text-[var(--muted-foreground)]">Minimum {product.minimumStock} {product.unit}s</p></div><div className="ml-3 text-right"><p className={cn("font-bold", product.stock === 0 ? "text-red-600" : "text-amber-700")}>{product.stock}</p><p className="text-[11px] text-[var(--muted-foreground)]">on hand</p></div></button>)}</div><Button className="mt-5 w-full" onClick={() => onNavigate("stock-in")}><ArrowDown size={17} />Record stock in</Button></div>
    </section>
    <section className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
      <div className="rounded-2xl bg-[#163a2d] p-6 text-white"><div className="flex items-start justify-between"><div><h2 className="text-lg font-bold">Scan and update</h2><p className="mt-2 max-w-sm text-sm leading-6 text-white/65">Use a webcam or phone camera to find an item, then move directly into stock in or stock out.</p></div><Scan size={28} className="text-emerald-300" /></div><Button className="mt-7 bg-emerald-300 text-[#15362a] hover:bg-emerald-200" onClick={() => onNavigate("scanner")}>Open scanner<CaretRight size={16} /></Button></div>
      <div className="panel p-5"><h2 className="font-bold">Inventory distribution</h2><p className="mt-1 text-xs text-[var(--muted-foreground)]">Products grouped by current status</p><div className="mt-7 flex h-3 overflow-hidden rounded-full bg-[var(--muted)]"><div className="bg-emerald-600" style={{ width: `${products.filter((p) => getStockStatus(p) === "In Stock").length / products.length * 100}%` }} /><div className="bg-amber-400" style={{ width: `${low.length / products.length * 100}%` }} /><div className="bg-red-500" style={{ width: `${out.length / products.length * 100}%` }} /></div><div className="mt-5 grid grid-cols-3 gap-3 text-sm"><div><p className="font-bold">{products.length - low.length - out.length}</p><p className="text-xs text-[var(--muted-foreground)]">In stock</p></div><div><p className="font-bold">{low.length}</p><p className="text-xs text-[var(--muted-foreground)]">Low stock</p></div><div><p className="font-bold">{out.length}</p><p className="text-xs text-[var(--muted-foreground)]">Out of stock</p></div></div></div>
    </section>
  </div>;
}

function ProductsView({ notify }: { notify: (message: string) => void }) {
  const { products, addProduct } = useInventory();
  const [search, setSearch] = useState(""); const [category, setCategory] = useState("All"); const [adding, setAdding] = useState(false);
  const categories = ["All", ...Array.from(new Set(products.map((p) => p.category)))];
  const filtered = products.filter((p) => (category === "All" || p.category === category) && `${p.name} ${p.barcode}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="grid gap-4">
    <div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><MagnifyingGlass className="absolute left-3.5 top-3.5 text-[var(--muted-foreground)]" size={18} /><Input className="pl-10" placeholder="Search product or barcode" value={search} onChange={(e) => setSearch(e.target.value)} /></div><select className="select-field sm:w-52" value={category} onChange={(e) => setCategory(e.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select><Button onClick={() => setAdding(true)}><Plus size={17} />Add product</Button></div>
    <div className="panel overflow-hidden"><div className="overflow-x-auto"><table className="data-table min-w-[850px]"><thead><tr><th>Product</th><th>Barcode</th><th>Category</th><th>Price</th><th>Quantity</th><th>Status</th></tr></thead><tbody>{filtered.map((p) => <tr key={p.id}><td><p className="font-semibold">{p.name}</p><p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{p.id}</p></td><td className="font-mono text-xs">{p.barcode}</td><td>{p.category}</td><td>{peso(p.price)}</td><td><strong>{p.stock}</strong> <span className="text-xs text-[var(--muted-foreground)]">{p.unit}s</span></td><td><StatusBadge status={getStockStatus(p)} /></td></tr>)}</tbody></table></div>{filtered.length === 0 && <EmptyState title="No matching products" text="Try a different product name, barcode, or category." />}</div>
    <AnimatePresence>
      {adding && <AddProductDialog onClose={() => setAdding(false)} onAdd={(data) => { const product = addProduct(data); setAdding(false); notify(`${product.name} was added with barcode ${product.barcode}.`); }} existingBarcodes={products.map((p) => p.barcode)} />}
    </AnimatePresence>
  </div>;
}

function AddProductDialog({ onClose, onAdd, existingBarcodes }: { onClose: () => void; onAdd: Parameters<ReturnType<typeof useInventory>["addProduct"]>[0] extends never ? never : (data: Omit<Product, "id" | "updatedAt">) => void; existingBarcodes: string[] }) {
  const generated = `200000000${String(existingBarcodes.length + 101).padStart(3, "0")}`;
  const [form, setForm] = useState({ name: "", barcode: generated, category: "Repacked Goods", unit: "pack", stock: 0, minimumStock: 10, price: 0 });
  const [error, setError] = useState("");
  const reduceMotion = useReducedMotion();
  function submit(e: React.FormEvent) { e.preventDefault(); if (!form.name.trim()) return setError("Product name is required."); if (!form.barcode.trim()) return setError("Barcode is required."); if (existingBarcodes.includes(form.barcode)) return setError("This barcode is already assigned to another product."); onAdd(form); }
  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25, ease: "easeOut" }} className="fixed inset-0 z-50 flex items-end justify-end bg-black/30 sm:p-4" role="presentation"><motion.div initial={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "scale(0.96) translateY(2%)" }} animate={{ opacity: 1, transform: "scale(1) translateY(0%)" }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "scale(0.96) translateY(2%)" }} transition={{ duration: 0.25, ease: "easeOut" }} role="dialog" aria-modal="true" aria-labelledby="add-product-title" className="h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 sm:h-full sm:max-w-lg sm:rounded-2xl sm:p-7"><div className="flex items-start justify-between"><div><h2 id="add-product-title" className="text-xl font-bold">Add a product</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">Register an item and assign a unique barcode.</p></div><button onClick={onClose} className="grid size-11 place-items-center rounded-xl hover:bg-[var(--muted)]" aria-label="Close"><X size={20} /></button></div><form className="mt-7 grid gap-4" onSubmit={submit}><div><label className="field-label" htmlFor="product-name">Product name</label><Input id="product-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Example: Brown Sugar 1kg" /></div><div><label className="field-label" htmlFor="product-barcode">Barcode</label><Input id="product-barcode" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /><div className="mt-3 rounded-xl bg-[var(--muted)] p-3"><BarcodeLabel value={form.barcode} compact /></div><p className="mt-2 text-xs text-[var(--muted-foreground)]">A Code 128 value was generated. Replace it with a manufacturer barcode if available.</p></div><div className="grid gap-4 sm:grid-cols-2"><div><label className="field-label">Category</label><select className="select-field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}><option>Repacked Goods</option><option>Beverages</option><option>Canned Goods</option><option>Snacks</option><option>Household</option><option>Rice</option></select></div><div><label className="field-label">Unit</label><select className="select-field" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}><option>pack</option><option>piece</option><option>bottle</option><option>can</option><option>bag</option><option>kg</option></select></div></div><div className="grid grid-cols-2 gap-4"><div><label className="field-label">Starting stock</label><Input type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} /></div><div><label className="field-label">Minimum stock</label><Input type="number" min="0" value={form.minimumStock} onChange={(e) => setForm({ ...form, minimumStock: Number(e.target.value) })} /></div></div><div><label className="field-label">Selling price</label><Input type="number" min="0" step="0.25" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} /></div>{error && <p className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}<div className="mt-2 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit">Save product</Button></div></form></motion.div></motion.div>;
}

function ScannerView({ onNavigate, notify }: { onNavigate: (view: View) => void; notify: (message: string) => void }) {
  const { products } = useInventory(); const [barcode, setBarcode] = useState(""); const [found, setFound] = useState<Product | null>(null); const [searched, setSearched] = useState(false);
  function lookup(value: string) { const clean = value.trim(); setBarcode(clean); const match = products.find((p) => p.barcode === clean) || null; setFound(match); setSearched(true); if (match) notify(`${match.name} identified.`); }
  return <div className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]"><div className="panel p-5 sm:p-6"><CameraScanner onDetected={lookup} /></div><div className="grid content-start gap-5"><div className="panel p-5 sm:p-6"><h2 className="font-bold">Manual barcode entry</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">Use this for a USB scanner or when camera scanning is unavailable.</p><form className="mt-5 flex gap-2" onSubmit={(e) => { e.preventDefault(); lookup(barcode); }}><Input autoFocus value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Scan or type barcode" aria-label="Barcode" /><Button type="submit" className="shrink-0"><MagnifyingGlass size={17} />Find</Button></form><div className="mt-3 flex flex-wrap gap-2">{products.slice(0, 3).map((p) => <button key={p.id} onClick={() => lookup(p.barcode)} className="min-h-9 rounded-lg bg-[var(--muted)] px-3 text-xs font-semibold hover:bg-[var(--accent-soft)]">Try {p.barcode}</button>)}</div></div>{found ? <div className="view-enter panel overflow-hidden"><div className="bg-[#e5f2ed] p-5"><p className="text-xs font-bold text-[var(--accent)]">Product identified</p><h2 className="mt-2 text-xl font-bold">{found.name}</h2><p className="mt-1 font-mono text-xs text-[var(--muted-foreground)]">{found.barcode}</p></div><div className="grid grid-cols-2 gap-4 p-5"><div><p className="text-xs text-[var(--muted-foreground)]">Current stock</p><p className="mt-1 text-2xl font-bold">{found.stock} <span className="text-sm font-medium">{found.unit}s</span></p></div><div><p className="text-xs text-[var(--muted-foreground)]">Status</p><div className="mt-2"><StatusBadge status={getStockStatus(found)} /></div></div></div><div className="flex gap-2 border-t border-[var(--border)] p-5"><Button className="flex-1" onClick={() => onNavigate("stock-in")}><ArrowDown size={17} />Stock in</Button><Button className="flex-1" variant="secondary" onClick={() => onNavigate("stock-out")}><ArrowUp size={17} />Stock out</Button></div></div> : searched && <div className="view-enter panel"><EmptyState title="Barcode not found" text="Check the number or register this product before recording stock movement." /></div>}</div></div>;
}

function StockMovementView({ type, notify }: { type: "Stock In" | "Stock Out"; notify: (message: string) => void }) {
  const { products, adjustStock } = useInventory(); const [barcode, setBarcode] = useState(""); const [selected, setSelected] = useState<Product | null>(null); const [quantity, setQuantity] = useState(1); const [notes, setNotes] = useState(""); const [error, setError] = useState("");
  function find() { const p = products.find((item) => item.barcode === barcode.trim()); setSelected(p || null); setError(p ? "" : "No product matches this barcode."); }
  function confirm() { if (!selected) return setError("Find a product first."); const result = adjustStock(selected.id, type, quantity, notes); if (!result.ok) return setError(result.message); const newStock = type === "Stock In" ? selected.stock + quantity : selected.stock - quantity; notify(result.message); setSelected({ ...selected, stock: newStock, updatedAt: new Date().toISOString() }); setQuantity(1); setNotes(""); setBarcode(""); }
  const inbound = type === "Stock In";
  return <div className="grid gap-5 lg:grid-cols-[1fr_.78fr]"><div className="panel p-5 sm:p-7"><h2 className="font-bold">Find a product</h2><form className="mt-5 flex gap-2" onSubmit={(e) => { e.preventDefault(); find(); }}><div className="relative flex-1"><Barcode className="absolute left-3.5 top-3.5 text-[var(--muted-foreground)]" size={18} /><Input className="pl-10" value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Scan or enter barcode" aria-label="Product barcode" /></div><Button type="submit">Find</Button></form><div className="mt-3"><select className="select-field" value={selected?.id || ""} onChange={(e) => { const p = products.find((item) => item.id === e.target.value) || null; setSelected(p); setBarcode(p?.barcode || ""); setError(""); }}><option value="">Or choose a sample product</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>{selected ? <div className="mt-6 rounded-2xl bg-[var(--muted)] p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold text-[var(--muted-foreground)]">{selected.id}</p><h3 className="mt-1 font-bold">{selected.name}</h3><p className="mt-1 font-mono text-xs text-[var(--muted-foreground)]">{selected.barcode}</p></div><div className="sm:text-right"><p className="text-2xl font-bold">{selected.stock}</p><p className="text-xs text-[var(--muted-foreground)]">{selected.unit}s available</p></div></div></div> : <div className="mt-6 rounded-2xl border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted-foreground)]">The selected product will appear here.</div>}{error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}</div><div className={cn("rounded-2xl p-5 sm:p-7", inbound ? "bg-[#153a2c] text-white" : "bg-[#3a2824] text-white")}><div className="flex items-center gap-3"><span className={cn("grid size-11 place-items-center rounded-xl", inbound ? "bg-emerald-300 text-[#153a2c]" : "bg-orange-200 text-[#3a2824]")}>{inbound ? <ArrowDown size={21} weight="bold" /> : <ArrowUp size={21} weight="bold" />}</span><div><h2 className="font-bold">Confirm {type.toLowerCase()}</h2><p className="text-sm text-white/55">Quantity updates immediately</p></div></div><div className="mt-7 grid gap-5"><div><label className="mb-2 block text-sm font-semibold" htmlFor="quantity">Quantity</label><Input id="quantity" className="border-white/20 bg-white/10 text-white placeholder:text-white/40 focus:border-white focus:ring-white/15" type="number" min="1" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} /></div><div><label className="mb-2 block text-sm font-semibold" htmlFor="notes">Notes</label><textarea id="notes" className="min-h-24 w-full resize-none rounded-xl border border-white/20 bg-white/10 p-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-white focus:ring-2 focus:ring-white/15" placeholder={inbound ? "Example: Morning delivery" : "Example: Store release"} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>{selected && <div className="flex items-center justify-between border-t border-white/15 pt-4 text-sm"><span className="text-white/60">New quantity</span><strong className="text-lg">{inbound ? selected.stock + Math.max(quantity, 0) : Math.max(selected.stock - Math.max(quantity, 0), 0)} {selected.unit}s</strong></div>}<Button className={cn("w-full", inbound ? "bg-emerald-300 text-[#153a2c] hover:bg-emerald-200" : "bg-orange-200 text-[#3a2824] hover:bg-orange-100")} disabled={!selected} onClick={confirm}>Confirm {type.toLowerCase()}</Button></div></div></div>;
}

function InventoryView() {
  const { products } = useInventory(); const [status, setStatus] = useState("All");
  const filtered = products.filter((p) => status === "All" || getStockStatus(p) === status);
  return <div className="grid gap-4"><div className="flex flex-wrap gap-2">{["All", "In Stock", "Low Stock", "Out of Stock"].map((item) => <button key={item} onClick={() => setStatus(item)} className={cn("min-h-10 rounded-xl px-4 text-sm font-semibold", status === item ? "bg-[#173b2d] text-white" : "border border-[var(--border)] bg-white text-[var(--muted-foreground)] hover:bg-[var(--muted)]")}>{item}</button>)}</div><div className="panel overflow-hidden"><div className="overflow-x-auto"><table className="data-table min-w-[760px]"><thead><tr><th>Product</th><th>Category</th><th>Current stock</th><th>Minimum</th><th>Status</th><th>Updated</th></tr></thead><tbody>{filtered.map((p) => <tr key={p.id}><td><p className="font-semibold">{p.name}</p><p className="mt-0.5 font-mono text-xs text-[var(--muted-foreground)]">{p.barcode}</p></td><td>{p.category}</td><td><span className="text-lg font-bold">{p.stock}</span> <span className="text-xs text-[var(--muted-foreground)]">{p.unit}s</span></td><td>{p.minimumStock}</td><td><StatusBadge status={getStockStatus(p)} /></td><td className="text-[var(--muted-foreground)]">{formatDate(p.updatedAt)}</td></tr>)}</tbody></table></div></div></div>;
}

function TransactionsView() { const { transactions } = useInventory(); const [type, setType] = useState("All"); const shown = transactions.filter((t) => type === "All" || t.type === type); return <div className="grid gap-4"><div className="flex flex-wrap gap-2">{["All", "Stock In", "Stock Out"].map((item) => <button key={item} onClick={() => setType(item)} className={cn("min-h-10 rounded-xl px-4 text-sm font-semibold", type === item ? "bg-[#173b2d] text-white" : "border border-[var(--border)] bg-white text-[var(--muted-foreground)] hover:bg-[var(--muted)]")}>{item}</button>)}</div><div className="panel overflow-hidden"><div className="overflow-x-auto"><TransactionTable transactions={shown} /></div></div></div>; }

function TransactionTable({ transactions, compact = false }: { transactions: StockTransaction[]; compact?: boolean }) { return <table className={cn("data-table", compact ? "min-w-[700px]" : "min-w-[900px]")}><thead><tr><th>Transaction</th><th>Product</th><th>Type</th><th>Quantity</th><th>Stock change</th>{!compact && <th>User</th>}<th>Date</th></tr></thead><tbody>{transactions.map((t) => <tr key={t.id}><td className="font-mono text-xs text-[var(--muted-foreground)]">{t.id}</td><td><p className="font-semibold">{t.productName}</p>{!compact && <p className="text-xs text-[var(--muted-foreground)]">{t.notes || "No notes"}</p>}</td><td><span className={cn("inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold", t.type === "Stock In" ? "bg-emerald-50 text-emerald-800" : "bg-orange-50 text-orange-800")}>{t.type === "Stock In" ? <ArrowDown size={13} /> : <ArrowUp size={13} />}{t.type}</span></td><td className="font-bold">{t.quantity}</td><td><span className="text-[var(--muted-foreground)]">{t.previousStock}</span> <span aria-hidden="true">→</span> <strong>{t.newStock}</strong></td>{!compact && <td>{t.user}</td>}<td className="text-[var(--muted-foreground)]">{formatDate(t.createdAt)}</td></tr>)}</tbody></table>; }

function ReportsView({ notify }: { notify: (message: string) => void }) {
  const { products, transactions } = useInventory(); const stockIn = transactions.filter((t) => t.type === "Stock In").reduce((s, t) => s + t.quantity, 0); const stockOut = transactions.filter((t) => t.type === "Stock Out").reduce((s, t) => s + t.quantity, 0);
  function csv() { const rows = [["Product ID", "Product", "Barcode", "Category", "Stock", "Unit", "Status"], ...products.map((p) => [p.id, p.name, p.barcode, p.category, p.stock, p.unit, getStockStatus(p)])]; const content = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n"); const blob = new Blob([content], { type: "text/csv" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "inventory-report-demo.csv"; link.click(); URL.revokeObjectURL(url); notify("Sample inventory report downloaded."); }
  return <div className="grid gap-5"><div className="no-print flex flex-wrap gap-2"><Button onClick={csv}><DownloadSimple size={17} />Download CSV</Button><Button variant="secondary" onClick={() => window.print()}><Printer size={17} />Print report</Button></div><section className="panel overflow-hidden"><div className="border-b border-[var(--border)] p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-xl font-bold">Current inventory report</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">Synthetic presentation data as of September 14, 2026</p></div><p className="text-sm font-semibold">{products.length} registered products</p></div></div><div className="grid grid-cols-2 border-b border-[var(--border)] md:grid-cols-4"><ReportMetric label="Units on hand" value={products.reduce((s, p) => s + p.stock, 0)} /><ReportMetric label="Stock value" value={peso(products.reduce((s, p) => s + p.stock * p.price, 0))} /><ReportMetric label="Units received" value={stockIn} /><ReportMetric label="Units released" value={stockOut} /></div><div className="overflow-x-auto"><table className="data-table min-w-[760px]"><thead><tr><th>Product</th><th>Category</th><th>Quantity</th><th>Unit price</th><th>Stock value</th><th>Status</th></tr></thead><tbody>{products.map((p) => <tr key={p.id}><td className="font-semibold">{p.name}</td><td>{p.category}</td><td>{p.stock} {p.unit}s</td><td>{peso(p.price)}</td><td>{peso(p.stock * p.price)}</td><td><StatusBadge status={getStockStatus(p)} /></td></tr>)}</tbody></table></div></section></div>;
}

function ReportMetric({ label, value }: { label: string; value: string | number }) { return <div className="border-r border-[var(--border)] p-5 last:border-r-0"><p className="text-xs font-semibold text-[var(--muted-foreground)]">{label}</p><p className="mt-2 text-xl font-bold">{value}</p></div>; }

function UsersView() { const users = [{ name: "Maria Santos", initials: "MS", role: "Manager", access: "Full inventory and reports", active: true }, { name: "Carlo Mendoza", initials: "CM", role: "Cashier", access: "Stock out and product lookup", active: true }, { name: "Ana Reyes", initials: "AR", role: "Inventory Staff", access: "Products, stock in, and stock out", active: true }, { name: "Roberto Cruz", initials: "RC", role: "Administrator", access: "Users and system settings", active: false }]; return <div className="grid gap-5"><div className="rounded-2xl bg-[#e5f2ed] p-5 text-sm leading-6 text-[#274b3e]"><strong>Demo roles only.</strong> Production permissions will be enforced through authentication and protected backend routes.</div><div className="panel overflow-hidden"><div className="overflow-x-auto"><table className="data-table min-w-[680px]"><thead><tr><th>User</th><th>Role</th><th>Access preview</th><th>Status</th></tr></thead><tbody>{users.map((u) => <tr key={u.name}><td><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#24483a] text-xs font-bold text-white">{u.initials}</span><span className="font-semibold">{u.name}</span></div></td><td>{u.role}</td><td className="text-[var(--muted-foreground)]">{u.access}</td><td><span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", u.active ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-[#52605a]")}>{u.active ? "Active" : "Inactive"}</span></td></tr>)}</tbody></table></div></div></div>; }

function EmptyState({ title, text }: { title: string; text: string }) { return <div className="grid place-items-center px-5 py-12 text-center"><span className="grid size-12 place-items-center rounded-2xl bg-[var(--muted)] text-[var(--muted-foreground)]"><Package size={23} /></span><h3 className="mt-4 font-bold">{title}</h3><p className="mt-1 max-w-sm text-sm text-[var(--muted-foreground)]">{text}</p></div>; }
