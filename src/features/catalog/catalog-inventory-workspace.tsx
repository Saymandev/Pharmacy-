"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeftRight, ArrowUpDown, Boxes, CalendarClock, Check, ChevronRight, CircleAlert, Filter, Package, Plus, Search, ShieldAlert, X } from "lucide-react";
import { api, ApiClientError } from "@/lib/api/client";
import { useAuth } from "@/components/providers/auth-provider";
import { useLanguage } from "@/lib/i18n/language-provider";

type Data = Record<string, unknown>;
type Branch = { id: string; name: string };
  type Stock = { id: string; sku?: string; unitPrice?: number; medicineId: string; branchId: string; batchNumber: string; expiryDate: string; quantity: number; mrp: number; unit: string; rackNumber?: string | null; medicine?: Medicine; branch?: Branch };
type Medicine = { id: string; name: string; nameBangla?: string; genericName?: string; genericNameBangla?: string; barcode?: string; dosageForm?: string; strength?: string; unit?: string; purchasePrice?: number; salePrice?: number; mrp?: number; reorderLevel?: number; isActive: boolean; category?: { id: string; name: string }; generic?: { id: string; name: string }; medicineManufacturer?: { id: string; name: string }; stocks?: Stock[] };
type Option = { id: string; name: string };
type Mode = "catalog" | "inventory";
type InventoryFilter = "all" | "low" | "expiring" | "expired" | "out";
type StockAction = "opening" | "adjust" | "transfer";

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
  const { hasPermission } = useAuth();
  const { t } = useLanguage();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [generics, setGenerics] = useState<Option[]>([]);
  const [manufacturers, setManufacturers] = useState<Option[]>([]);
  const [groups, setGroups] = useState<Option[]>([]);
  const [units, setUnits] = useState<Option[]>([]);
  const [accounts, setAccounts] = useState<Option[]>([]);
  const [medicineDialog, setMedicineDialog] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<string | null>(null);
  const [savingMedicine, setSavingMedicine] = useState(false);
  const [importingMedicines, setImportingMedicines] = useState(false);
  const [medicineForm, setMedicineForm] = useState({ name: "", nameBangla: "", genericName: "", genericNameBangla: "", barcode: "", unit: "Pcs", categoryId: "", genericId: "", groupId: "", medicineManufacturerId: "", medicineUnitId: "", purchasePrice: "0", salePrice: "0", dosageForm: "", strength: "", mrp: "0", reorderLevel: "10", isActive: true });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageInfo, setPageInfo] = useState({ total: 0, totalPages: 1 });
  const [categoryId, setCategoryId] = useState("");
  const [genericId, setGenericId] = useState("");
  const [manufacturerId, setManufacturerId] = useState("");
  const [medicineStatus, setMedicineStatus] = useState("");
  const [inventoryManufacturerId, setInventoryManufacturerId] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [rackNumber, setRackNumber] = useState("");
  const [expiryStartDate, setExpiryStartDate] = useState("");
  const [expiryEndDate, setExpiryEndDate] = useState("");
  const [stockFilter, setStockFilter] = useState<InventoryFilter>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);
  const [stockAction, setStockAction] = useState<StockAction | null>(null);
  const [priceDialog, setPriceDialog] = useState(false);
  const [priceDraft, setPriceDraft] = useState<Record<string, { unitPrice: string; mrp: string }>>({});
  const [actionStock, setActionStock] = useState<Stock | null>(null);
  const [savingStock, setSavingStock] = useState(false);
  const [stockForm, setStockForm] = useState({ stockId: "", medicineId: "", toBranchId: "", quantity: "1", type: "increase", note: "", batchNumber: "", expiryDate: "", unitPrice: "", mrp: "", unit: "Pcs", rackNumber: "", recoverAmount: "", accountId: "" });

  useEffect(() => {
    if (mode !== "inventory" || !hasPermission("account:read")) return;
    let active = true;
    void api.get<unknown>("/finance/accounts?page=1&limit=100&isActive=true").then((result) => {
      if (active) setAccounts(list<Option>(result));
    }).catch(() => {
      if (active) setAccounts([]);
    });
    return () => { active = false; };
  }, [hasPermission, mode]);

  useEffect(() => {
    let active = true;
    async function loadOptions() {
      const results = await Promise.allSettled([
        api.get<unknown>("/branches?page=1&limit=100"),
        api.get<unknown>("/pharmacy/categories?page=1&limit=100"),
        api.get<unknown>("/pharmacy/generics?page=1&limit=100"),
        api.get<unknown>("/pharmacy/manufacturers?page=1&limit=100"),
        api.get<unknown>("/pharmacy/groups?page=1&limit=100"),
        api.get<unknown>("/pharmacy/units?page=1&limit=100"),
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
      if (results[4].status === "fulfilled") setGroups(list<Option>(results[4].value));
      if (results[5].status === "fulfilled") setUnits(list<Option>(results[5].value));
      if (results[0].status === "rejected") setError(err(results[0].reason));
    }
    void loadOptions();
    return () => { active = false; };
  }, []);

  const load = useCallback(async () => {
    if (!branchId) { setLoading(false); return; }
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "25" });
    if (search.trim()) params.set("search", search.trim());
    if (mode === "catalog") {
      if (categoryId) params.set("categoryId", categoryId);
      if (genericId) params.set("genericId", genericId);
      if (manufacturerId) params.set("medicineManufacturerId", manufacturerId);
      if (medicineStatus) params.set("isActive", medicineStatus);
    }
    if (mode === "inventory") {
      params.set("branchId", branchId);
      if (batchNumber.trim()) params.set("batchNumber", batchNumber.trim());
      if (rackNumber.trim()) params.set("rackNumber", rackNumber.trim());
      if (expiryStartDate) params.set("expiryStartDate", expiryStartDate);
      if (expiryEndDate) params.set("expiryEndDate", expiryEndDate);
      if (inventoryManufacturerId) params.set("medicineManufacturerId", inventoryManufacturerId);
    }
    try {
      if (mode === "catalog") {
        const result = await api.getWithMeta<unknown>(`/pharmacy/medicines?${params.toString()}`);
        const medicineRows = list<Medicine>(result);
        setMedicines(medicineRows);
        const meta = result && typeof result === "object" ? (result as Data).meta as Data | undefined : undefined;
        const total = Math.max(number(meta?.totalItems), medicineRows.length);
        setPageInfo({ total, totalPages: Math.max(1, number(meta?.totalPages) || Math.ceil(total / 25) || 1) });
      } else {
        const [result, medicineResult] = await Promise.all([
          api.getWithMeta<unknown>(`/pharmacy/stocks?${params.toString()}`),
          api.get<unknown>(`/pharmacy/medicines?page=1&limit=100&branchId=${encodeURIComponent(branchId)}`),
        ]);
        const medicineRows = list<Medicine>(medicineResult);
        const stockRows = list<Stock>(result);
        const medicineById = new Map(medicineRows.map((medicine) => [medicine.id, medicine]));
        setStocks(stockRows.map((stock) => {
          const medicine = medicineById.get(stock.medicineId);
          return medicine ? { ...stock, medicine: { ...stock.medicine, ...medicine } } : stock;
        }));
        setMedicines(medicineRows);
        const meta = result && typeof result === "object" ? (result as Data).meta as Data | undefined : undefined;
        const total = Math.max(number(meta?.totalItems), stockRows.length);
        setPageInfo({ total, totalPages: Math.max(1, number(meta?.totalPages) || Math.ceil(total / 25) || 1) });
      }
      setError("");
    } catch (cause) { setError(err(cause)); }
    finally { setLoading(false); }
  }, [batchNumber, branchId, categoryId, expiryEndDate, expiryStartDate, genericId, inventoryManufacturerId, manufacturerId, medicineStatus, mode, page, rackNumber, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 180);
    return () => window.clearTimeout(timer);
  }, [load]);

  const enrichedStocks = useMemo(() => stocks.map((stock) => {
    const threshold = stock.medicine?.reorderLevel;
    const state = number(stock.quantity) === 0 ? "out" : daysUntil(stock.expiryDate) < 0 ? "expired" : daysUntil(stock.expiryDate) <= 90 ? "expiring" : threshold === undefined ? "unknown" : number(stock.quantity) <= number(threshold) ? "low" : "normal";
    return { ...stock, state };
  }), [stocks]);
  const displayStocks = useMemo(() => enrichedStocks.filter((stock) => stockFilter === "all" || stock.state === stockFilter), [enrichedStocks, stockFilter]);
  const inventoryCounts = useMemo(() => ({
    total: stocks.length,
    low: enrichedStocks.filter((stock) => stock.state === "low").length,
    expiring: enrichedStocks.filter((stock) => stock.state === "expiring").length,
    expired: enrichedStocks.filter((stock) => stock.state === "expired").length,
    out: enrichedStocks.filter((stock) => stock.state === "out").length,
  }), [enrichedStocks, stocks.length]);



  function openMedicine(item?: Medicine) {
    setError(""); setEditingMedicine(item?.id ?? null);
    setMedicineForm({ name: item?.name || "", nameBangla: item?.nameBangla || "", genericName: item?.genericName || item?.generic?.name || "", genericNameBangla: item?.genericNameBangla || "", barcode: item?.barcode || "", unit: item?.unit || "Pcs", categoryId: item?.category?.id || "", genericId: item?.generic?.id || "", groupId: "", medicineManufacturerId: item?.medicineManufacturer?.id || "", medicineUnitId: "", purchasePrice: String(item?.purchasePrice ?? 0), salePrice: String(item?.salePrice ?? 0), dosageForm: item?.dosageForm || "", strength: item?.strength || "", mrp: String(item?.mrp ?? 0), reorderLevel: String(item?.reorderLevel ?? 10), isActive: item?.isActive ?? true });
    setMedicineDialog(true);
  }
  async function importMedicines(file: File | undefined) { if (!file) return; const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase(); if (![".csv", ".xls", ".xlsx"].includes(extension)) { setError(t("Upload a CSV, XLS or XLSX file.")); return; } if (file.size > 10 * 1024 * 1024) { setError(t("The import file must be 10 MB or smaller.")); return; } setImportingMedicines(true); setError(""); try { const form = new FormData(); form.append("file", file); await api.upload("/pharmacy/medicines/import", form); await load(); setNotice(t("Medicine import finished.")); } catch (cause) { setError(err(cause)); } finally { setImportingMedicines(false); } }
  async function saveMedicine() {
    if (!medicineForm.name.trim() || !medicineForm.genericName.trim()) { setError("Medicine name and generic name are required."); return; }
    if (!editingMedicine && !medicineForm.categoryId) { setError("Choose a medicine category before saving."); return; }
    setSavingMedicine(true); setError("");
    const payload = { ...medicineForm, name: medicineForm.name.trim(), genericName: medicineForm.genericName.trim(), unit: medicineForm.unit.trim() || "Pcs", categoryId: medicineForm.categoryId || undefined, genericId: medicineForm.genericId || undefined, groupId: medicineForm.groupId || undefined, medicineManufacturerId: medicineForm.medicineManufacturerId || undefined, medicineUnitId: medicineForm.medicineUnitId || undefined, purchasePrice: Number(medicineForm.purchasePrice), salePrice: Number(medicineForm.salePrice), mrp: Number(medicineForm.mrp), reorderLevel: Number(medicineForm.reorderLevel), nameBangla: medicineForm.nameBangla || undefined, genericNameBangla: medicineForm.genericNameBangla || undefined, barcode: medicineForm.barcode || undefined, dosageForm: medicineForm.dosageForm || undefined, strength: medicineForm.strength || undefined };
    try { if (editingMedicine) await api.patch(`/pharmacy/medicines/${editingMedicine}`, payload); else await api.post("/pharmacy/medicines", payload); setMedicineDialog(false); await load(); setNotice(editingMedicine ? "Medicine details updated." : "Medicine added to the catalog."); }
    catch (cause) { setError(err(cause)); } finally { setSavingMedicine(false); }
  }

  function openStockAction(action: StockAction, stock?: Stock) {
    setError(""); setActionStock(stock ?? null); setStockAction(action);
    setStockForm({ stockId: stock?.id || "", medicineId: medicines[0]?.id || "", toBranchId: branches.find((branch) => branch.id !== branchId)?.id || "", quantity: "1", type: "increase", note: "", batchNumber: "", expiryDate: "", unitPrice: "", mrp: "", unit: stock?.unit || "Pcs", rackNumber: stock?.rackNumber || "", recoverAmount: "", accountId: "" });
  }
  function openPriceDialog() { setError(""); setPriceDraft(Object.fromEntries(stocks.filter(s=>s.sku).map(s=>[s.id,{unitPrice:String(s.unitPrice??0),mrp:String(s.mrp??0)}]))); setPriceDialog(true); }
  async function saveBulkPrices() { const changed=stocks.filter(s=>s.sku&&priceDraft[s.id]&&(Number(priceDraft[s.id].unitPrice)!==Number(s.unitPrice)||Number(priceDraft[s.id].mrp)!==Number(s.mrp))); if(!changed.length){setError("Change at least one batch price before saving.");return;} if(changed.some(s=>Number(priceDraft[s.id].unitPrice)<=0||Number(priceDraft[s.id].mrp)<=0)){setError("Unit price and MRP must be greater than zero.");return;}setSavingStock(true);setError("");try{await api.patch("/pharmacy/stocks/bulk-price-update",changed.map(s=>({medicineId:s.medicineId,sku:s.sku,unitPrice:Number(priceDraft[s.id].unitPrice),mrp:Number(priceDraft[s.id].mrp)})));setPriceDialog(false);await load();setNotice(`${changed.length} batch price${changed.length===1?"":"s"} updated.`);}catch(cause){setError(err(cause));}finally{setSavingStock(false);}}
  async function saveStockAction() {
    if (!stockAction) return;
    setSavingStock(true); setError("");
    try {
      if (stockAction === "opening") {
        if (!stockForm.medicineId || !stockForm.batchNumber.trim() || !stockForm.expiryDate || !Number.isInteger(Number(stockForm.quantity)) || Number(stockForm.quantity) <= 0 || Number(stockForm.unitPrice) <= 0 || Number(stockForm.mrp) <= 0) { setError(t("Choose medicine, batch and expiry date, then enter positive quantity and prices.")); return; }
        await api.post("/pharmacy/stocks/opening", { medicineId: stockForm.medicineId, branchId, batchNumber: stockForm.batchNumber.trim(), expiryDate: new Date(`${stockForm.expiryDate}T23:59:59.999+06:00`).toISOString(), quantity: Number(stockForm.quantity), unitPrice: Number(stockForm.unitPrice), mrp: Number(stockForm.mrp), unit: stockForm.unit || undefined, rackNumber: stockForm.rackNumber || undefined, note: stockForm.note || undefined });
      } else if (stockAction === "adjust") {
        const stockId = actionStock?.id || stockForm.stockId;
        if (!stockId || !Number.isInteger(Number(stockForm.quantity)) || Number(stockForm.quantity) <= 0) { setError(t("Select a batch and enter a positive whole-number quantity.")); return; }
        const recovery = Number(stockForm.recoverAmount);
        if (!Number.isFinite(recovery) || recovery < 0) { setError(t("Enter a valid recovery amount.")); return; }
        if (recovery > 0 && (!stockForm.accountId || stockForm.type !== "decrease")) { setError(t("Choose an account for a recovery amount, and use this only for a decrease.")); return; }
        await api.post("/pharmacy/stocks/adjust", { stockId, quantity: Number(stockForm.quantity), type: stockForm.type, note: stockForm.note || undefined, ...(recovery > 0 ? { recoverAmount: recovery, accountId: stockForm.accountId } : {}) });
      } else {
        const stockId = actionStock?.id || stockForm.stockId;
        if (!stockId || !stockForm.toBranchId || !Number.isInteger(Number(stockForm.quantity)) || Number(stockForm.quantity) <= 0) { setError(t("Choose a batch, destination branch and positive transfer quantity.")); return; }
        await api.post("/pharmacy/stocks/transfer", { stockId, toBranchId: stockForm.toBranchId, quantity: Number(stockForm.quantity), note: stockForm.note || undefined });
      }
      setStockAction(null); await load(); setNotice(t("Stock operation completed."));
    } catch (cause) { setError(err(cause)); } finally { setSavingStock(false); }
  }

  const title = t(mode === "catalog" ? "Medicine catalog" : "Inventory & batches");
  const subtitle = t(mode === "catalog" ? "Browse medicines, variants and current branch stock." : "Track batch quantities, expiry dates and shelf locations.");
  const activeCount = medicines.filter((item) => item.isActive).length;
  const medicineTotalStock = (medicine: Medicine) => (medicine.stocks ?? []).filter((stock) => stock.branchId === branchId).reduce((sum, stock) => sum + number(stock.quantity), 0);
  const medicineStockValue = (medicine: Medicine) => (medicine.stocks ?? []).filter((stock) => stock.branchId === branchId).reduce((sum, stock) => sum + number(stock.quantity) * number(stock.mrp), 0);
  const pagination = <div className="data-pagination"><span>{t("Showing page")} {page} {t("of")} {pageInfo.totalPages} · {pageInfo.total.toLocaleString("en-BD")} {t("records")}</span><div><button type="button" disabled={loading || page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>{t("Previous")}</button><button type="button" disabled={loading || page >= pageInfo.totalPages} onClick={() => setPage((current) => Math.min(pageInfo.totalPages, current + 1))}>{t("Next")}</button></div></div>;

  return <section className="data-page">
    <div className="page-heading-row"><div><p className="eyebrow">{t("PHARMACY")} · {t(mode === "catalog" ? "PRODUCTS" : "STOCK CONTROL")}</p><h1>{title}</h1><p className="page-subtitle">{subtitle}</p></div><div className="inventory-heading-actions">{mode === "catalog"&&<>{hasPermission("medicine:create")&&<label className="purchase-save-pending catalog-import-button">{importingMedicines?t("Importing…"):t("Import file")}<input type="file" accept=".csv,.xls,.xlsx" disabled={importingMedicines} onChange={event=>{void importMedicines(event.target.files?.[0]);event.currentTarget.value="";}}/></label>}{hasPermission("medicine:create")&&<button className="purchase-primary-action" onClick={()=>openMedicine()}><Plus size={14}/>{t("Add medicine")}</button>}</>}{mode === "inventory"&&<>{hasPermission("stock:update")&&<button className="purchase-save-pending" onClick={()=>openStockAction("adjust")}><ArrowUpDown size={14}/>{t("Adjust stock")}</button>}{hasPermission("stock:update")&&<button className="purchase-save-pending" onClick={()=>openStockAction("transfer")}><ArrowLeftRight size={14}/>{t("Transfer")}</button>}{hasPermission("medicine:update")&&<button className="purchase-save-pending" onClick={openPriceDialog}>{t("Bulk price")}</button>}{hasPermission("stock:create")&&<button className="purchase-primary-action" onClick={()=>openStockAction("opening")}><Plus size={14}/>{t("Opening stock")}</button>}</>}<label className="data-branch-select"><span>{t("Branch")}</span><select value={branchId} onChange={(event) => { setPage(1); setBranchId(event.target.value); }}><option value="">{t("Select branch")}</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label></div></div>
    {error && <div className="data-alert"><CircleAlert size={16}/><span>{error}</span><button onClick={() => void load()}>Retry</button></div>}
    {notice && <div className="sales-alert success"><Check size={15}/><span>{notice}</span><button onClick={()=>setNotice("")} aria-label="Dismiss"><X size={14}/></button></div>}
    <nav className="data-tabs" aria-label={t("Pharmacy inventory sections")}><Link href="/catalog" className={mode === "catalog" ? "selected" : ""}><Package size={15}/> {t("Catalog")}</Link><Link href="/inventory" className={mode === "inventory" ? "selected" : ""}><Boxes size={15}/> {t("Inventory")}</Link></nav>
    {mode === "catalog" ? <>
      <div className="data-summary-row"><div className="data-summary-card"><span className="data-summary-icon mint"><Package size={17}/></span><span><small>{t("Medicines on this page")}</small><strong>{loading ? "—" : medicines.length}</strong></span></div><div className="data-summary-card"><span className="data-summary-icon blue"><Boxes size={17}/></span><span><small>{t("Active records on this page")}</small><strong>{loading ? "—" : activeCount}</strong></span></div><div className="data-summary-card"><span className="data-summary-icon amber"><AlertTriangle size={17}/></span><span><small>{t("Low / no stock on this page")}</small><strong>{loading ? "—" : medicines.filter((item) => medicineTotalStock(item) <= number(item.reorderLevel ?? 10)).length}</strong></span></div></div>
      <div className="data-card panel"><div className="data-toolbar"><div className="data-search"><Search size={17}/><input placeholder={t("Search medicine, generic, barcode…")} value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }}/></div><button className={`data-filter-button ${filtersOpen ? "selected" : ""}`} onClick={() => setFiltersOpen(!filtersOpen)}><Filter size={15}/> {t("Filters")}</button></div>
        {filtersOpen && <div className="data-filter-drawer"><label><span>{t("Category")}</span><select value={categoryId} onChange={(event) => { setPage(1); setCategoryId(event.target.value); }}><option value="">{t("All categories")}</option>{categories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label><span>{t("Generic")}</span><select value={genericId} onChange={(event) => { setPage(1); setGenericId(event.target.value); }}><option value="">{t("All generics")}</option>{generics.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label><span>{t("Manufacturer")}</span><select value={manufacturerId} onChange={(event) => { setPage(1); setManufacturerId(event.target.value); }}><option value="">{t("All manufacturers")}</option>{manufacturers.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label><span>{t("Availability status")}</span><select value={medicineStatus} onChange={(event) => { setPage(1); setMedicineStatus(event.target.value); }}><option value="">{t("All statuses")}</option><option value="true">{t("Active")}</option><option value="false">{t("Inactive")}</option></select></label><button onClick={() => { setPage(1); setCategoryId(""); setGenericId(""); setManufacturerId(""); setMedicineStatus(""); }}>{t("Clear filters")}</button></div>}
        <div className="data-table-scroll"><table className="data-table"><thead><tr><th>{t("Medicine")}</th><th>{t("Category / generic")}</th><th>{t("Branch stock")}</th><th>{t("Sale price")}</th><th>{t("Stock value · MRP")}</th><th>{t("Status")}</th><th></th></tr></thead><tbody>{medicines.map((medicine) => { const quantity = medicineTotalStock(medicine); return <tr key={medicine.id}><td><strong>{medicine.name}</strong><small>{[medicine.strength, medicine.dosageForm, medicine.barcode ? `#${medicine.barcode}` : ""].filter(Boolean).join(" · ")}</small></td><td data-label={t("Category / generic")}><span>{medicine.category?.name || t("Uncategorized")}</span><small>{medicine.generic?.name || medicine.genericName || "—"}</small></td><td data-label={t("Branch stock")}><strong>{quantity}</strong><small>{medicine.unit || "Pcs"} · {t("reorder at")} {medicine.reorderLevel ?? 10}</small></td><td data-label={t("Sale price")}>{bdt(number(medicine.salePrice) || number(medicine.mrp))}</td><td data-label={t("Stock value · MRP")}>{bdt(medicineStockValue(medicine))}</td><td data-label={t("Status")}><span className={`data-status ${medicine.isActive ? quantity > number(medicine.reorderLevel ?? 10) ? "good" : "warn" : "muted"}`}>{!medicine.isActive ? t("Inactive") : quantity === 0 ? t("Out of stock") : quantity <= number(medicine.reorderLevel ?? 10) ? t("Low stock") : t("Active")}</span></td><td><div className="hr-row-actions">{hasPermission("medicine:update")&&<button onClick={()=>openMedicine(medicine)} aria-label={`${t("Edit")} ${medicine.name}`}>{t("Edit")}</button>}{hasPermission("stock:read")&&<button className="data-row-action" onClick={() => setSelectedMedicine(medicine)} aria-label={`${t("View batches for")} ${medicine.name}`}><ChevronRight size={16}/></button>}</div></td></tr>; })}</tbody></table></div>
        {!loading && medicines.length === 0 && <div className="data-empty"><Package size={22}/><strong>{t("No medicines found")}</strong><span>{t("Adjust the search or filters to see matching catalog records.")}</span></div>}
        {loading && <div className="data-loading">{t("Loading medicine catalog…")}</div>}
        {pageInfo.totalPages > 1 && pagination}
      </div>
    </> : <>
      <div className="data-summary-row data-summary-row-five"><button className={`data-summary-card ${stockFilter === "all" ? "active" : ""}`} onClick={() => setStockFilter("all")}><span className="data-summary-icon mint"><Boxes size={17}/></span><span><small>{t("All batches")}</small><strong>{loading ? "—" : pageInfo.total}</strong></span></button><button className={`data-summary-card ${stockFilter === "low" ? "active" : ""}`} onClick={() => setStockFilter("low")}><span className="data-summary-icon amber"><AlertTriangle size={17}/></span><span><small>{t("Low stock on this page")}</small><strong>{loading ? "—" : inventoryCounts.low}</strong></span></button><button className={`data-summary-card ${stockFilter === "expiring" ? "active" : ""}`} onClick={() => setStockFilter("expiring")}><span className="data-summary-icon yellow"><CalendarClock size={17}/></span><span><small>{t("Expiring ≤90d on this page")}</small><strong>{loading ? "—" : inventoryCounts.expiring}</strong></span></button><button className={`data-summary-card ${stockFilter === "expired" ? "active" : ""}`} onClick={() => setStockFilter("expired")}><span className="data-summary-icon red"><ShieldAlert size={17}/></span><span><small>{t("Expired batches on this page")}</small><strong>{loading ? "—" : inventoryCounts.expired}</strong></span></button><button className={`data-summary-card ${stockFilter === "out" ? "active" : ""}`} onClick={() => setStockFilter("out")}><span className="data-summary-icon gray"><Package size={17}/></span><span><small>{t("Out of stock on this page")}</small><strong>{loading ? "—" : inventoryCounts.out}</strong></span></button></div>
      <div className="data-card panel"><div className="data-toolbar"><div className="data-search"><Search size={17}/><input placeholder={t("Search medicine, batch or rack…")} value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }}/></div><button className="data-filter-button" onClick={() => setFiltersOpen(!filtersOpen)}><Filter size={15}/> {t("Filters")}</button><span className="data-current-filter">{t(stockFilter === "all" ? "All stock states" : stockFilter === "low" ? "Low stock" : stockFilter === "expiring" ? "Expiring soon" : stockFilter === "expired" ? "Expired" : "Out of stock")}</span></div>
        {filtersOpen && <div className="data-filter-drawer"><label><span>{t("Manufacturer")}</span><select value={inventoryManufacturerId} onChange={event=>{setPage(1);setInventoryManufacturerId(event.target.value);}}><option value="">{t("All manufacturers")}</option>{manufacturers.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span>{t("Batch number")}</span><input value={batchNumber} onChange={event=>{setPage(1);setBatchNumber(event.target.value);}} placeholder={t("Exact batch number")}/></label><label><span>{t("Rack number")}</span><input value={rackNumber} onChange={event=>{setPage(1);setRackNumber(event.target.value);}} placeholder={t("Exact rack number")}/></label><label><span>{t("Expiry from")}</span><input type="date" value={expiryStartDate} onChange={event=>{setPage(1);setExpiryStartDate(event.target.value);}}/></label><label><span>{t("Expiry to")}</span><input type="date" value={expiryEndDate} onChange={event=>{setPage(1);setExpiryEndDate(event.target.value);}}/></label><button onClick={()=>{setPage(1);setInventoryManufacturerId("");setBatchNumber("");setRackNumber("");setExpiryStartDate("");setExpiryEndDate("");setSearch("");}}>{t("Clear filters")}</button></div>}<div className="data-table-scroll"><table className="data-table inventory-table"><thead><tr><th>{t("Medicine / batch")}</th><th>{t("Expiry")}</th><th>{t("Branch / rack")}</th><th>{t("Quantity")}</th><th>{t("MRP")}</th><th>{t("Stock state")}</th></tr></thead><tbody>{displayStocks.map((stock) => <tr key={stock.id}><td><strong>{stock.medicine?.name || `${t("Medicine")} ${stock.medicineId.slice(0, 7)}`}</strong><small>{stock.medicine?.strength || stock.medicine?.genericName || stock.medicine?.unit || t("Medicine")} · {t("Batch")} {stock.batchNumber}</small></td><td data-label={t("Expiry")}><strong>{new Date(stock.expiryDate).toLocaleDateString("en-GB")}</strong><small>{daysUntil(stock.expiryDate) < 0 ? `${Math.abs(daysUntil(stock.expiryDate))} ${t("days expired")}` : `${daysUntil(stock.expiryDate)} ${t("days remaining")}`}</small></td><td data-label={t("Branch / rack")}>{stock.branch?.name || branches.find((branch) => branch.id === stock.branchId)?.name || "—"}<small>{stock.rackNumber || t("No rack assigned")}</small></td><td data-label={t("Quantity")}><strong>{stock.quantity}</strong><small>{stock.unit || "Pcs"}</small></td><td data-label={t("MRP")}>{bdt(number(stock.mrp))}</td><td data-label={t("Stock state")}><span className={`data-status ${stock.state === "normal" ? "good" : stock.state === "low" ? "warn" : stock.state === "expiring" ? "soon" : stock.state === "unknown" ? "muted" : "danger"}`}>{t(stock.state === "normal" ? "In stock" : stock.state === "out" ? "Out of stock" : stock.state === "low" ? "Low stock" : stock.state === "expired" ? "Expired" : stock.state === "unknown" ? "Threshold unavailable" : "Expiring soon")}</span></td></tr>)}</tbody></table></div>
        {!loading && displayStocks.length === 0 && <div className="data-empty"><Boxes size={22}/><strong>{t("No matching stock batches")}</strong><span>{t("This branch and filter combination has no records in the current result.")}</span></div>}
        {loading && <div className="data-loading">{t("Loading stock batches…")}</div>}
        {pageInfo.totalPages > 1 && pagination}
        <p className="data-footnote"><AlertTriangle size={13}/> {t("Counts are for the current page. Low stock is calculated only when the medicine reorder level is available; expiry alerts use a 90-day window.")}</p>
      </div>
    </>}



    {priceDialog&&<div className="sales-backdrop" role="presentation" onClick={()=>setPriceDialog(false)}><div className="supplier-dialog panel hr-dialog bulk-price-dialog" role="dialog" aria-modal="true" aria-label={t("Bulk batch price update")} onClick={event=>event.stopPropagation()}><button className="purchase-close" onClick={()=>setPriceDialog(false)} aria-label={t("Close")}><X size={18}/></button><p className="eyebrow">{t("INVENTORY")} · {t("BATCH PRICES")}</p><h2>{t("Bulk price update")}</h2><p>{t("Edit unit cost and MRP for batches on the current inventory page. Only changed rows will be saved.")}</p><div className="bulk-price-list">{stocks.filter(s=>s.sku).map(stock=><div key={stock.id}><div><strong>{stock.medicine?.name||stock.medicineId}</strong><small>{t("Batch")} {stock.batchNumber} · {stock.quantity} {stock.unit}</small></div><label>{t("Unit cost")}<input type="number" min="0.01" step="0.01" value={priceDraft[stock.id]?.unitPrice||""} onChange={e=>setPriceDraft({...priceDraft,[stock.id]:{...priceDraft[stock.id],unitPrice:e.target.value}})}/></label><label>{t("MRP")}<input type="number" min="0.01" step="0.01" value={priceDraft[stock.id]?.mrp||""} onChange={e=>setPriceDraft({...priceDraft,[stock.id]:{...priceDraft[stock.id],mrp:e.target.value}})}/></label></div>)}{!stocks.some(s=>s.sku)&&<div className="data-empty"><Boxes size={20}/><strong>{t("No editable batch prices found")}</strong><span>{t("Refresh stock after the branch inventory loads.")}</span></div>}</div><button className="purchase-primary-action full" disabled={savingStock||!hasPermission("medicine:update")} onClick={()=>void saveBulkPrices()}>{savingStock?t("Saving…"):t("Save changed prices")}</button></div></div>}
    {medicineDialog&&<div className="sales-backdrop" role="presentation" onClick={()=>setMedicineDialog(false)}><div className="supplier-dialog panel hr-dialog medicine-form-dialog" role="dialog" aria-modal="true" aria-label={t(editingMedicine?"Edit medicine":"Add medicine")} onClick={event=>event.stopPropagation()}><button className="purchase-close" onClick={()=>setMedicineDialog(false)} aria-label={t("Close")}><X size={18}/></button><p className="eyebrow">{t("PHARMACY")} · {t("MEDICINE CATALOG")}</p><h2>{t(editingMedicine?"Edit medicine":"Add medicine")}</h2><p>{t("Set the product identity, classification and default pricing used by purchasing and POS.")}</p><label>{t("Medicine name")}<input value={medicineForm.name} onChange={e=>setMedicineForm({...medicineForm,name:e.target.value})}/></label><label>{t("Bangla name")} <span className="form-optional">{t("Optional")}</span><input value={medicineForm.nameBangla} onChange={e=>setMedicineForm({...medicineForm,nameBangla:e.target.value})}/></label><div className="customer-form-grid"><label>{t("Generic name")}<input value={medicineForm.genericName} onChange={e=>setMedicineForm({...medicineForm,genericName:e.target.value})}/></label><label>{t("Barcode")}<input value={medicineForm.barcode} onChange={e=>setMedicineForm({...medicineForm,barcode:e.target.value})}/></label></div><label>{t("Generic name (Bangla)")} <span className="form-optional">{t("Optional")}</span><input value={medicineForm.genericNameBangla} onChange={e=>setMedicineForm({...medicineForm,genericNameBangla:e.target.value})}/></label><div className="customer-form-grid"><label>{t("Category")}<select value={medicineForm.categoryId} onChange={e=>setMedicineForm({...medicineForm,categoryId:e.target.value})}><option value="">{t("Choose category")}</option>{categories.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>{t("Generic")}<select value={medicineForm.genericId} onChange={e=>setMedicineForm({...medicineForm,genericId:e.target.value})}><option value="">{t("Choose generic")}</option>{generics.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label></div><div className="customer-form-grid"><label>{t("Manufacturer")}<select value={medicineForm.medicineManufacturerId} onChange={e=>setMedicineForm({...medicineForm,medicineManufacturerId:e.target.value})}><option value="">{t("Choose manufacturer")}</option>{manufacturers.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>{t("Group")}<select value={medicineForm.groupId} onChange={e=>setMedicineForm({...medicineForm,groupId:e.target.value})}><option value="">{t("Choose group")}</option>{groups.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label></div><div className="customer-form-grid"><label>{t("Strength")}<input value={medicineForm.strength} onChange={e=>setMedicineForm({...medicineForm,strength:e.target.value})}/></label><label>{t("Dosage form")}<input value={medicineForm.dosageForm} onChange={e=>setMedicineForm({...medicineForm,dosageForm:e.target.value})} placeholder={t("e.g. Tablet, syrup")}/></label></div><div className="customer-form-grid"><label>{t("Unit")}<select value={medicineForm.medicineUnitId} onChange={e=>{const id=e.target.value;const chosen=units.find(x=>x.id===id);setMedicineForm({...medicineForm,medicineUnitId:id,unit:chosen?.name||medicineForm.unit});}}><option value="">{medicineForm.unit||t("Select unit")}</option>{units.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>{t("Reorder level")}<input type="number" min="0" value={medicineForm.reorderLevel} onChange={e=>setMedicineForm({...medicineForm,reorderLevel:e.target.value})}/></label></div><div className="customer-form-grid"><label>{t("Purchase price")}<input type="number" min="0" step="0.01" value={medicineForm.purchasePrice} onChange={e=>setMedicineForm({...medicineForm,purchasePrice:e.target.value})}/></label><label>{t("Sale price")}<input type="number" min="0" step="0.01" value={medicineForm.salePrice} onChange={e=>setMedicineForm({...medicineForm,salePrice:e.target.value})}/></label></div><label>{t("MRP")}<input type="number" min="0" step="0.01" value={medicineForm.mrp} onChange={e=>setMedicineForm({...medicineForm,mrp:e.target.value})}/></label>{editingMedicine&&<label className="hr-paid-control">{t("Available for sale")}<input type="checkbox" checked={medicineForm.isActive} onChange={e=>setMedicineForm({...medicineForm,isActive:e.target.checked})}/></label>}<button className="purchase-primary-action full" disabled={savingMedicine||!hasPermission(editingMedicine?"medicine:update":"medicine:create")} onClick={()=>void saveMedicine()}>{savingMedicine?t("Saving…"):editingMedicine?t("Save changes"):t("Add medicine")}</button></div></div>}
    {stockAction && <div className="sales-backdrop" role="presentation" onClick={()=>setStockAction(null)}><div className="supplier-dialog panel hr-dialog" role="dialog" aria-modal="true" aria-label={t("Stock operation")} onClick={event=>event.stopPropagation()}><button className="purchase-close" onClick={()=>setStockAction(null)} aria-label={t("Close")}><X size={18}/></button><p className="eyebrow">{t("INVENTORY")} · {t(stockAction==="opening"?"OPENING STOCK":stockAction==="adjust"?"ADJUSTMENT":"TRANSFER")}</p><h2>{t(stockAction==="opening"?"Add opening stock":stockAction==="adjust"?"Adjust batch quantity":"Transfer stock")}</h2><p>{t(stockAction==="opening"?"Add an initial batch for the selected branch.":stockAction==="adjust"?"Record a positive quantity correction for a batch.":"Move available batch quantity to another branch.")}</p>
      {stockAction==="opening"?<><label>{t("Medicine")}<select value={stockForm.medicineId} onChange={event=>setStockForm({...stockForm,medicineId:event.target.value})}><option value="">{t("Choose medicine")}</option>{medicines.map(m=><option key={m.id} value={m.id}>{m.name} � {m.strength||m.dosageForm||""}</option>)}</select></label><label>{t("Batch number")}<input value={stockForm.batchNumber} onChange={event=>setStockForm({...stockForm,batchNumber:event.target.value})}/></label><div className="customer-form-grid"><label>{t("Expiry date")}<input type="date" value={stockForm.expiryDate} onChange={event=>setStockForm({...stockForm,expiryDate:event.target.value})}/></label><label>{t("Quantity")}<input type="number" min="1" step="1" value={stockForm.quantity} onChange={event=>setStockForm({...stockForm,quantity:event.target.value})}/></label></div><div className="customer-form-grid"><label>{t("Unit cost")}<input type="number" min="0.01" step="0.01" value={stockForm.unitPrice} onChange={event=>setStockForm({...stockForm,unitPrice:event.target.value})}/></label><label>{t("MRP")}<input type="number" min="0.01" step="0.01" value={stockForm.mrp} onChange={event=>setStockForm({...stockForm,mrp:event.target.value})}/></label></div><div className="customer-form-grid"><label>{t("Unit")}<input value={stockForm.unit} onChange={event=>setStockForm({...stockForm,unit:event.target.value})}/></label><label>{t("Rack / shelf")}<input value={stockForm.rackNumber} onChange={event=>setStockForm({...stockForm,rackNumber:event.target.value})}/></label></div></>:<><label>{t("Batch")}<select value={actionStock?.id||stockForm.stockId} onChange={event=>setStockForm({...stockForm,stockId:event.target.value})}><option value="">{t("Choose batch")}</option>{stocks.map(s=><option key={s.id} value={s.id}>{s.medicine?.name||s.medicineId} � {s.batchNumber} � {s.quantity} {s.unit}</option>)}</select></label>{stockAction==="adjust"&&<label>{t("Adjustment type")}<select value={stockForm.type} onChange={event=>setStockForm({...stockForm,type:event.target.value})}><option value="increase">{t("Increase")}</option><option value="decrease">{t("Decrease")}</option></select></label>}{stockAction==="adjust"&&stockForm.type==="decrease"&&hasPermission("account:read")&&<div className="customer-form-grid"><label>{t("Recovery amount")} <span className="form-optional">{t("Optional")}</span><input type="number" min="0" step="0.01" value={stockForm.recoverAmount} onChange={event=>setStockForm({...stockForm,recoverAmount:event.target.value})}/></label><label>{t("Recovery account")}<select value={stockForm.accountId} onChange={event=>setStockForm({...stockForm,accountId:event.target.value})}><option value="">{t("Choose account")}</option>{accounts.map(account=><option key={account.id} value={account.id}>{account.name}</option>)}</select></label></div>}{stockAction==="transfer"&&<label>{t("Destination branch")}<select value={stockForm.toBranchId} onChange={event=>setStockForm({...stockForm,toBranchId:event.target.value})}><option value="">{t("Choose branch")}</option>{branches.filter(b=>b.id!==branchId).map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>}<label>{t("Quantity")}<input type="number" min="1" step="1" value={stockForm.quantity} onChange={event=>setStockForm({...stockForm,quantity:event.target.value})}/></label></>}<label>{t("Note")} <span className="form-optional">{t("Optional")}</span><input maxLength={255} value={stockForm.note} onChange={event=>setStockForm({...stockForm,note:event.target.value})}/></label><button className="purchase-primary-action full" disabled={savingStock||!hasPermission(stockAction==="opening"?"stock:create":"stock:update")} onClick={()=>void saveStockAction()}>{savingStock?t("Saving…"):t("Confirm operation")}</button></div></div>}
    {selectedMedicine && <div className="data-dialog-backdrop" role="presentation" onClick={() => setSelectedMedicine(null)}><div className="data-dialog panel" role="dialog" aria-modal="true" aria-label={t("Medicine batch details")} onClick={(event) => event.stopPropagation()}><button className="data-dialog-close" onClick={() => setSelectedMedicine(null)}>{t("Close")}</button><p className="eyebrow">{t("MEDICINE DETAILS")}</p><h2>{selectedMedicine.name}</h2><p>{selectedMedicine.generic?.name || selectedMedicine.genericName || t("Generic not set")} · {selectedMedicine.strength || selectedMedicine.dosageForm || t("No strength/form")}</p><div className="data-dialog-batches"><h3>{t("Branch batches")}</h3>{(selectedMedicine.stocks ?? []).filter((stock) => stock.branchId === branchId).length ? (selectedMedicine.stocks ?? []).filter((stock) => stock.branchId === branchId).map((stock) => <div key={stock.id}><span><strong>{t("Batch")} {stock.batchNumber}</strong><small>{t("Expires")} {new Date(stock.expiryDate).toLocaleDateString("en-GB")}</small></span><span><strong>{stock.quantity} {stock.unit}</strong><small>{bdt(number(stock.mrp))} {t("MRP")} · {stock.rackNumber || t("No rack assigned")}</small></span></div>) : <div className="data-dialog-empty">{t("No batch records for this branch.")}</div>}</div></div></div>}
  </section>;
}

