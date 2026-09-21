"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArrowCounterClockwise, Barcode, MagnifyingGlass, Package, PencilSimple, Plus, Printer, Trash, Warning } from "@phosphor-icons/react";
import {
  archiveInventoryProduct,
  createInventoryCategory,
  createInventoryProduct,
  createInventoryProductWithInitialStock,
  listArchivedInventoryProducts,
  listInventoryCategories,
  permanentlyDeleteArchivedProduct,
  restoreInventoryProduct,
  updateInventoryCategory,
  updateInventoryProduct,
  type CategoryOption,
  type ArchivedProduct,
  type SavedProduct,
} from "@/app/inventory/actions";
import { BarcodeGenerationPreview, BarcodePrintPanel } from "@/components/barcode-label";
import { TablePagination } from "@/components/table-pagination";
import { useInventory } from "@/components/inventory-provider";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";
import { getStockStatus, type Product } from "@/lib/types";
import { formatQuantity, pluralizeUnit } from "@/lib/units";
import { paginateItems } from "@/lib/pagination";

type ProductForm = {
  name: string; description: string; categoryId: string; stockUnit: string;
  sellingPrice: string; minimumStock: string; expiryTracking: "required" | "not_applicable";
  barcodeMode: "manufacturer" | "generated"; barcode: string;
};

const emptyForm: ProductForm = { name: "", description: "", categoryId: "", stockUnit: "", sellingPrice: "", minimumStock: "0", expiryTracking: "not_applicable", barcodeMode: "manufacturer", barcode: "" };

function peso(value: number) { return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value); }

function formFromProduct(product: Product): ProductForm {
  return { name: product.name, description: product.description ?? "", categoryId: product.categoryId, stockUnit: product.unit, sellingPrice: String(product.price), minimumStock: String(product.minimumStock), expiryTracking: product.expiryTracking, barcodeMode: "manufacturer", barcode: product.barcode };
}

export function ProductManagementView({ startCreating, canManage, canArchive, canPermanentlyDelete, canReceive, notify, onReceive }: { startCreating: boolean; canManage: boolean; canArchive: boolean; canPermanentlyDelete: boolean; canReceive: boolean; notify: (message: string) => void; onReceive: (productId: string) => void }) {
  const { products } = useInventory();
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [categoryError, setCategoryError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All categories");
  const [catalogMode, setCatalogMode] = useState<"active" | "archived">("active");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [archivedProducts, setArchivedProducts] = useState<ArchivedProduct[]>([]);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [archivedError, setArchivedError] = useState("");
  const [deleteProduct, setDeleteProduct] = useState<ArchivedProduct | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [editing, setEditing] = useState<Product | null | "new">(startCreating && canManage ? "new" : null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [formError, setFormError] = useState("");
  const [newCategory, setNewCategory] = useState(false);
  const [categoryForm, setCategoryForm] = useState<{ name: string; description: string; defaultExpiryTracking: "required" | "not_applicable" }>({ name: "", description: "", defaultExpiryTracking: "not_applicable" });
  const [manageCategories, setManageCategories] = useState(false);
  const [managedCategoryId, setManagedCategoryId] = useState("");
  const [managedCategory, setManagedCategory] = useState<{ name: string; description: string; defaultExpiryTracking: "required" | "not_applicable" }>({ name: "", description: "", defaultExpiryTracking: "not_applicable" });
  const [printProduct, setPrintProduct] = useState<SavedProduct | null>(null);
  const [printProductHasOpeningStock, setPrintProductHasOpeningStock] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmArchiveStockRemoval, setConfirmArchiveStockRemoval] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");
  const [addInitialStock, setAddInitialStock] = useState(false);
  const [initialStock, setInitialStock] = useState({ quantity: "", unitCost: "", expiresAt: "" });
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    void listInventoryCategories().then((result) => {
      if (!active) return;
      if (result.ok) {
        setCategories(result.categories);
        if (startCreating && result.categories[0]) {
          setForm((current) => current.categoryId ? current : { ...current, categoryId: result.categories[0].id, expiryTracking: result.categories[0].defaultExpiryTracking });
        }
      }
      else setCategoryError(result.message);
    });
    return () => { active = false; };
  }, [startCreating]);

  const shown = useMemo(() => products.filter((product) => {
    const query = search.toLowerCase();
    return (category === "All categories" || product.category === category)
      && (!query || [product.name, product.barcode, product.id].some((value) => value.toLowerCase().includes(query)));
  }), [category, products, search]);
  const shownArchived = useMemo(() => archivedProducts.filter((product) => {
    const query = search.toLowerCase();
    return (category === "All categories" || product.categoryName === category)
      && (!query || [product.name, product.barcode, product.productCode].some((value) => value.toLowerCase().includes(query)));
  }), [archivedProducts, category, search]);
  const activePage = useMemo(() => paginateItems(shown, page, pageSize), [page, pageSize, shown]);
  const archivedPage = useMemo(() => paginateItems(shownArchived, page, pageSize), [page, pageSize, shownArchived]);

  function beginCreate() {
    setEditing("new"); setForm({ ...emptyForm, categoryId: categories[0]?.id ?? "" }); setFormError(""); setConfirmArchive(false); setConfirmArchiveStockRemoval(false); setArchiveReason(""); setAddInitialStock(false); setInitialStock({ quantity: "", unitCost: "", expiresAt: "" });
  }
  function loadArchivedProducts() {
    setArchivedLoading(true); setArchivedError("");
    void listArchivedInventoryProducts().then((result) => {
      if (result.ok) setArchivedProducts(result.products);
      else setArchivedError(result.message);
      setArchivedLoading(false);
    });
  }
  function openArchivedProducts() { setCatalogMode("archived"); setPage(1); loadArchivedProducts(); }
  function beginEdit(product: Product) { setEditing(product); setForm(formFromProduct(product)); setFormError(""); setConfirmArchive(false); setConfirmArchiveStockRemoval(false); setArchiveReason(""); setAddInitialStock(false); setInitialStock({ quantity: "", unitCost: "", expiresAt: "" }); }
  function set<K extends keyof ProductForm>(key: K, value: ProductForm[K]) { setForm((current) => ({ ...current, [key]: value })); }

  function setExpiryTracking(value: ProductForm["expiryTracking"]) {
    set("expiryTracking", value);
    if (value === "not_applicable") setInitialStock((current) => ({ ...current, expiresAt: "" }));
  }

  function selectManagedCategory(id: string) {
    const selected = categories.find((item) => item.id === id);
    setManagedCategoryId(id);
    setManagedCategory({ name: selected?.name ?? "", description: selected?.description ?? "", defaultExpiryTracking: selected?.defaultExpiryTracking ?? "not_applicable" });
    setCategoryError("");
  }

  function openCategoryManager() {
    setManageCategories(true);
    selectManagedCategory(categories[0]?.id ?? "");
  }

  function saveManagedCategory(event: React.FormEvent) {
    event.preventDefault(); setCategoryError("");
    startTransition(async () => {
      const result = await updateInventoryCategory(managedCategoryId, managedCategory);
      if (!result.ok) { setCategoryError(result.message); return; }
      setCategories((current) => current.map((item) => item.id === result.category.id ? result.category : item).sort((a, b) => a.name.localeCompare(b.name)));
      notify(`${result.category.name} was updated.`); router.refresh();
    });
  }

  function save(event: React.FormEvent) {
    event.preventDefault(); setFormError("");
    startTransition(async () => {
      const input = {
        ...(editing !== "new" && editing ? { productId: editing.databaseId } : {}),
        name: form.name, description: form.description, categoryId: form.categoryId,
        packageSize: editing !== "new" && editing ? editing.packageSize : 1,
        packageUnit: editing !== "new" && editing ? editing.packageUnit : form.stockUnit.trim() || "unit",
        stockUnit: form.stockUnit,
        sellingPrice: Number(form.sellingPrice), minimumStock: Number(form.minimumStock), expiryTracking: form.expiryTracking,
        barcodeMode: form.barcodeMode, barcode: form.barcode,
      };
      const result = editing === "new" && addInitialStock
        ? await createInventoryProductWithInitialStock(input, {
          quantity: Number(initialStock.quantity),
          unitCost: Number(initialStock.unitCost),
          expiresAt: initialStock.expiresAt || undefined,
          expiryTracking: form.expiryTracking,
        })
        : editing === "new" ? await createInventoryProduct(input) : await updateInventoryProduct(input);
      if (!result.ok) { setFormError(result.message); return; }
      setPrintProduct(result.product);
      setPrintProductHasOpeningStock(editing === "new" && addInitialStock);
      setEditing(null);
      notify(editing === "new"
        ? addInitialStock ? `${result.product.productCode} was registered with ${formatQuantity(Number(initialStock.quantity), form.stockUnit)}.` : `${result.product.productCode} was registered.`
        : `${result.product.productCode} was updated.`);
      setAddInitialStock(false); setInitialStock({ quantity: "", unitCost: "", expiresAt: "" }); router.refresh();
    });
  }

  function addCategory() {
    setCategoryError("");
    startTransition(async () => {
      const result = await createInventoryCategory(categoryForm);
      if (!result.ok) { setCategoryError(result.message); return; }
      setCategories((current) => [...current, result.category].sort((a, b) => a.name.localeCompare(b.name)));
      setForm((current) => ({ ...current, categoryId: result.category.id, expiryTracking: result.category.defaultExpiryTracking }));
      if (result.category.defaultExpiryTracking === "not_applicable") setInitialStock((current) => ({ ...current, expiresAt: "" }));
      setCategoryForm({ name: "", description: "", defaultExpiryTracking: "not_applicable" }); setNewCategory(false); notify(`${result.category.name} was added.`);
    });
  }

  function archive() {
    if (!editing || editing === "new") return;
    startTransition(async () => {
      const result = await archiveInventoryProduct(editing.databaseId, archiveReason, confirmArchiveStockRemoval);
      if (!result.ok) { setFormError(result.message); return; }
      notify(`${editing.name} was archived${editing.stock > 0 ? ` and ${formatQuantity(editing.stock, editing.unit)} was removed from stock` : ""}.`); setEditing(null); setConfirmArchive(false); setConfirmArchiveStockRemoval(false); setArchiveReason(""); setCatalogMode("archived"); loadArchivedProducts(); router.refresh();
    });
  }

  function restore(product: ArchivedProduct) {
    setArchivedError("");
    startTransition(async () => {
      const result = await restoreInventoryProduct(product.databaseId);
      if (!result.ok) { setArchivedError(result.message); return; }
      setArchivedProducts((current) => current.filter((item) => item.databaseId !== product.databaseId));
      notify(`${product.name} was restored.`); router.refresh();
    });
  }

  function closeDeleteDialog() {
    if (isPending) return;
    setDeleteProduct(null); setDeleteConfirmation(""); setDeleteError("");
  }

  function deleteArchivedProduct() {
    if (!deleteProduct || deleteConfirmation.trim() !== deleteProduct.productCode) return;
    setDeleteError("");
    startTransition(async () => {
      const result = await permanentlyDeleteArchivedProduct(deleteProduct.databaseId, deleteConfirmation);
      if (!result.ok) { setDeleteError(result.message); return; }
      setArchivedProducts((current) => current.filter((item) => item.databaseId !== deleteProduct.databaseId));
      notify(`${deleteProduct.name} was permanently deleted.`);
      setDeleteProduct(null); setDeleteConfirmation(""); router.refresh();
    });
  }

  if (editing) {
    const isNew = editing === "new";
    return <form className="panel overflow-hidden" onSubmit={save}>
      <div className="flex flex-col gap-3 border-b border-[var(--border)] p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6"><div>{!isNew && <p className="text-xs font-bold text-[var(--accent)]">{editing.id}</p>}<h2 className={`${isNew ? "" : "mt-1 "}text-xl font-bold`}>{isNew ? "Register a product" : `Edit ${editing.name}`}</h2></div><Button type="button" variant="ghost" onClick={() => setEditing(null)}>Back to products</Button></div>
      <div className="grid gap-8 p-5 sm:p-6 lg:grid-cols-2">
        <fieldset className="grid content-start gap-4"><legend className="mb-3 text-base font-bold">Product details</legend>
          <div><label className="field-label" htmlFor="product-name">Product name</label><Input id="product-name" value={form.name} onChange={(event) => set("name", event.target.value)} required maxLength={160} /></div>
          <div><label className="field-label" htmlFor="product-description">Description <span className="font-normal text-[var(--muted-foreground)]">(optional)</span></label><Textarea id="product-description" value={form.description} onChange={(event) => set("description", event.target.value)} maxLength={1000} className="min-h-24 rounded-xl" /></div>
          <div><div className="mb-2 flex items-center justify-between"><label className="field-label mb-0" htmlFor="product-category">Category</label>{canManage && <button type="button" className="text-xs font-bold text-[var(--accent)]" onClick={() => setNewCategory((value) => !value)}>{newCategory ? "Cancel new category" : "+ New category"}</button>}</div><select id="product-category" className="select-field" value={form.categoryId} onChange={(event) => { const selected = categories.find((item) => item.id === event.target.value); set("categoryId", event.target.value); if (selected) setExpiryTracking(selected.defaultExpiryTracking); }} required><option value="">Select a category</option>{categories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></div>
          {newCategory && <div className="grid gap-3 border-l-2 border-[var(--accent)] pl-4"><div><label className="field-label" htmlFor="new-category-name">Category name</label><Input id="new-category-name" value={categoryForm.name} onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))} /></div><div><label className="field-label" htmlFor="new-category-description">Description <span className="font-normal text-[var(--muted-foreground)]">(optional)</span></label><Input id="new-category-description" value={categoryForm.description} onChange={(event) => setCategoryForm((current) => ({ ...current, description: event.target.value }))} /></div><div><label className="field-label" htmlFor="new-category-expiry">Default expiry rule</label><select id="new-category-expiry" className="select-field" value={categoryForm.defaultExpiryTracking} onChange={(event) => setCategoryForm((current) => ({ ...current, defaultExpiryTracking: event.target.value as "required" | "not_applicable" }))}><option value="not_applicable">Does not expire</option><option value="required">Expiry required</option></select></div><Button type="button" variant="secondary" disabled={isPending} onClick={addCategory}>Add category</Button>{categoryError && <p role="alert" className="text-sm font-medium text-red-700">{categoryError}</p>}</div>}
          <div><label className="field-label" htmlFor="stock-unit">Unit of measure</label><Input id="stock-unit" placeholder="box, kilo, piece" value={form.stockUnit} onChange={(event) => set("stockUnit", event.target.value)} required maxLength={24} /></div>
        </fieldset>
        <fieldset className="grid content-start gap-4"><legend className="mb-3 text-base font-bold">Sales and tracking</legend>
          <div className="grid grid-cols-2 gap-3"><div><label className="field-label" htmlFor="selling-price">Selling price</label><Input id="selling-price" type="number" min="0" step="0.01" value={form.sellingPrice} onChange={(event) => set("sellingPrice", event.target.value)} required /></div><div><label className="field-label" htmlFor="minimum-stock">Restock level</label><Input id="minimum-stock" type="number" min="0" step="1" value={form.minimumStock} onChange={(event) => set("minimumStock", event.target.value)} required /></div></div>
          <div><label className="field-label" htmlFor="expiry-tracking">Expiry tracking</label><select id="expiry-tracking" className="select-field" value={form.expiryTracking} onChange={(event) => setExpiryTracking(event.target.value as ProductForm["expiryTracking"])}><option value="not_applicable">This product does not expire</option><option value="required">Require expiry on every received batch</option></select></div>
          {isNew && canReceive && <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/35 p-4">
            <label className="flex cursor-pointer items-start gap-3" htmlFor="add-initial-stock">
              <input id="add-initial-stock" type="checkbox" className="mt-1 size-4 accent-[var(--accent)]" checked={addInitialStock} onChange={(event) => setAddInitialStock(event.target.checked)} />
              <span><span className="block text-sm font-bold">Add initial stock now</span><span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">Create the first inventory batch with this product.</span></span>
            </label>
            {addInitialStock && <div className="mt-4 grid gap-4 border-t border-[var(--border)] pt-4 sm:grid-cols-2">
              <div><label className="field-label" htmlFor="initial-quantity">Initial quantity</label><Input id="initial-quantity" type="number" min="1" max="1000000" step="1" value={initialStock.quantity} onChange={(event) => setInitialStock((current) => ({ ...current, quantity: event.target.value }))} required /></div>
              <div><label className="field-label" htmlFor="initial-unit-cost">Purchase price / {form.stockUnit.trim() || "unit"}</label><Input id="initial-unit-cost" type="number" min="0.01" max="100000000" step="0.01" value={initialStock.unitCost} onChange={(event) => setInitialStock((current) => ({ ...current, unitCost: event.target.value }))} required /></div>
              {form.expiryTracking === "required" && <div className="sm:col-span-2"><label className="field-label" htmlFor="initial-expiry">Expiry date</label><Input id="initial-expiry" type="date" min={new Date().toISOString().slice(0, 10)} value={initialStock.expiresAt} onChange={(event) => setInitialStock((current) => ({ ...current, expiresAt: event.target.value }))} required /></div>}
            </div>}
          </div>}
          <fieldset><legend className="field-label">Barcode source</legend><div className="grid grid-cols-2 gap-2">{([['manufacturer', 'Enter barcode'], ['generated', 'Generate INV code']] as const).map(([value, label]) => <label key={value} className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-semibold ${form.barcodeMode === value ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "border-[var(--border)] bg-white"}`}><input type="radio" name="barcode-mode" className="accent-[var(--accent)]" checked={form.barcodeMode === value} onChange={() => set("barcodeMode", value)} />{label}</label>)}</div></fieldset>
          {form.barcodeMode === "manufacturer" ? <div><label className="field-label" htmlFor="product-barcode">Barcode</label><div className="relative"><Barcode className="absolute left-3.5 top-3.5 text-[var(--muted-foreground)]" size={18} /><Input id="product-barcode" className="pl-10 font-mono" value={form.barcode} onChange={(event) => set("barcode", event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); } }} aria-describedby={isNew ? undefined : "product-barcode-help"} required minLength={4} maxLength={64} /></div>{!isNew && <p id="product-barcode-help" className="mt-1.5 text-xs text-[var(--muted-foreground)]">The old barcode remains reserved as an inactive alias after you save.</p>}</div> : <BarcodeGenerationPreview productName={form.name} />}
          {formError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{formError}</div>}
        </fieldset>
      </div>
      <div className="flex flex-col gap-4 border-t border-[var(--border)] p-5 sm:p-6"><div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between"><div>{!isNew && canArchive && (!confirmArchive ? <Button type="button" variant="ghost" className="text-red-700" onClick={() => { setConfirmArchive(true); setFormError(""); }}><Archive size={17} />Archive product</Button> : <div className="grid max-w-lg gap-3"><label className="field-label mb-0" htmlFor="archive-reason">Why is this product being archived?</label><Input id="archive-reason" value={archiveReason} onChange={(event) => setArchiveReason(event.target.value)} placeholder="Example: Product discontinued" minLength={2} maxLength={160} required />{editing.stock > 0 && <Alert variant="destructive"><Warning aria-hidden="true" /><AlertTitle>{formatQuantity(editing.stock, editing.unit)} will be removed</AlertTitle><AlertDescription><p>Archiving will write off all remaining stock and set every batch to zero. The adjustment and previous transactions will remain in history.</p><label className="mt-3 flex cursor-pointer items-start gap-3" htmlFor="confirm-archive-stock-removal"><input id="confirm-archive-stock-removal" type="checkbox" className="mt-0.5 size-4 shrink-0 accent-[var(--destructive)]" checked={confirmArchiveStockRemoval} onChange={(event) => { setConfirmArchiveStockRemoval(event.target.checked); setFormError(""); }} /><span className="font-semibold">I understand that the remaining stock will be removed.</span></label></AlertDescription></Alert>}<div className="flex flex-wrap gap-2"><Button type="button" variant="ghost" onClick={() => { setConfirmArchive(false); setConfirmArchiveStockRemoval(false); setArchiveReason(""); setFormError(""); }}>Cancel archive</Button><Button type="button" variant="destructive" disabled={isPending || archiveReason.trim().length < 2 || (editing.stock > 0 && !confirmArchiveStockRemoval)} onClick={archive}>{isPending ? "Archiving…" : editing.stock > 0 ? "Remove stock and archive" : "Confirm archive"}</Button></div></div>)}</div><div className="flex gap-2 self-end"><Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" disabled={isPending}>{isPending ? "Saving…" : isNew && addInitialStock ? "Register and add stock" : isNew ? "Register product" : "Save changes"}</Button></div></div></div>
    </form>;
  }

  if (manageCategories) {
    return <form className="panel overflow-hidden" onSubmit={saveManagedCategory}>
      <div className="flex flex-col gap-3 border-b border-[var(--border)] p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6"><div><h2 className="text-xl font-bold">Manage categories</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">The default expiry rule is applied when a category is selected for a product.</p></div><Button type="button" variant="ghost" onClick={() => setManageCategories(false)}>Back to products</Button></div>
      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[.7fr_1fr]"><div><label className="field-label" htmlFor="managed-category-select">Category</label><select id="managed-category-select" className="select-field" value={managedCategoryId} onChange={(event) => selectManagedCategory(event.target.value)}>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div className="grid gap-4"><div><label className="field-label" htmlFor="managed-category-name">Category name</label><Input id="managed-category-name" value={managedCategory.name} onChange={(event) => setManagedCategory((current) => ({ ...current, name: event.target.value }))} required /></div><div><label className="field-label" htmlFor="managed-category-description">Description <span className="font-normal text-[var(--muted-foreground)]">(optional)</span></label><Textarea id="managed-category-description" className="min-h-24 rounded-xl" value={managedCategory.description} onChange={(event) => setManagedCategory((current) => ({ ...current, description: event.target.value }))} /></div><div><label className="field-label" htmlFor="managed-category-expiry">Default expiry rule</label><select id="managed-category-expiry" className="select-field" value={managedCategory.defaultExpiryTracking} onChange={(event) => setManagedCategory((current) => ({ ...current, defaultExpiryTracking: event.target.value as "required" | "not_applicable" }))}><option value="not_applicable">Does not expire</option><option value="required">Expiry required</option></select></div>{categoryError && <p role="alert" className="text-sm font-medium text-red-700">{categoryError}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setManageCategories(false)}>Cancel</Button><Button type="submit" disabled={!managedCategoryId || isPending}>{isPending ? "Saving…" : "Save category"}</Button></div></div></div>
    </form>;
  }

  return <div className="grid gap-5">
    <Dialog open={deleteProduct !== null} onOpenChange={(open) => { if (!open) closeDeleteDialog(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Permanently delete {deleteProduct?.name}?</DialogTitle>
          <DialogDescription>This cannot be undone. Deleting this product also removes its sale lines and related return records directly from the database.</DialogDescription>
        </DialogHeader>
        <Alert variant="destructive">
          <Warning aria-hidden="true" />
          <AlertTitle>Historical records will be rewritten</AlertTitle>
          <AlertDescription>Receipt totals will be recalculated, receipts left with no items will be deleted, and related returns, batches, adjustments, costs, and barcode aliases will be removed.</AlertDescription>
        </Alert>
        <div>
          <label className="field-label" htmlFor="delete-product-confirmation">Type <strong>{deleteProduct?.productCode}</strong> to confirm</label>
          <Input id="delete-product-confirmation" autoComplete="off" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} aria-invalid={Boolean(deleteError)} aria-describedby={deleteError ? "delete-product-error" : undefined} />
          {deleteError && <p id="delete-product-error" role="alert" className="mt-2 text-sm font-medium text-red-700">{deleteError}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" disabled={isPending} onClick={closeDeleteDialog}>Cancel</Button>
          <Button type="button" variant="destructive" disabled={isPending || deleteConfirmation.trim() !== deleteProduct?.productCode} onClick={deleteArchivedProduct}>{isPending ? "Deleting…" : "Delete permanently"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {printProduct && <BarcodePrintPanel product={printProduct} onClose={() => { setPrintProduct(null); setPrintProductHasOpeningStock(false); }} onReceive={canReceive && !printProductHasOpeningStock ? () => onReceive(printProduct.databaseId) : undefined} />}
    <div className="flex gap-2" role="tablist" aria-label="Product catalog"><button type="button" role="tab" aria-selected={catalogMode === "active"} onClick={() => { setCatalogMode("active"); setPage(1); }} className={`min-h-10 rounded-xl px-4 text-sm font-semibold ${catalogMode === "active" ? "bg-[#173b2d] text-white" : "border border-[var(--border)] bg-white text-[var(--muted-foreground)] hover:bg-[var(--muted)]"}`}>Active products</button><button type="button" role="tab" aria-selected={catalogMode === "archived"} onClick={openArchivedProducts} className={`min-h-10 rounded-xl px-4 text-sm font-semibold ${catalogMode === "archived" ? "bg-[#173b2d] text-white" : "border border-[var(--border)] bg-white text-[var(--muted-foreground)] hover:bg-[var(--muted)]"}`}>Archived products</button></div>
    <div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><MagnifyingGlass className="absolute left-3.5 top-3.5 text-[var(--muted-foreground)]" size={18} /><Input className="pl-10" placeholder="Search product, code, or barcode" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></div><select className="select-field sm:w-52" value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }}><option>All categories</option>{categories.map((item) => <option key={item.id}>{item.name}</option>)}</select>{canManage && <><Button variant="secondary" onClick={openCategoryManager} disabled={categories.length === 0}>Manage categories</Button><Button onClick={beginCreate}><Plus size={17} />Add product</Button></>}</div>
    {categoryError && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">{categoryError}</div>}
    {archivedError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{archivedError}</div>}
    {catalogMode === "active" ? <div className="panel overflow-hidden">{shown.length > 0 ? <><div className="overflow-x-auto"><table className="data-table min-w-[960px]"><thead><tr><th>Product</th><th>Barcode</th><th>Category</th><th>Price</th><th>Quantity</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{activePage.items.map((product) => <tr key={product.id}><td><p className="font-semibold">{product.name}</p><p className="mt-0.5 max-w-72 truncate text-xs text-[var(--muted-foreground)]" title={product.description}>{product.id}{product.description ? ` · ${product.description}` : ""}</p></td><td className="font-mono text-xs">{product.barcode}</td><td>{product.category}</td><td>{peso(product.price)}</td><td><strong>{product.stock}</strong> <span className="text-xs text-[var(--muted-foreground)]">{pluralizeUnit(product.stock, product.unit)}</span></td><td><StatusBadge status={getStockStatus(product)} /></td><td><div className="flex justify-end gap-1"><Button size="sm" variant="ghost" onClick={() => setPrintProduct({ databaseId: product.databaseId, productCode: product.id, name: product.name, barcode: product.barcode })}><Printer size={16} />Print</Button>{canManage && <Button size="sm" variant="ghost" onClick={() => beginEdit(product)}><PencilSimple size={16} />Edit</Button>}{canReceive && <Button size="sm" variant="ghost" onClick={() => onReceive(product.databaseId)}><Plus size={16} />Receive</Button>}</div></td></tr>)}</tbody></table></div><TablePagination {...activePage} pageSize={pageSize} itemLabel="products" onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} /></> : <div className="grid place-items-center px-5 py-14 text-center"><span className="grid size-12 place-items-center rounded-2xl bg-[var(--muted)] text-[var(--muted-foreground)]"><Package size={23} /></span><h3 className="mt-4 font-bold">{products.length === 0 ? "No products yet" : "No matching products"}</h3><p className="mt-1 max-w-sm text-sm text-[var(--muted-foreground)]">{products.length === 0 ? "Register the first product to begin receiving inventory." : "Try a different name, code, barcode, or category."}</p>{products.length === 0 && canManage && <Button className="mt-5" onClick={beginCreate}><Plus size={17} />Register first product</Button>}</div>}</div> : <ArchivedProductsPanel products={archivedPage.items} total={shownArchived.length} loading={archivedLoading} canRestore={canArchive} canPermanentlyDelete={canPermanentlyDelete} pending={isPending} onRestore={restore} onDelete={(product) => { setDeleteProduct(product); setDeleteConfirmation(""); setDeleteError(""); }} pagination={<TablePagination {...archivedPage} pageSize={pageSize} itemLabel="archived products" onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />} />}
    {!canManage && <p className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]"><Warning size={16} />Only managers and administrators can change product records.</p>}
  </div>;
}

function ArchivedProductsPanel({ products, total, loading, canRestore, canPermanentlyDelete, pending, onRestore, onDelete, pagination }: { products: ArchivedProduct[]; total: number; loading: boolean; canRestore: boolean; canPermanentlyDelete: boolean; pending: boolean; onRestore: (product: ArchivedProduct) => void; onDelete: (product: ArchivedProduct) => void; pagination: React.ReactNode }) {
  if (loading) return <div className="panel grid min-h-48 place-items-center text-sm text-[var(--muted-foreground)]">Loading archived products…</div>;
  if (total === 0) return <div className="panel grid place-items-center px-5 py-14 text-center"><span className="grid size-12 place-items-center rounded-2xl bg-[var(--muted)] text-[var(--muted-foreground)]"><Archive size={23} /></span><h3 className="mt-4 font-bold">No archived products</h3><p className="mt-1 max-w-sm text-sm text-[var(--muted-foreground)]">Discontinued products will remain recoverable here, or adjust the current search and category filter.</p></div>;
  return <div className="panel overflow-hidden"><div className="overflow-x-auto"><table className="data-table min-w-[960px]"><thead><tr><th>Product</th><th>Barcode</th><th>Category</th><th>Reason</th><th>Archived</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{products.map((product) => <tr key={product.databaseId}><td><p className="font-semibold">{product.name}</p><p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{product.productCode}</p></td><td className="font-mono text-xs">{product.barcode}</td><td>{product.categoryName}</td><td><p className="max-w-72 text-sm">{product.archiveReason}</p></td><td><p className="text-sm">{new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(new Date(product.archivedAt))}</p>{product.archivedBy && <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">by {product.archivedBy}</p>}</td><td><div className="flex justify-end gap-2">{canRestore && <Button size="sm" variant="secondary" disabled={pending} onClick={() => onRestore(product)}><ArrowCounterClockwise data-icon="inline-start" />Restore</Button>}{canPermanentlyDelete && <Button size="sm" variant="destructive" disabled={pending} onClick={() => onDelete(product)}><Trash data-icon="inline-start" />Delete</Button>}</div></td></tr>)}</tbody></table></div>{pagination}</div>;
}
