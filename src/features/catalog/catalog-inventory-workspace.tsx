"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Boxes, CalendarClock, ChevronRight, CircleAlert, Filter, Package, Search, ShieldAlert } from "lucide-react";
import { api, ApiClientError } from "@/lib/api/client";

type Data = Record<string, unknown>;
type Branch = { id: string; name: string };
type Stock = { id: string; medicineId: string; branchId: string; batchNumber: string; expiryDate: string; quantity: number; mrp: number; unit: string; rackNumber?: string | null; medicine?: Medicine; branch?: Branch };
type Medicine = { id: string; name: string; nameBangla?: string; genericName?: string; barcode?: string; dosageForm?: string; strength?: string; unit?: string; salePrice?: number; mrp?: number; reorderLevel?: number; isActive: boolean; category?: { id: string; name: string }; generic?: { id: string; name: string }; medicineManufacturer?: { id: string; name: string }; stocks?: Stock[] };
type Option = { id: string; name: string };
type Mode = "catalog" | "inventory";
type InventoryFilter = "all" | "low" | "expiring" | "expired" | "out";

function list<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") {
    const record = value as Data;
    if ("data" in record) return list<T>(record.data);
    for (const key of ["branches", "customers", "medicines", "stocks", "categories", "generics", "manufacturers"]) if (key in record) return list<T>(record[key]);
  }
  return [];
}
function number(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function bdt(value: number) { return new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT", maximumFractionDigits: 2 }).format(value || 0); }
function err(error: unknown) { return error instanceof ApiClientError ? error.message : "Could not load this data. Try again."; }
function daysUntil(date: string) { return Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000); }

export function CatalogInventoryWorkspace({ mode }: { mode: Mode }) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [generics, setGenerics] = useState<Option[]>([]);
  const [manufacturers, setManufacturers] = useState<Option[]>([]);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [genericId, setGenericId] = useState("");
  const [manufacturerId, setManufacturerId] = useState("");
  const [stockFilter, setStockFilter] = useState<InventoryFilter>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);

  useEffect(() => {
    let active = true;
    async function loadOptions() {
      const results = await Promise.allSettled([
        api.get<unknown>("/branches?page=1&limit=100"),
        api.get<unknown>("/pharmacy/categories?page=1&limit=100"),
        api.get<unknown>("/pharmacy/generics?page=1&limit=100"),
        api.get<unknown>("/pharmacy/manufacturers?page=1&limit=100"),
      ]);
      if (!active) return;
      if (results[0].status === "fulfilled") {
        const items = list<Branch>(results[0].value);
        setBranches(items);
        setBranchId(items[0]?.id ?? "");
      }
      if (results[1].status === "fulfilled") setCategories(list<Option>(results[1].value));
      if (results[2].status === "fulfilled") setGenerics(list<Option>(results[2].value));
      if (results[3].status === "fulfilled") setManufacturers(list<Option>(results[3].value));
      if (results[0].status === "rejected") setError(err(results[0].reason));
    }
    void loadOptions();
    return () => { active = false; };
  }, []);

  const load = useCallback(async () => {
    if (!branchId) { setLoading(false); return; }
    setLoading(true);
    const params = new URLSearchParams({ page: "1", limit: "100", branchId });
    if (search.trim()) params.set("search", search.trim());
    if (mode === "catalog") {
      if (categoryId) params.set("categoryId", categoryId);
      if (genericId) params.set("genericId", genericId);
      if (manufacturerId) params.set("medicineManufacturerId", manufacturerId);
    }
    try {
      if (mode === "catalog") {
        const result = await api.get<unknown>(`/pharmacy/medicines?${params.toString()}`);
        setMedicines(list<Medicine>(result));
      } else {
        const result = await api.get<unknown>(`/pharmacy/stocks?${params.toString()}`);
        setStocks(list<Stock>(result));
      }
      setError("");
    } catch (cause) { setError(err(cause)); }
    finally { setLoading(false); }
  }, [branchId, categoryId, genericId, manufacturerId, mode, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 180);
    return () => window.clearTimeout(timer);
  }, [load]);

  const enrichedStocks = useMemo(() => stocks.map((stock) => ({
    ...stock,
    state: number(stock.quantity) === 0 ? "out" : daysUntil(stock.expiryDate) < 0 ? "expired" : daysUntil(stock.expiryDate) <= 90 ? "expiring" : number(stock.quantity) <= number(stock.medicine?.reorderLevel ?? 10) ? "low" : "normal",
  })), [stocks]);
  const displayStocks = useMemo(() => enrichedStocks.filter((stock) => stockFilter === "all" || stock.state === stockFilter), [enrichedStocks, stockFilter]);
  const inventoryCounts = useMemo(() => ({
    total: stocks.length,
    low: enrichedStocks.filter((stock) => stock.state === "low").length,
    expiring: enrichedStocks.filter((stock) => stock.state === "expiring").length,
    expired: enrichedStocks.filter((stock) => stock.state === "expired").length,
    out: enrichedStocks.filter((stock) => stock.state === "out").length,
  }), [enrichedStocks, stocks.length]);

  const title = mode === "catalog" ? "Medicine catalog" : "Inventory & batches";
  const subtitle = mode === "catalog" ? "Browse active medicines, variants and current branch stock." : "Track batch quantities, expiry dates and shelf locations.";
  const activeCount = medicines.filter((item) => item.isActive).length;
  const medicineTotalStock = (medicine: Medicine) => (medicine.stocks ?? []).filter((stock) => stock.branchId === branchId).reduce((sum, stock) => sum + number(stock.quantity), 0);
  const medicineStockValue = (medicine: Medicine) => (medicine.stocks ?? []).filter((stock) => stock.branchId === branchId).reduce((sum, stock) => sum + number(stock.quantity) * number(stock.mrp), 0);

  return <section className="data-page">
    <div className="page-heading-row"><div><p className="eyebrow">PHARMACY · {mode === "catalog" ? "PRODUCTS" : "STOCK CONTROL"}</p><h1>{title}</h1><p className="page-subtitle">{subtitle}</p></div><label className="data-branch-select"><span>Branch</span><select value={branchId} onChange={(event) => setBranchId(event.target.value)}><option value="">Select branch</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label></div>
    {error && <div className="data-alert"><CircleAlert size={16}/><span>{error}</span><button onClick={() => void load()}>Retry</button></div>}
    <nav className="data-tabs" aria-label="Pharmacy inventory sections"><a href="/catalog" className={mode === "catalog" ? "selected" : ""}><Package size={15}/> Catalog</a><a href="/inventory" className={mode === "inventory" ? "selected" : ""}><Boxes size={15}/> Inventory</a></nav>
    {mode === "catalog" ? <>
      <div className="data-summary-row"><div className="data-summary-card"><span className="data-summary-icon mint"><Package size={17}/></span><span><small>Medicines shown</small><strong>{loading ? "—" : medicines.length}</strong></span></div><div className="data-summary-card"><span className="data-summary-icon blue"><Boxes size={17}/></span><span><small>Active records</small><strong>{loading ? "—" : activeCount}</strong></span></div><div className="data-summary-card"><span className="data-summary-icon amber"><AlertTriangle size={17}/></span><span><small>Low / no stock</small><strong>{loading ? "—" : medicines.filter((item) => medicineTotalStock(item) <= number(item.reorderLevel ?? 10)).length}</strong></span></div></div>
      <div className="data-card panel"><div className="data-toolbar"><div className="data-search"><Search size={17}/><input placeholder="Search medicine, generic, barcode…" value={search} onChange={(event) => setSearch(event.target.value)}/></div><button className={`data-filter-button ${filtersOpen ? "selected" : ""}`} onClick={() => setFiltersOpen(!filtersOpen)}><Filter size={15}/> Filters</button></div>
        {filtersOpen && <div className="data-filter-drawer"><label><span>Category</span><select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">All categories</option>{categories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label><span>Generic</span><select value={genericId} onChange={(event) => setGenericId(event.target.value)}><option value="">All generics</option>{generics.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label><span>Manufacturer</span><select value={manufacturerId} onChange={(event) => setManufacturerId(event.target.value)}><option value="">All manufacturers</option>{manufacturers.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><button onClick={() => { setCategoryId(""); setGenericId(""); setManufacturerId(""); }}>Clear filters</button></div>}
        <div className="data-table-scroll"><table className="data-table"><thead><tr><th>Medicine</th><th>Category / generic</th><th>Branch stock</th><th>Sale price</th><th>Stock value · MRP</th><th>Status</th><th></th></tr></thead><tbody>{medicines.map((medicine) => { const quantity = medicineTotalStock(medicine); return <tr key={medicine.id}><td><strong>{medicine.name}</strong><small>{[medicine.strength, medicine.dosageForm, medicine.barcode ? `#${medicine.barcode}` : ""].filter(Boolean).join(" · ")}</small></td><td><span>{medicine.category?.name || "Uncategorized"}</span><small>{medicine.generic?.name || medicine.genericName || "—"}</small></td><td><strong>{quantity}</strong><small>{medicine.unit || "Pcs"} · reorder at {medicine.reorderLevel ?? 10}</small></td><td>{bdt(number(medicine.salePrice) || number(medicine.mrp))}</td><td>{bdt(medicineStockValue(medicine))}</td><td><span className={`data-status ${medicine.isActive ? quantity > number(medicine.reorderLevel ?? 10) ? "good" : "warn" : "muted"}`}>{!medicine.isActive ? "Inactive" : quantity === 0 ? "Out of stock" : quantity <= number(medicine.reorderLevel ?? 10) ? "Low stock" : "Active"}</span></td><td><button className="data-row-action" onClick={() => setSelectedMedicine(medicine)} aria-label={`View batches for ${medicine.name}`}><ChevronRight size={16}/></button></td></tr>; })}</tbody></table></div>
        {!loading && medicines.length === 0 && <div className="data-empty"><Package size={22}/><strong>No medicines found</strong><span>Adjust the search or filters to see matching catalog records.</span></div>}
        {loading && <div className="data-loading">Loading medicine catalog…</div>}
      </div>
    </> : <>
      <div className="data-summary-row data-summary-row-five"><button className={`data-summary-card ${stockFilter === "all" ? "active" : ""}`} onClick={() => setStockFilter("all")}><span className="data-summary-icon mint"><Boxes size={17}/></span><span><small>All batches</small><strong>{loading ? "—" : inventoryCounts.total}</strong></span></button><button className={`data-summary-card ${stockFilter === "low" ? "active" : ""}`} onClick={() => setStockFilter("low")}><span className="data-summary-icon amber"><AlertTriangle size={17}/></span><span><small>Low stock</small><strong>{loading ? "—" : inventoryCounts.low}</strong></span></button><button className={`data-summary-card ${stockFilter === "expiring" ? "active" : ""}`} onClick={() => setStockFilter("expiring")}><span className="data-summary-icon yellow"><CalendarClock size={17}/></span><span><small>Expiring ≤90d</small><strong>{loading ? "—" : inventoryCounts.expiring}</strong></span></button><button className={`data-summary-card ${stockFilter === "expired" ? "active" : ""}`} onClick={() => setStockFilter("expired")}><span className="data-summary-icon red"><ShieldAlert size={17}/></span><span><small>Expired batches</small><strong>{loading ? "—" : inventoryCounts.expired}</strong></span></button><button className={`data-summary-card ${stockFilter === "out" ? "active" : ""}`} onClick={() => setStockFilter("out")}><span className="data-summary-icon gray"><Package size={17}/></span><span><small>Out of stock</small><strong>{loading ? "—" : inventoryCounts.out}</strong></span></button></div>
      <div className="data-card panel"><div className="data-toolbar"><div className="data-search"><Search size={17}/><input placeholder="Search medicine, batch or rack…" value={search} onChange={(event) => setSearch(event.target.value)}/></div><span className="data-current-filter">{stockFilter === "all" ? "All stock states" : `${stockFilter[0].toUpperCase()}${stockFilter.slice(1)} batches`}</span></div>
        <div className="data-table-scroll"><table className="data-table inventory-table"><thead><tr><th>Medicine / batch</th><th>Expiry</th><th>Branch / rack</th><th>Quantity</th><th>MRP</th><th>Stock state</th></tr></thead><tbody>{displayStocks.map((stock) => <tr key={stock.id}><td><strong>{stock.medicine?.name || `Medicine ${stock.medicineId.slice(0, 7)}`}</strong><small>{stock.medicine?.strength || stock.medicine?.genericName || stock.medicine?.unit || "Medicine"} · Batch {stock.batchNumber}</small></td><td><strong>{new Date(stock.expiryDate).toLocaleDateString("en-GB")}</strong><small>{daysUntil(stock.expiryDate) < 0 ? `${Math.abs(daysUntil(stock.expiryDate))} days expired` : `${daysUntil(stock.expiryDate)} days remaining`}</small></td><td>{stock.branch?.name || branches.find((branch) => branch.id === stock.branchId)?.name || "—"}<small>{stock.rackNumber || "No rack assigned"}</small></td><td><strong>{stock.quantity}</strong><small>{stock.unit || "Pcs"}</small></td><td>{bdt(number(stock.mrp))}</td><td><span className={`data-status ${stock.state === "normal" ? "good" : stock.state === "low" ? "warn" : stock.state === "expiring" ? "soon" : "danger"}`}>{stock.state === "normal" ? "In stock" : stock.state === "out" ? "Out of stock" : stock.state === "low" ? "Low stock" : stock.state === "expired" ? "Expired" : "Expiring soon"}</span></td></tr>)}</tbody></table></div>
        {!loading && displayStocks.length === 0 && <div className="data-empty"><Boxes size={22}/><strong>No matching stock batches</strong><span>This branch and filter combination has no records in the current result.</span></div>}
        {loading && <div className="data-loading">Loading stock batches…</div>}
        <p className="data-footnote"><AlertTriangle size={13}/> Low stock is derived from each medicine’s reorder level. Expiry alerts use a 90-day window; stock API filtering does not provide these states.</p>
      </div>
    </>}
    {selectedMedicine && <div className="data-dialog-backdrop" role="presentation" onClick={() => setSelectedMedicine(null)}><div className="data-dialog panel" role="dialog" aria-modal="true" aria-label="Medicine batch details" onClick={(event) => event.stopPropagation()}><button className="data-dialog-close" onClick={() => setSelectedMedicine(null)}>Close</button><p className="eyebrow">MEDICINE DETAILS</p><h2>{selectedMedicine.name}</h2><p>{selectedMedicine.generic?.name || selectedMedicine.genericName || "Generic not set"} · {selectedMedicine.strength || selectedMedicine.dosageForm || "No strength/form"}</p><div className="data-dialog-batches"><h3>Branch batches</h3>{(selectedMedicine.stocks ?? []).filter((stock) => stock.branchId === branchId).length ? (selectedMedicine.stocks ?? []).filter((stock) => stock.branchId === branchId).map((stock) => <div key={stock.id}><span><strong>Batch {stock.batchNumber}</strong><small>Expires {new Date(stock.expiryDate).toLocaleDateString("en-GB")}</small></span><span><strong>{stock.quantity} {stock.unit}</strong><small>{bdt(number(stock.mrp))} MRP · {stock.rackNumber || "No rack"}</small></span></div>) : <div className="data-dialog-empty">No batch records for this branch.</div>}</div></div></div>}
  </section>;
}
