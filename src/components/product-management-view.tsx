"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Barcode, MagnifyingGlass, Package, PencilSimple, Plus, Printer, Warning } from "@phosphor-icons/react";
import {
  archiveInventoryProduct,
  createInventoryCategory,
  createInventoryProduct,
  listInventoryCategories,
  updateInventoryCategory,
  updateInventoryProduct,
  type CategoryOption,
  type SavedProduct,
} from "@/app/inventory/actions";
import { BarcodePrintPanel } from "@/components/barcode-label";
import { useInventory } from "@/components/inventory-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";
import { getStockStatus, type Product } from "@/lib/types";

type ProductForm = {
  name: string; description: string; categoryId: string; packageSize: string; packageUnit: string;
  stockUnit: string; sellingPrice: string; minimumStock: string; expiryTracking: "required" | "not_applicable";
  barcodeMode: "manufacturer" | "generated"; barcode: string;
};

const emptyForm: ProductForm = { name: "", description: "", categoryId: "", packageSize: "", packageUnit: "", stockUnit: "", sellingPrice: "", minimumStock: "0", expiryTracking: "not_applicable", barcodeMode: "manufacturer", barcode: "" };

function peso(value: number) { return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value); }

function formFromProduct(product: Product): ProductForm {
  return { name: product.name, description: product.description ?? "", categoryId: product.categoryId, packageSize: String(product.packageSize), packageUnit: product.packageUnit, stockUnit: product.unit, sellingPrice: String(product.price), minimumStock: String(product.minimumStock), expiryTracking: product.expiryTracking, barcodeMode: "manufacturer", barcode: product.barcode };
}

export function ProductManagementView({ startCreating, canManage, canArchive, canReceive, notify, onReceive }: { startCreating: boolean; canManage: boolean; canArchive: boolean; canReceive: boolean; notify: (message: string) => void; onReceive: (productId: string) => void }) {
  const { products } = useInventory();
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [categoryError, setCategoryError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All categories");
  const [editing, setEditing] = useState<Product | null | "new">(startCreating && canManage ? "new" : null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [formError, setFormError] = useState("");
  const [newCategory, setNewCategory] = useState(false);
  const [categoryForm, setCategoryForm] = useState<{ name: string; description: string; defaultExpiryTracking: "required" | "not_applicable" }>({ name: "", description: "", defaultExpiryTracking: "not_applicable" });
  const [manageCategories, setManageCategories] = useState(false);
  const [managedCategoryId, setManagedCategoryId] = useState("");
  const [managedCategory, setManagedCategory] = useState<{ name: string; description: string; defaultExpiryTracking: "required" | "not_applicable" }>({ name: "", description: "", defaultExpiryTracking: "not_applicable" });
  const [printProduct, setPrintProduct] = useState<SavedProduct | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
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

  function beginCreate() {
    setEditing("new"); setForm({ ...emptyForm, categoryId: categories[0]?.id ?? "" }); setFormError(""); setConfirmArchive(false);
  }
  function beginEdit(product: Product) { setEditing(product); setForm(formFromProduct(product)); setFormError(""); setConfirmArchive(false); }
  function set<K extends keyof ProductForm>(key: K, value: ProductForm[K]) { setForm((current) => ({ ...current, [key]: value })); }

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
        packageSize: Number(form.packageSize), packageUnit: form.packageUnit, stockUnit: form.stockUnit,
        sellingPrice: Number(form.sellingPrice), minimumStock: Number(form.minimumStock), expiryTracking: form.expiryTracking,
        barcodeMode: form.barcodeMode, barcode: form.barcode,
      };
      const result = editing === "new" ? await createInventoryProduct(input) : await updateInventoryProduct(input);
      if (!result.ok) { setFormError(result.message); return; }
      setPrintProduct(result.product); setEditing(null); notify(editing === "new" ? `${result.product.productCode} was registered.` : `${result.product.productCode} was updated.`); router.refresh();
    });
  }

  function addCategory() {
    setCategoryError("");
    startTransition(async () => {
      const result = await createInventoryCategory(categoryForm);
      if (!result.ok) { setCategoryError(result.message); return; }
      setCategories((current) => [...current, result.category].sort((a, b) => a.name.localeCompare(b.name)));
      setForm((current) => ({ ...current, categoryId: result.category.id, expiryTracking: result.category.defaultExpiryTracking }));
      setCategoryForm({ name: "", description: "", defaultExpiryTracking: "not_applicable" }); setNewCategory(false); notify(`${result.category.name} was added.`);
    });
  }

  function archive() {
    if (!editing || editing === "new") return;
    startTransition(async () => {
      const result = await archiveInventoryProduct(editing.databaseId);
      if (!result.ok) { setFormError(result.message); return; }
      notify(`${editing.name} was archived.`); setEditing(null); setConfirmArchive(false); router.refresh();
    });
  }

  if (editing) {
    const isNew = editing === "new";
    return <form className="panel overflow-hidden" onSubmit={save}>
      <div className="flex flex-col gap-3 border-b border-[var(--border)] p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6"><div><p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--accent)]">{isNew ? "New product" : editing.id}</p><h2 className="mt-1 text-xl font-bold">{isNew ? "Register a product" : `Edit ${editing.name}`}</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">New products begin with zero stock. Receive the first batch after saving.</p></div><Button type="button" variant="ghost" onClick={() => setEditing(null)}>Back to products</Button></div>
      <div className="grid gap-8 p-5 sm:p-6 lg:grid-cols-2">
        <fieldset className="grid content-start gap-4"><legend className="mb-3 text-base font-bold">Product details</legend>
          <div><label className="field-label" htmlFor="product-name">Product name</label><Input id="product-name" value={form.name} onChange={(event) => set("name", event.target.value)} required maxLength={160} /></div>
          <div><label className="field-label" htmlFor="product-description">Description <span className="font-normal text-[var(--muted-foreground)]">(optional)</span></label><Textarea id="product-description" value={form.description} onChange={(event) => set("description", event.target.value)} maxLength={1000} className="min-h-24 rounded-xl" /></div>
          <div><div className="mb-2 flex items-center justify-between"><label className="field-label mb-0" htmlFor="product-category">Category</label>{canManage && <button type="button" className="text-xs font-bold text-[var(--accent)]" onClick={() => setNewCategory((value) => !value)}>{newCategory ? "Cancel new category" : "+ New category"}</button>}</div><select id="product-category" className="select-field" value={form.categoryId} onChange={(event) => { const selected = categories.find((item) => item.id === event.target.value); set("categoryId", event.target.value); if (selected) set("expiryTracking", selected.defaultExpiryTracking); }} required><option value="">Select a category</option>{categories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></div>
          {newCategory && <div className="grid gap-3 border-l-2 border-[var(--accent)] pl-4"><div><label className="field-label" htmlFor="new-category-name">Category name</label><Input id="new-category-name" value={categoryForm.name} onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))} /></div><div><label className="field-label" htmlFor="new-category-description">Description <span className="font-normal text-[var(--muted-foreground)]">(optional)</span></label><Input id="new-category-description" value={categoryForm.description} onChange={(event) => setCategoryForm((current) => ({ ...current, description: event.target.value }))} /></div><div><label className="field-label" htmlFor="new-category-expiry">Default expiry rule</label><select id="new-category-expiry" className="select-field" value={categoryForm.defaultExpiryTracking} onChange={(event) => setCategoryForm((current) => ({ ...current, defaultExpiryTracking: event.target.value as "required" | "not_applicable" }))}><option value="not_applicable">Does not expire</option><option value="required">Expiry required</option></select></div><Button type="button" variant="secondary" disabled={isPending} onClick={addCategory}>Add category</Button>{categoryError && <p role="alert" className="text-sm font-medium text-red-700">{categoryError}</p>}</div>}
          <div className="grid grid-cols-2 gap-3"><div><label className="field-label" htmlFor="package-size">Package size</label><Input id="package-size" type="number" min="0.001" step="0.001" value={form.packageSize} onChange={(event) => set("packageSize", event.target.value)} required /></div><div><label className="field-label" htmlFor="package-unit">Package unit</label><Input id="package-unit" placeholder="kg, g, ml" value={form.packageUnit} onChange={(event) => set("packageUnit", event.target.value)} required maxLength={24} /></div></div>
          <div><label className="field-label" htmlFor="stock-unit">Counted as</label><Input id="stock-unit" placeholder="bag, can, bottle" value={form.stockUnit} onChange={(event) => set("stockUnit", event.target.value)} required maxLength={24} /></div>
        </fieldset>
        <fieldset className="grid content-start gap-4"><legend className="mb-3 text-base font-bold">Sales and tracking</legend>
          <div className="grid grid-cols-2 gap-3"><div><label className="field-label" htmlFor="selling-price">Selling price</label><Input id="selling-price" type="number" min="0" step="0.01" value={form.sellingPrice} onChange={(event) => set("sellingPrice", event.target.value)} required /></div><div><label className="field-label" htmlFor="minimum-stock">Restock level</label><Input id="minimum-stock" type="number" min="0" step="1" value={form.minimumStock} onChange={(event) => set("minimumStock", event.target.value)} required /></div></div>
          <div><label className="field-label" htmlFor="expiry-tracking">Expiry tracking</label><select id="expiry-tracking" className="select-field" value={form.expiryTracking} onChange={(event) => set("expiryTracking", event.target.value as ProductForm["expiryTracking"])}><option value="not_applicable">This product does not expire</option><option value="required">Require expiry on every received batch</option></select></div>
          <fieldset><legend className="field-label">Barcode source</legend><div className="grid grid-cols-2 gap-2">{([['manufacturer', 'Enter barcode'], ['generated', 'Generate INV code']] as const).map(([value, label]) => <label key={value} className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-semibold ${form.barcodeMode === value ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "border-[var(--border)] bg-white"}`}><input type="radio" name="barcode-mode" className="accent-[var(--accent)]" checked={form.barcodeMode === value} onChange={() => set("barcodeMode", value)} />{label}</label>)}</div></fieldset>
          {form.barcodeMode === "manufacturer" ? <div><label className="field-label" htmlFor="product-barcode">Barcode</label><div className="relative"><Barcode className="absolute left-3.5 top-3.5 text-[var(--muted-foreground)]" size={18} /><Input id="product-barcode" className="pl-10 font-mono" value={form.barcode} onChange={(event) => set("barcode", event.target.value)} required minLength={4} maxLength={64} /></div><p className="mt-1.5 text-xs text-[var(--muted-foreground)]">Changing this keeps the old barcode reserved as an inactive alias.</p></div> : <div className="rounded-xl bg-[var(--muted)] p-4 text-sm"><strong>The system will assign the next `INV-######` code.</strong><p className="mt-1 text-[var(--muted-foreground)]">You can print individual labels or an A4 sheet after saving.</p></div>}
          {formError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{formError}</div>}
        </fieldset>
      </div>
      <div className="flex flex-col-reverse gap-3 border-t border-[var(--border)] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div>{!isNew && canArchive && (!confirmArchive ? <Button type="button" variant="ghost" className="text-red-700" onClick={() => setConfirmArchive(true)}>Archive product</Button> : <div className="flex items-center gap-2"><span className="text-sm font-semibold text-red-700">Remove from active catalog?</span><Button type="button" variant="ghost" onClick={() => setConfirmArchive(false)}>Cancel</Button><Button type="button" variant="destructive" disabled={isPending} onClick={archive}>Archive</Button></div>)}</div><div className="flex gap-2"><Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" disabled={isPending}>{isPending ? "Saving…" : isNew ? "Register product" : "Save changes"}</Button></div></div>
    </form>;
  }

  if (manageCategories) {
    return <form className="panel overflow-hidden" onSubmit={saveManagedCategory}>
      <div className="flex flex-col gap-3 border-b border-[var(--border)] p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6"><div><p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--accent)]">Product organization</p><h2 className="mt-1 text-xl font-bold">Manage categories</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">The default expiry rule is applied when a category is selected for a product.</p></div><Button type="button" variant="ghost" onClick={() => setManageCategories(false)}>Back to products</Button></div>
      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[.7fr_1fr]"><div><label className="field-label" htmlFor="managed-category-select">Category</label><select id="managed-category-select" className="select-field" value={managedCategoryId} onChange={(event) => selectManagedCategory(event.target.value)}>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div className="grid gap-4"><div><label className="field-label" htmlFor="managed-category-name">Category name</label><Input id="managed-category-name" value={managedCategory.name} onChange={(event) => setManagedCategory((current) => ({ ...current, name: event.target.value }))} required /></div><div><label className="field-label" htmlFor="managed-category-description">Description <span className="font-normal text-[var(--muted-foreground)]">(optional)</span></label><Textarea id="managed-category-description" className="min-h-24 rounded-xl" value={managedCategory.description} onChange={(event) => setManagedCategory((current) => ({ ...current, description: event.target.value }))} /></div><div><label className="field-label" htmlFor="managed-category-expiry">Default expiry rule</label><select id="managed-category-expiry" className="select-field" value={managedCategory.defaultExpiryTracking} onChange={(event) => setManagedCategory((current) => ({ ...current, defaultExpiryTracking: event.target.value as "required" | "not_applicable" }))}><option value="not_applicable">Does not expire</option><option value="required">Expiry required</option></select></div>{categoryError && <p role="alert" className="text-sm font-medium text-red-700">{categoryError}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setManageCategories(false)}>Cancel</Button><Button type="submit" disabled={!managedCategoryId || isPending}>{isPending ? "Saving…" : "Save category"}</Button></div></div></div>
    </form>;
  }

  return <div className="grid gap-5">
    {printProduct && <BarcodePrintPanel product={printProduct} onClose={() => setPrintProduct(null)} onReceive={canReceive ? () => onReceive(printProduct.databaseId) : undefined} />}
    <div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><MagnifyingGlass className="absolute left-3.5 top-3.5 text-[var(--muted-foreground)]" size={18} /><Input className="pl-10" placeholder="Search product, code, or barcode" value={search} onChange={(event) => setSearch(event.target.value)} /></div><select className="select-field sm:w-52" value={category} onChange={(event) => setCategory(event.target.value)}><option>All categories</option>{categories.map((item) => <option key={item.id}>{item.name}</option>)}</select>{canManage && <><Button variant="secondary" onClick={openCategoryManager} disabled={categories.length === 0}>Manage categories</Button><Button onClick={beginCreate}><Plus size={17} />Add product</Button></>}</div>
    {categoryError && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">{categoryError}</div>}
    <div className="panel overflow-hidden">{shown.length > 0 ? <div className="overflow-x-auto"><table className="data-table min-w-[960px]"><thead><tr><th>Product</th><th>Barcode</th><th>Category</th><th>Price</th><th>Quantity</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{shown.map((product) => <tr key={product.id}><td><p className="font-semibold">{product.name}</p><p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{product.id} · {product.packageSize} {product.packageUnit}</p></td><td className="font-mono text-xs">{product.barcode}</td><td>{product.category}</td><td>{peso(product.price)}</td><td><strong>{product.stock}</strong> <span className="text-xs text-[var(--muted-foreground)]">{product.unit}{product.stock === 1 ? "" : "s"}</span></td><td><StatusBadge status={getStockStatus(product)} /></td><td><div className="flex justify-end gap-1"><Button size="sm" variant="ghost" onClick={() => setPrintProduct({ databaseId: product.databaseId, productCode: product.id, name: product.name, barcode: product.barcode })}><Printer size={16} />Print</Button>{canManage && <Button size="sm" variant="ghost" onClick={() => beginEdit(product)}><PencilSimple size={16} />Edit</Button>}{canReceive && <Button size="sm" variant="ghost" onClick={() => onReceive(product.databaseId)}><Plus size={16} />Receive</Button>}</div></td></tr>)}</tbody></table></div> : <div className="grid place-items-center px-5 py-14 text-center"><span className="grid size-12 place-items-center rounded-2xl bg-[var(--muted)] text-[var(--muted-foreground)]"><Package size={23} /></span><h3 className="mt-4 font-bold">{products.length === 0 ? "No products yet" : "No matching products"}</h3><p className="mt-1 max-w-sm text-sm text-[var(--muted-foreground)]">{products.length === 0 ? "Register the first product to begin receiving inventory." : "Try a different name, code, barcode, or category."}</p>{products.length === 0 && canManage && <Button className="mt-5" onClick={beginCreate}><Plus size={17} />Register first product</Button>}</div>}</div>
    {!canManage && <p className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]"><Warning size={16} />Only managers and administrators can change product records.</p>}
  </div>;
}
