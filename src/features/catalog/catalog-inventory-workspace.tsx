"use client";

import { FilterPopover } from "@/components/ui/filter-popover";
import { Select } from "@/components/ui/select";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDismissiblePanel } from "@/lib/use-dismissible-panel";
import Link from "next/link";
import { AlertTriangle, ArrowLeftRight, ArrowUpDown, Boxes, CalendarClock, Check, Pencil, CircleAlert, Filter, Package, Plus, Search, ShieldAlert, X } from "lucide-react";
import { api, ApiClientError } from "@/lib/api/client";
import { useAuth } from "@/components/providers/auth-provider";
import { useLanguage } from "@/lib/i18n/language-provider";
import { useActiveBranch } from "@/components/providers/active-branch-provider";

import { expiryDays, stockFlags, stockOperationError, positivePrice } from "./inventory-policy";
import { readPagination } from "@/lib/api/pagination";
import { StockHistoryPanel } from "./stock-history-panel";

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
function daysUntil(date:string){return expiryDays(date)??0;}

export function CatalogInventoryWorkspace({ mode }: { mode: Mode }) {
  const { hasPermission } = useAuth();
  const { t, language } = useLanguage();
  const expiryLabel=(date:string)=>expiryDays(date)===null?"—":new Date(`${date.slice(0,10)}T12:00:00Z`).toLocaleDateString(language==="bn"?"bn-BD":"en-GB",{timeZone:"Asia/Dhaka"});
  const { branches, activeBranchId: branchId } = useActiveBranch();
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
  const [catalogFilters,setCatalogFilters]=useState<Record<string,string>>({});
  const [inventoryManufacturerId, setInventoryManufacturerId] = useState("");
  const [stockUnit, setStockUnit] = useState("");
  const [stockMedicineId, setStockMedicineId] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [rackNumber, setRackNumber] = useState("");
  const [expiryStartDate, setExpiryStartDate] = useState("");
  const [expiryEndDate, setExpiryEndDate] = useState("");
  const [stockFilter, setStockFilter] = useState<InventoryFilter>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterPanel = useDismissiblePanel(filtersOpen, useCallback(() => setFiltersOpen(false), []));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);
  const [stockAction, setStockAction] = useState<StockAction | null>(null);
  const [priceDialog, setPriceDialog] = useState(false);
  const [priceDraft, setPriceDraft] = useState<Record<string, { unitPrice: string; mrp: string }>>({});
  const operationLock=useRef(false);
  const currentBranch=useRef(branchId);
  useEffect(()=>{currentBranch.current=branchId;},[branchId]);
  const listRequest=useRef(0);
  const [operationBranch,setOperationBranch]=useState("");
  const [openingSearch,setOpeningSearch]=useState("");
  const [openingMedicines,setOpeningMedicines]=useState<Medicine[]>([]);
  const [openingLoading,setOpeningLoading]=useState(false);
  const [savingStock, setSavingStock] = useState(false);
  const [stockForm, setStockForm] = useState({ stockId: "", medicineId: "", toBranchId: "", quantity: "1", type: "increase", note: "", batchNumber: "", expiryDate: "", unitPrice: "", mrp: "", unit: "Pcs", rackNumber: "", recoverAmount: "", accountId: "" });

  const actionStock=stocks.find(stock=>stock.id===stockForm.stockId)??null;
  const canRead=hasPermission(mode==="inventory"?"stock:read":"medicine:read");
  useEffect(()=>{
    if(stockAction!=="opening"||!hasPermission("medicine:read"))return;
    const controller=new AbortController();const timer=window.setTimeout(()=>{
      setOpeningLoading(true);const params=new URLSearchParams({page:"1",limit:"25",isActive:"true"});if(openingSearch.trim())params.set("search",openingSearch.trim());
      void api.get<unknown>(`/pharmacy/medicines?${params}`,{signal:controller.signal}).then(result=>{if(!controller.signal.aborted)setOpeningMedicines(list<Medicine>(result));}).catch(cause=>{if(!controller.signal.aborted){setOpeningMedicines([]);setError(err(cause));}}).finally(()=>{if(!controller.signal.aborted)setOpeningLoading(false);});
    },200);return()=>{window.clearTimeout(timer);controller.abort();};
  },[hasPermission,openingSearch,stockAction]);

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
        api.get<unknown>("/pharmacy/categories?page=1&limit=100"),
        api.get<unknown>("/pharmacy/generics?page=1&limit=100"),
        api.get<unknown>("/pharmacy/manufacturers?page=1&limit=100"),
        api.get<unknown>("/pharmacy/groups?page=1&limit=100"),
        api.get<unknown>("/pharmacy/units?page=1&limit=100"),
      ]);
      if (!active) return;
      if (results[0].status === "fulfilled") setCategories(list<Option>(results[0].value));
      if (results[1].status === "fulfilled") setGenerics(list<Option>(results[1].value));
      if (results[2].status === "fulfilled") setManufacturers(list<Option>(results[2].value));
      if (results[3].status === "fulfilled") setGroups(list<Option>(results[3].value));
      if (results[4].status === "fulfilled") setUnits(list<Option>(results[4].value));
    }
    void loadOptions();
    return () => { active = false; };
  }, []);

  const load = useCallback(async (signal?:AbortSignal) => {
    const requestId=++listRequest.current;
    if(!canRead){setMedicines([]);setStocks([]);setLoading(false);return;}
    if (!branchId) { setMedicines([]);setStocks([]);setPageInfo({total:0,totalPages:1});setLoading(false); return; }
    if(expiryStartDate&&expiryEndDate&&expiryStartDate>expiryEndDate){setStocks([]);setPageInfo({total:0,totalPages:1});setError("Expiry from must be on or before expiry to.");setLoading(false);return;}
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "25" });
    if (search.trim()) params.set("search", search.trim());
    if (mode === "catalog") {
      if (categoryId) params.set("categoryId", categoryId);
      if (genericId) params.set("genericId", genericId);
      if (manufacturerId) params.set("medicineManufacturerId", manufacturerId);
      if (medicineStatus) params.set("isActive", medicineStatus);
      for(const [key,value] of Object.entries(catalogFilters))if(value.trim())params.set(key,value.trim());
      if(catalogFilters.hasStock)params.set("branchId",branchId);
    }
    if (mode === "inventory") {
      params.set("branchId", branchId);
      if (batchNumber.trim()) params.set("batchNumber", batchNumber.trim());
      if (rackNumber.trim()) params.set("rackNumber", rackNumber.trim());
      if (stockUnit.trim()) params.set("unit", stockUnit.trim());
      if (stockMedicineId) params.set("medicineId", stockMedicineId);
      if (expiryStartDate) params.set("expiryStartDate", expiryStartDate);
      if (expiryEndDate) params.set("expiryEndDate", expiryEndDate);
      if (inventoryManufacturerId) params.set("medicineManufacturerId", inventoryManufacturerId);
    }
    try {
      if (mode === "catalog") {
        const result = await api.getWithMeta<unknown>(`/pharmacy/medicines?${params.toString()}`,{signal});
        if(signal?.aborted||requestId!==listRequest.current)return;
        const medicineRows = list<Medicine>(result);
        setMedicines(medicineRows);
        const meta=readPagination(result,medicineRows.length,page,25);setPageInfo(meta);if(page>meta.totalPages)setPage(meta.totalPages);
      } else {
        const [stockResult, medicineResult] = await Promise.allSettled([
          api.getWithMeta<unknown>(`/pharmacy/stocks?${params.toString()}`,{signal}),
          hasPermission("medicine:read")?api.get<unknown>(`/pharmacy/medicines?page=1&limit=100&branchId=${encodeURIComponent(branchId)}&search=${encodeURIComponent(search.trim())}`,{signal}):Promise.resolve([]),
        ]);
        if(signal?.aborted||requestId!==listRequest.current)return;
        if(stockResult.status!=="fulfilled")throw stockResult.reason;
        const result=stockResult.value;
        const medicineRows=medicineResult.status==="fulfilled"?list<Medicine>(medicineResult.value):[];
        const stockRows = list<Stock>(result);
        const medicineById = new Map(medicineRows.map((medicine) => [medicine.id, medicine]));
        setStocks(stockRows.map((stock) => {
          const medicine = medicineById.get(stock.medicineId);
          return medicine ? { ...stock, medicine: { ...stock.medicine, ...medicine } } : stock;
        }));
        setMedicines(medicineRows);
        const meta=readPagination(result,stockRows.length,page,25);setPageInfo(meta);if(page>meta.totalPages)setPage(meta.totalPages);
      }
      setError("");
    } catch (cause) { if(!signal?.aborted&&requestId===listRequest.current){setStocks([]);setMedicines([]);setPageInfo({total:0,totalPages:1});setError(err(cause));} }
    finally { if(!signal?.aborted&&requestId===listRequest.current)setLoading(false); }
  }, [canRead,hasPermission,batchNumber, branchId, categoryId, expiryEndDate, expiryStartDate, genericId, inventoryManufacturerId, manufacturerId, medicineStatus, mode, page, rackNumber, search, stockUnit, stockMedicineId, catalogFilters]);

  useEffect(() => {
    const controller=new AbortController();const timer = window.setTimeout(() => { void load(controller.signal); }, 180);
    return () => {window.clearTimeout(timer);controller.abort();};
  }, [load]);

  const enrichedStocks=useMemo(()=>stocks.map(stock=>({...stock,...stockFlags(stock,stock.medicine)})),[stocks]);
  const displayStocks=useMemo(()=>enrichedStocks.filter(stock=>stockFilter==="all"||stock[stockFilter]),[enrichedStocks,stockFilter]);
  const inventoryCounts=useMemo(()=>({total:stocks.length,low:enrichedStocks.filter(stock=>stock.low).length,expiring:enrichedStocks.filter(stock=>stock.expiring).length,expired:enrichedStocks.filter(stock=>stock.expired).length,out:enrichedStocks.filter(stock=>stock.out).length}),[enrichedStocks,stocks.length]);




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
    setError("");setOperationBranch(branchId);setOpeningSearch("");setOpeningMedicines([]);setStockAction(action);
    setStockForm({ stockId: stock?.id || "", medicineId: "", toBranchId: branches.find((branch) => branch.id !== branchId)?.id || "", quantity: "1", type: "increase", note: "", batchNumber: "", expiryDate: "", unitPrice: "", mrp: "", unit: stock?.unit || "Pcs", rackNumber: stock?.rackNumber || "", recoverAmount: "", accountId: "" });
  }
  function openPriceDialog() { setOperationBranch(branchId);setError(""); setPriceDraft(Object.fromEntries(stocks.filter(s=>s.sku).map(s=>[s.id,{unitPrice:String(s.unitPrice??0),mrp:String(s.mrp??0)}]))); setPriceDialog(true); }
  async function saveBulkPrices(){
    if(operationLock.current)return;
    if(!hasPermission("medicine:update")){setError("Your role cannot update batch prices.");return;}
    if(operationBranch!==branchId){setError("The active branch changed. Reopen the price editor.");return;}
    const changed=stocks.filter(stock=>stock.branchId===operationBranch&&stock.sku&&priceDraft[stock.id]&&(Number(priceDraft[stock.id].unitPrice)!==Number(stock.unitPrice)||Number(priceDraft[stock.id].mrp)!==Number(stock.mrp)));
    if(!changed.length){setError("Change at least one batch price before saving.");return;}
    if(changed.some(stock=>positivePrice(priceDraft[stock.id].unitPrice)===null||positivePrice(priceDraft[stock.id].mrp)===null)){setError("Unit cost and MRP must be positive amounts with at most two decimal places.");return;}
    operationLock.current=true;setSavingStock(true);setError("");
    try{await api.patch("/pharmacy/stocks/bulk-price-update",changed.map(stock=>({medicineId:stock.medicineId,sku:stock.sku,unitPrice:Number(priceDraft[stock.id].unitPrice),mrp:Number(priceDraft[stock.id].mrp)})));setPriceDialog(false);if(currentBranch.current===operationBranch)await load();setNotice(`${changed.length} batch prices updated.`);}catch(cause){setError(err(cause));}finally{operationLock.current=false;setSavingStock(false);}
  }
  async function freshBatch(stock:Stock){
    const params=new URLSearchParams({branchId:stock.branchId,medicineId:stock.medicineId,batchNumber:stock.batchNumber,page:"1",limit:"1"});
    const match=list<Stock>(await api.get<unknown>(`/pharmacy/stocks?${params}`)).find(item=>item.id===stock.id);
    if(!match)throw new Error("The selected batch could not be verified. Refresh inventory.");
    return match;
  }
  async function saveStockAction(){
    if(!stockAction||operationLock.current)return;
    if(!hasPermission(stockAction==="opening"?"stock:create":"stock:update")){setError("Your role cannot perform this stock operation.");return;}
    const problem=stockOperationError(stockAction,stockForm,operationBranch,branchId,actionStock,stockAction==="opening");if(problem){setError(problem);return;}
    operationLock.current=true;setSavingStock(true);setError("");
    try{
      if(stockAction==="opening"){
        await api.post("/pharmacy/stocks/opening",{medicineId:stockForm.medicineId,branchId:operationBranch,batchNumber:stockForm.batchNumber.trim(),expiryDate:new Date(`${stockForm.expiryDate}T23:59:59.999+06:00`).toISOString(),quantity:Number(stockForm.quantity),unitPrice:Number(stockForm.unitPrice),mrp:Number(stockForm.mrp),unit:stockForm.unit.trim()||undefined,rackNumber:stockForm.rackNumber.trim()||undefined,note:stockForm.note.trim()||undefined});
      }else{
        const fresh=await freshBatch(actionStock!);if(currentBranch.current!==operationBranch)throw new Error("The active branch changed. Reopen the operation.");setStocks(current=>current.map(stock=>stock.id===fresh.id?{...stock,...fresh,medicine:stock.medicine}:stock));
        const changed=stockOperationError(stockAction,stockForm,operationBranch,branchId,fresh);if(changed){setError(changed);return;}
        if(stockAction==="adjust")await api.post("/pharmacy/stocks/adjust",{stockId:fresh.id,quantity:Number(stockForm.quantity),type:stockForm.type,note:stockForm.note.trim()||undefined,...(Number(stockForm.recoverAmount)>0?{recoverAmount:Number(stockForm.recoverAmount),accountId:stockForm.accountId}:{})});
        else await api.post("/pharmacy/stocks/transfer",{stockId:fresh.id,toBranchId:stockForm.toBranchId,quantity:Number(stockForm.quantity),note:stockForm.note.trim()||undefined});
      }
      setStockAction(null);if(currentBranch.current===operationBranch)await load();setNotice(t("Stock operation completed."));
    }catch(cause){setError(cause instanceof Error?cause.message:err(cause));}finally{operationLock.current=false;setSavingStock(false);}
  }

  const title = t(mode === "catalog" ? "Medicine catalog" : "Inventory & batches");
  const subtitle = t(mode === "catalog" ? "Browse medicines, variants and current branch stock." : "Track batch quantities, expiry dates and shelf locations.");
  const activeCount = medicines.filter((item) => item.isActive).length;
  const medicineTotalStock = (medicine: Medicine) => (medicine.stocks ?? []).filter((stock) => stock.branchId === branchId).reduce((sum, stock) => sum + number(stock.quantity), 0);
  const medicineStockValue = (medicine: Medicine) => (medicine.stocks ?? []).filter((stock) => stock.branchId === branchId).reduce((sum, stock) => sum + number(stock.quantity) * number(stock.mrp), 0);
  const pagination = <div className="data-pagination"><span>{t("Showing page")} {page} {t("of")} {pageInfo.totalPages} · {pageInfo.total.toLocaleString("en-BD")} {t("records")}</span><div><button type="button" disabled={loading || page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>{t("Previous")}</button><button type="button" disabled={loading || page >= pageInfo.totalPages} onClick={() => setPage((current) => Math.min(pageInfo.totalPages, current + 1))}>{t("Next")}</button></div></div>;

  if(!canRead)return <section className="data-page"><h1>{title}</h1><div className="data-empty"><ShieldAlert/><strong>{t("Your role cannot view this page.")}</strong></div></section>;

  return <section className="data-page">
    <div className="page-heading-row"><div><p className="eyebrow">{t("PHARMACY")} · {t(mode === "catalog" ? "PRODUCTS" : "STOCK CONTROL")}</p><h1>{title}</h1><p className="page-subtitle">{subtitle}</p></div><div className="inventory-heading-actions">{mode === "catalog"&&<>{hasPermission("medicine:create")&&<label className="purchase-save-pending catalog-import-button">{importingMedicines?t("Importing…"):t("Import file")}<input type="file" accept=".csv,.xls,.xlsx" disabled={importingMedicines} onChange={event=>{void importMedicines(event.target.files?.[0]);event.currentTarget.value="";}}/></label>}{hasPermission("medicine:create")&&<button className="purchase-primary-action" onClick={()=>openMedicine()}><Plus size={14}/>{t("Add medicine")}</button>}</>}{mode === "inventory"&&<><button type="button" className="purchase-save-pending stock-history-toggle" aria-expanded={historyOpen} onClick={() => setHistoryOpen(open => !open)}>{t(historyOpen ? "Hide stock history" : "Stock history")}</button>{hasPermission("stock:update")&&<button className="purchase-save-pending" onClick={()=>openStockAction("adjust")}><ArrowUpDown size={14}/>{t("Adjust stock")}</button>}{hasPermission("stock:update")&&<button className="purchase-save-pending" onClick={()=>openStockAction("transfer")}><ArrowLeftRight size={14}/>{t("Transfer")}</button>}{hasPermission("medicine:update")&&<button className="purchase-save-pending" onClick={openPriceDialog}>{t("Bulk price")}</button>}{hasPermission("stock:create")&&<button className="purchase-primary-action" onClick={()=>openStockAction("opening")}><Plus size={14}/>{t("Opening stock")}</button>}</>}</div></div>
    {mode === "inventory" && historyOpen && <StockHistoryPanel key={branchId} branchId={branchId} />}
    {error && <div className="data-alert"><CircleAlert size={16}/><span>{error}</span><button onClick={() => void load()}>Retry</button></div>}
    {notice && <div className="sales-alert success"><Check size={15}/><span>{notice}</span><button onClick={()=>setNotice("")} aria-label="Dismiss"><X size={14}/></button></div>}
    <nav className="data-tabs" aria-label={t("Pharmacy inventory sections")}><Link href="/catalog" className={mode === "catalog" ? "selected" : ""}><Package size={15}/> {t("Catalog")}</Link><Link href="/inventory" className={mode === "inventory" ? "selected" : ""}><Boxes size={15}/> {t("Inventory")}</Link></nav>
    {mode === "catalog" ? <>
      <div className="data-summary-row"><div className="data-summary-card"><span className="data-summary-icon mint"><Package size={17}/></span><span><small>{t("Medicines on this page")}</small><strong>{loading ? "—" : medicines.length}</strong></span></div><div className="data-summary-card"><span className="data-summary-icon blue"><Boxes size={17}/></span><span><small>{t("Active records on this page")}</small><strong>{loading ? "—" : activeCount}</strong></span></div><div className="data-summary-card"><span className="data-summary-icon amber"><AlertTriangle size={17}/></span><span><small>{t("Low / no stock on this page")}</small><strong>{loading ? "—" : medicines.filter((item) => medicineTotalStock(item) <= number(item.reorderLevel ?? 10)).length}</strong></span></div></div>
      <div className="data-card panel"><div ref={filterPanel}><div className="data-toolbar"><div className="data-search"><Search size={17}/><input placeholder={t("Search medicine, generic, barcode…")} value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }}/></div><button className={`data-filter-button ${filtersOpen ? "selected" : ""}`} aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}><Filter size={15}/> {t("Filters")}</button></div>
        {filtersOpen && <FilterPopover className="data-filter-drawer" onClose={() => setFiltersOpen(false)}>{[{key:"groupId",label:"Group",options:groups},{key:"medicineUnitId",label:"Medicine unit",options:units}].map(({key,label,options})=><label key={key}><span>{t(label)}</span><Select value={catalogFilters[key]||""} onChange={e=>{setPage(1);setCatalogFilters(f=>({...f,[key]:e.target.value}));}}><option value="">{t("All")}</option>{options.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</Select></label>)}<details className="catalog-advanced-filters"><summary>{t("Advanced filters")}<span>{t("Name, barcode, unit and strength")}</span></summary><div className="catalog-advanced-grid">{[{key:"name",label:"Medicine name"},{key:"nameBangla",label:"Bangla name"},{key:"genericName",label:"Generic name"},{key:"genericNameBangla",label:"Bangla generic name"},{key:"barcode",label:"Barcode"},{key:"unit",label:"Unit"},{key:"dosageForm",label:"Dosage form"},{key:"strength",label:"Strength"}].map(({key,label})=><label key={key}><span>{t(label)}</span><input value={catalogFilters[key]||""} onChange={e=>{setPage(1);setCatalogFilters(f=>({...f,[key]:e.target.value}));}} placeholder={t("Exact match")}/></label>)}</div></details><label><span>{t("Stock availability")}</span><Select value={catalogFilters.hasStock||""} onChange={e=>{setPage(1);setCatalogFilters(f=>({...f,hasStock:e.target.value}));}}><option value="">{t("All")}</option><option value="true">{t("In stock")}</option><option value="false">{t("Out of stock")}</option></Select></label><label><span>{t("Category")}</span><Select value={categoryId} onChange={(event) => { setPage(1); setCategoryId(event.target.value); }}><option value="">{t("All categories")}</option>{categories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</Select></label><label><span>{t("Generic")}</span><Select value={genericId} onChange={(event) => { setPage(1); setGenericId(event.target.value); }}><option value="">{t("All generics")}</option>{generics.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</Select></label><label><span>{t("Manufacturer")}</span><Select value={manufacturerId} onChange={(event) => { setPage(1); setManufacturerId(event.target.value); }}><option value="">{t("All manufacturers")}</option>{manufacturers.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</Select></label><label><span>{t("Availability status")}</span><Select value={medicineStatus} onChange={(event) => { setPage(1); setMedicineStatus(event.target.value); }}><option value="">{t("All statuses")}</option><option value="true">{t("Active")}</option><option value="false">{t("Inactive")}</option></Select></label><button onClick={() => { setPage(1); setCategoryId(""); setGenericId(""); setManufacturerId(""); setMedicineStatus("");setCatalogFilters({}); }}>{t("Clear filters")}</button></FilterPopover>}
        </div><div className="data-table-scroll"><table className="data-table"><thead><tr><th>{t("Medicine")}</th><th>{t("Category / generic")}</th><th>{t("Branch stock")}</th><th>{t("Sale price")}</th><th>{t("Stock value · MRP")}</th><th>{t("Status")}</th><th>{t("Actions")}</th></tr></thead><tbody>{medicines.map((medicine) => { const quantity = medicineTotalStock(medicine); return <tr key={medicine.id}><td><strong>{medicine.name}</strong><small>{[medicine.strength, medicine.dosageForm, medicine.barcode ? `#${medicine.barcode}` : ""].filter(Boolean).join(" · ")}</small></td><td data-label={t("Category / generic")}><span>{medicine.category?.name || t("Uncategorized")}</span><small>{medicine.generic?.name || medicine.genericName || "—"}</small></td><td data-label={t("Branch stock")}><strong>{quantity}</strong><small>{medicine.unit || "Pcs"} · {t("reorder at")} {medicine.reorderLevel ?? 10}</small></td><td data-label={t("Sale price")}>{bdt(number(medicine.salePrice) || number(medicine.mrp))}</td><td data-label={t("Stock value · MRP")}>{bdt(medicineStockValue(medicine))}</td><td data-label={t("Status")}><span className={`data-status ${medicine.isActive ? quantity > number(medicine.reorderLevel ?? 10) ? "good" : "warn" : "muted"}`}>{!medicine.isActive ? t("Inactive") : quantity === 0 ? t("Out of stock") : quantity <= number(medicine.reorderLevel ?? 10) ? t("Low stock") : t("Active")}</span></td><td data-label={t("Actions")} className="catalog-actions-cell"><div className="catalog-row-actions">{hasPermission("medicine:update")&&<button type="button" className="catalog-edit-action" onClick={()=>openMedicine(medicine)} aria-label={`${t("Edit")} ${medicine.name}`}><Pencil size={15}/><span>{t("Edit")}</span></button>}{hasPermission("stock:read")&&<button type="button" className="catalog-batches-action" onClick={() => setSelectedMedicine(medicine)} aria-label={`${t("View batches for")} ${medicine.name}`}><Boxes size={16}/><span>{t("View batches")}</span></button>}</div></td></tr>; })}</tbody></table></div>
        {!loading && medicines.length === 0 && <div className="data-empty"><Package size={22}/><strong>{t("No medicines found")}</strong><span>{t("Adjust the search or filters to see matching catalog records.")}</span></div>}
        {loading && <div className="data-loading">{t("Loading medicine catalog…")}</div>}
        {pageInfo.totalPages > 1 && pagination}
      </div>
    </> : <>
      <div className="data-summary-row data-summary-row-five"><button className={`data-summary-card ${stockFilter === "all" ? "active" : ""}`} onClick={() => setStockFilter("all")}><span className="data-summary-icon mint"><Boxes size={17}/></span><span><small>{t("All batches")}</small><strong>{loading ? "—" : pageInfo.total}</strong></span></button><button className={`data-summary-card ${stockFilter === "low" ? "active" : ""}`} onClick={() => setStockFilter("low")}><span className="data-summary-icon amber"><AlertTriangle size={17}/></span><span><small>{t("Low stock on this page")}</small><strong>{loading ? "—" : inventoryCounts.low}</strong></span></button><button className={`data-summary-card ${stockFilter === "expiring" ? "active" : ""}`} onClick={() => setStockFilter("expiring")}><span className="data-summary-icon yellow"><CalendarClock size={17}/></span><span><small>{t("Expiring ≤90d on this page")}</small><strong>{loading ? "—" : inventoryCounts.expiring}</strong></span></button><button className={`data-summary-card ${stockFilter === "expired" ? "active" : ""}`} onClick={() => setStockFilter("expired")}><span className="data-summary-icon red"><ShieldAlert size={17}/></span><span><small>{t("Expired batches on this page")}</small><strong>{loading ? "—" : inventoryCounts.expired}</strong></span></button><button className={`data-summary-card ${stockFilter === "out" ? "active" : ""}`} onClick={() => setStockFilter("out")}><span className="data-summary-icon gray"><Package size={17}/></span><span><small>{t("Out of stock on this page")}</small><strong>{loading ? "—" : inventoryCounts.out}</strong></span></button></div>
      <div className="data-card panel"><div ref={filterPanel}><div className="data-toolbar"><div className="data-search"><Search size={17}/><input placeholder={t("Search medicine or generic…")} value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }}/></div><button className="data-filter-button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}><Filter size={15}/> {t("Filters")}</button><span className="data-current-filter">{t(stockFilter === "all" ? "All stock states" : stockFilter === "low" ? "Low stock" : stockFilter === "expiring" ? "Expiring soon" : stockFilter === "expired" ? "Expired" : "Out of stock")}</span></div>
        {filtersOpen && <FilterPopover className="data-filter-drawer" onClose={() => setFiltersOpen(false)}><label><span>{t("Medicine")}</span><Select aria-label="Inventory medicine filter" value={stockMedicineId} onChange={event=>{setPage(1);setStockMedicineId(event.target.value);}}><option value="">{t("All medicines")}</option>{medicines.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</Select></label><label><span>{t("Unit")}</span><input aria-label="Stock unit filter" value={stockUnit} onChange={event=>{setPage(1);setStockUnit(event.target.value);}} placeholder="Pcs, Box, Strip"/></label><label><span>{t("Manufacturer")}</span><Select value={inventoryManufacturerId} onChange={event=>{setPage(1);setInventoryManufacturerId(event.target.value);}}><option value="">{t("All manufacturers")}</option>{manufacturers.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</Select></label><label><span>{t("Batch number")}</span><input value={batchNumber} onChange={event=>{setPage(1);setBatchNumber(event.target.value);}} placeholder={t("Exact batch number")}/></label><label><span>{t("Rack number")}</span><input value={rackNumber} onChange={event=>{setPage(1);setRackNumber(event.target.value);}} placeholder={t("Exact rack number")}/></label><label><span>{t("Expiry from")}</span><input type="date" value={expiryStartDate} onChange={event=>{setPage(1);setExpiryStartDate(event.target.value);}}/></label><label><span>{t("Expiry to")}</span><input type="date" value={expiryEndDate} onChange={event=>{setPage(1);setExpiryEndDate(event.target.value);}}/></label><button onClick={()=>{setPage(1);setInventoryManufacturerId("");setStockUnit("");setStockMedicineId("");setBatchNumber("");setRackNumber("");setExpiryStartDate("");setExpiryEndDate("");setSearch("");}}>{t("Clear filters")}</button></FilterPopover>}</div><div className="data-table-scroll"><table className="data-table inventory-table"><thead><tr><th>{t("Medicine / batch")}</th><th>{t("Expiry")}</th><th>{t("Branch / rack")}</th><th>{t("Quantity")}</th><th>{t("MRP")}</th><th>{t("Stock state")}</th><th>{t("Actions")}</th></tr></thead><tbody>{displayStocks.map((stock) => <tr key={stock.id}><td><strong>{stock.medicine?.name || `${t("Medicine")} ${stock.medicineId.slice(0, 7)}`}</strong><small>{stock.medicine?.strength || stock.medicine?.genericName || stock.medicine?.unit || t("Medicine")} · {t("Batch")} {stock.batchNumber}</small></td><td data-label={t("Expiry")}><strong>{expiryLabel(stock.expiryDate)}</strong><small>{stock.days===null?t("Invalid expiry date"):daysUntil(stock.expiryDate) < 0 ? `${Math.abs(daysUntil(stock.expiryDate))} ${t("days expired")}` : `${daysUntil(stock.expiryDate)} ${t("days remaining")}`}</small></td><td data-label={t("Branch / rack")}>{stock.branch?.name || branches.find((branch) => branch.id === stock.branchId)?.name || "—"}<small>{stock.rackNumber || t("No rack assigned")}</small></td><td data-label={t("Quantity")}><strong>{stock.quantity}</strong><small>{stock.unit || "Pcs"}</small></td><td data-label={t("MRP")}>{bdt(number(stock.mrp))}</td><td data-label={t("Stock state")}><span className={`data-status ${stock.state === "normal" ? "good" : stock.state === "low" ? "warn" : stock.state === "expiring" ? "soon" : stock.state === "unknown" ? "muted" : "danger"}`}>{t(stock.state === "normal" ? "In stock" : stock.state === "out" ? "Out of stock" : stock.state === "low" ? "Low stock" : stock.state === "expired" ? "Expired" : stock.state === "unknown" ? "Threshold unavailable" : "Expiring soon")}</span>{stock.low&&stock.state!=="low"&&<span className="data-status warn">{t("Low stock")}</span>}</td><td data-label={t("Actions")}><div className="stock-row-actions">{hasPermission("stock:update")&&<><button type="button" disabled={savingStock} aria-label={`Adjust batch ${stock.batchNumber}`} onClick={()=>openStockAction("adjust",stock)}>{t("Adjust")}</button><button type="button" disabled={savingStock} aria-label={`Transfer batch ${stock.batchNumber}`} onClick={()=>openStockAction("transfer",stock)}>{t("Transfer")}</button></>}</div></td></tr>)}</tbody></table></div>
        {!loading && displayStocks.length === 0 && <div className="data-empty"><Boxes size={22}/><strong>{t("No matching stock batches")}</strong><span>{t("This branch and filter combination has no records in the current result.")}</span></div>}
        {loading && <div className="data-loading">{t("Loading stock batches…")}</div>}
        {pageInfo.totalPages > 1 && pagination}
        <p className="data-footnote"><AlertTriangle size={13}/> {t("All batches shows the filtered total. Alert counts and state filters apply to this page. Low stock uses unexpired branch stock when reorder information is available; expiry alerts use 90 days.")}</p>
      </div>
    </>}



    {priceDialog&&<div className="sales-backdrop" role="presentation" onClick={()=>{if(!savingStock)setPriceDialog(false);}}><div className="supplier-dialog panel hr-dialog bulk-price-dialog" role="dialog" aria-modal="true" aria-label={t("Bulk batch price update")} onClick={event=>event.stopPropagation()}><button className="purchase-close" disabled={savingStock} onClick={()=>{if(!savingStock)setPriceDialog(false);}} aria-label={t("Close")}><X size={18}/></button><p className="eyebrow">{t("INVENTORY")} · {t("BATCH PRICES")}</p><h2>{t("Bulk price update")}</h2><p>{t("Edit unit cost and MRP for batches on the current inventory page. Only changed rows will be saved.")}</p><div className="bulk-price-list">{stocks.filter(s=>s.sku).map(stock=><div key={stock.id}><div><strong>{stock.medicine?.name||stock.medicineId}</strong><small>{t("Batch")} {stock.batchNumber} · {stock.quantity} {stock.unit}</small></div><label>{t("Unit cost")}<input type="number" min="0.01" step="0.01" disabled={savingStock} aria-label={`Unit cost for ${stock.batchNumber}`} value={priceDraft[stock.id]?.unitPrice||""} onChange={e=>setPriceDraft({...priceDraft,[stock.id]:{...priceDraft[stock.id],unitPrice:e.target.value}})}/></label><label>{t("MRP")}<input type="number" min="0.01" step="0.01" disabled={savingStock} aria-label={`MRP for ${stock.batchNumber}`} value={priceDraft[stock.id]?.mrp||""} onChange={e=>setPriceDraft({...priceDraft,[stock.id]:{...priceDraft[stock.id],mrp:e.target.value}})}/></label></div>)}{!stocks.some(s=>s.sku)&&<div className="data-empty"><Boxes size={20}/><strong>{t("No editable batch prices found")}</strong><span>{t("Refresh stock after the branch inventory loads.")}</span></div>}</div>{error&&<p role="alert" className="pos-dialog-error">{error}</p>}<button className="purchase-primary-action full" disabled={savingStock||!hasPermission("medicine:update")} onClick={()=>void saveBulkPrices()}>{savingStock?t("Saving…"):t("Save changed prices")}</button></div></div>}
    {medicineDialog&&<div className="sales-backdrop" role="presentation" onClick={()=>{if(!savingMedicine)setMedicineDialog(false);}}><div className="supplier-dialog panel hr-dialog medicine-form-dialog" role="dialog" aria-modal="true" aria-label={t(editingMedicine?"Edit medicine":"Add medicine")} onClick={event=>event.stopPropagation()}><button className="purchase-close" disabled={savingMedicine} onClick={()=>{if(!savingMedicine)setMedicineDialog(false);}} aria-label={t("Close")}><X size={18}/></button><p className="eyebrow">{t("PHARMACY")} · {t("MEDICINE CATALOG")}</p><h2>{t(editingMedicine?"Edit medicine":"Add medicine")}</h2><p>{t("Set the product identity, classification and default pricing used by purchasing and POS.")}</p><form onSubmit={event=>{event.preventDefault();void saveMedicine();}}><fieldset disabled={savingMedicine} className="medicine-fields"><legend>{t("Product identity")}</legend><label><span className="field-label">{t("Medicine name")} <span className="field-required">*</span></span><input required autoComplete="off" placeholder={t("e.g. Paracetamol 500mg")} value={medicineForm.name} onChange={e=>setMedicineForm({...medicineForm,name:e.target.value})}/></label><label><span className="field-label">{t("Bangla name")} <span className="form-optional">{t("Optional")}</span></span><input value={medicineForm.nameBangla} onChange={e=>setMedicineForm({...medicineForm,nameBangla:e.target.value})}/></label><div className="customer-form-grid"><label><span className="field-label">{t("Generic name")} <span className="field-required">*</span></span><input required value={medicineForm.genericName} onChange={e=>setMedicineForm({...medicineForm,genericName:e.target.value})}/></label><label>{t("Barcode")}<input value={medicineForm.barcode} onChange={e=>setMedicineForm({...medicineForm,barcode:e.target.value})}/></label></div><label><span className="field-label">{t("Generic name (Bangla)")} <span className="form-optional">{t("Optional")}</span></span><input value={medicineForm.genericNameBangla} onChange={e=>setMedicineForm({...medicineForm,genericNameBangla:e.target.value})}/></label></fieldset><fieldset disabled={savingMedicine} className="medicine-fields"><legend>{t("Classification & stock")}</legend><div className="customer-form-grid"><label>{t("Category")}<Select value={medicineForm.categoryId} onChange={e=>setMedicineForm({...medicineForm,categoryId:e.target.value})}><option value="">{t("Choose category")}</option>{categories.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</Select></label><label>{t("Generic")}<Select value={medicineForm.genericId} onChange={e=>setMedicineForm({...medicineForm,genericId:e.target.value})}><option value="">{t("Choose generic")}</option>{generics.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</Select></label></div><div className="customer-form-grid"><label>{t("Manufacturer")}<Select value={medicineForm.medicineManufacturerId} onChange={e=>setMedicineForm({...medicineForm,medicineManufacturerId:e.target.value})}><option value="">{t("Choose manufacturer")}</option>{manufacturers.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</Select></label><label>{t("Group")}<Select value={medicineForm.groupId} onChange={e=>setMedicineForm({...medicineForm,groupId:e.target.value})}><option value="">{t("Choose group")}</option>{groups.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</Select></label></div><div className="customer-form-grid"><label>{t("Strength")}<input value={medicineForm.strength} onChange={e=>setMedicineForm({...medicineForm,strength:e.target.value})}/></label><label>{t("Dosage form")}<input value={medicineForm.dosageForm} onChange={e=>setMedicineForm({...medicineForm,dosageForm:e.target.value})} placeholder={t("e.g. Tablet, syrup")}/></label></div><div className="customer-form-grid"><label>{t("Unit")}<Select value={medicineForm.medicineUnitId} onChange={e=>{const id=e.target.value;const chosen=units.find(x=>x.id===id);setMedicineForm({...medicineForm,medicineUnitId:id,unit:chosen?.name||medicineForm.unit});}}><option value="">{medicineForm.unit||t("Select unit")}</option>{units.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</Select></label><label>{t("Reorder level")}<input type="number" min="0" value={medicineForm.reorderLevel} onChange={e=>setMedicineForm({...medicineForm,reorderLevel:e.target.value})}/></label></div></fieldset><fieldset disabled={savingMedicine} className="medicine-fields"><legend>{t("Default pricing")}</legend><p className="form-hint">{t("Prices are per unit in BDT. Opening stock is added separately.")}</p><div className="customer-form-grid"><label>{t("Purchase price")}<input type="number" min="0" step="0.01" value={medicineForm.purchasePrice} onChange={e=>setMedicineForm({...medicineForm,purchasePrice:e.target.value})}/></label><label>{t("Sale price")}<input type="number" min="0" step="0.01" value={medicineForm.salePrice} onChange={e=>setMedicineForm({...medicineForm,salePrice:e.target.value})}/></label></div><label>{t("MRP")}<input type="number" min="0" step="0.01" value={medicineForm.mrp} onChange={e=>setMedicineForm({...medicineForm,mrp:e.target.value})}/></label>{editingMedicine&&<label className="hr-paid-control">{t("Available for sale")}<input type="checkbox" checked={medicineForm.isActive} onChange={e=>setMedicineForm({...medicineForm,isActive:e.target.checked})}/></label>}</fieldset>{error&&<p role="alert" className="form-error">{t(error)}</p>}<div className="modal-actions"><button type="button" className="purchase-save-pending" disabled={savingMedicine} onClick={()=>setMedicineDialog(false)}>{t("Cancel")}</button><button type="submit" className="purchase-primary-action" disabled={savingMedicine||!hasPermission(editingMedicine?"medicine:update":"medicine:create")}>{savingMedicine?t("Saving…"):editingMedicine?t("Save changes"):t("Add medicine")}</button></div></form></div></div>}
    {stockAction && <div className="sales-backdrop" role="presentation" onClick={()=>{if(!savingStock)setStockAction(null);}}><div className="supplier-dialog panel hr-dialog inventory-operation" role="dialog" aria-modal="true" aria-label={t("Stock operation")} onClick={event=>event.stopPropagation()}><button className="purchase-close" disabled={savingStock} onClick={()=>{if(!savingStock)setStockAction(null);}} aria-label={t("Close")}><X size={18}/></button><p className="eyebrow">{t("INVENTORY")} · {t(stockAction==="opening"?"OPENING STOCK":stockAction==="adjust"?"ADJUSTMENT":"TRANSFER")}</p><h2>{t(stockAction==="opening"?"Add opening stock":stockAction==="adjust"?"Adjust batch quantity":"Transfer stock")}</h2><p>{t(stockAction==="opening"?"Add an initial batch for the selected branch.":stockAction==="adjust"?"Record a positive quantity correction for a batch.":"Move available batch quantity to another branch.")}</p>
      <fieldset disabled={savingStock} className="inventory-action-fields">{stockAction==="opening"?<><p className="stock-operation-scope">{t("Branch")}: {branches.find(branch=>branch.id===operationBranch)?.name||operationBranch}</p><label>{t("Search medicine")}<input aria-label="Search medicine for opening stock" value={openingSearch} onChange={event=>{setOpeningSearch(event.target.value);setStockForm({...stockForm,medicineId:""});}} placeholder={t("Search by name, generic or barcode")}/></label>{!hasPermission("medicine:read")&&<p role="alert">{t("Medicine access is required to choose an opening-stock item.")}</p>}{openingLoading&&<p role="status">{t("Searching medicines…")}</p>}<label>{t("Medicine")}<Select aria-label="Opening stock medicine" value={stockForm.medicineId} onChange={event=>{const medicine=openingMedicines.find(item=>item.id===event.target.value);setStockForm({...stockForm,medicineId:event.target.value,unit:medicine?.unit||"Pcs",unitPrice:String(medicine?.purchasePrice??""),mrp:String(medicine?.mrp??"")});}}><option value="">{t("Choose medicine")}</option>{openingMedicines.map(m=><option key={m.id} value={m.id}>{m.name} · {m.strength||m.dosageForm||""}</option>)}</Select></label><label>{t("Batch number")}<input value={stockForm.batchNumber} onChange={event=>setStockForm({...stockForm,batchNumber:event.target.value})}/></label><div className="customer-form-grid"><label>{t("Expiry date")}<input type="date" value={stockForm.expiryDate} onChange={event=>setStockForm({...stockForm,expiryDate:event.target.value})}/></label><label>{t("Quantity")}<input type="number" min="1" step="1" value={stockForm.quantity} onChange={event=>setStockForm({...stockForm,quantity:event.target.value})}/></label></div><div className="customer-form-grid"><label>{t("Unit cost")}<input type="number" min="0.01" step="0.01" value={stockForm.unitPrice} onChange={event=>setStockForm({...stockForm,unitPrice:event.target.value})}/></label><label>{t("MRP")}<input type="number" min="0.01" step="0.01" value={stockForm.mrp} onChange={event=>setStockForm({...stockForm,mrp:event.target.value})}/></label></div><div className="customer-form-grid"><label>{t("Unit")}<input value={stockForm.unit} onChange={event=>setStockForm({...stockForm,unit:event.target.value})}/></label><label>{t("Rack / shelf")}<input value={stockForm.rackNumber} onChange={event=>setStockForm({...stockForm,rackNumber:event.target.value})}/></label></div></>:<><label>{t("Batch")}<Select aria-label="Operation batch" value={stockForm.stockId} onChange={event=>setStockForm({...stockForm,stockId:event.target.value})}><option value="">{t("Choose batch")}</option>{stocks.filter(s=>s.branchId===operationBranch).map(s=><option key={s.id} value={s.id}>{s.medicine?.name||s.medicineId} · {s.batchNumber} · {s.quantity} {s.unit}</option>)}</Select></label>{stockAction==="adjust"&&<label>{t("Adjustment type")}<Select aria-label="Adjustment type" value={stockForm.type} onChange={event=>setStockForm({...stockForm,type:event.target.value,...(event.target.value==="increase"?{recoverAmount:"",accountId:""}:{})})}><option value="increase">{t("Increase")}</option><option value="decrease">{t("Decrease")}</option></Select></label>}{stockAction==="adjust"&&stockForm.type==="decrease"&&hasPermission("account:read")&&<div className="customer-form-grid"><label>{t("Recovery amount")} <span className="form-optional">{t("Optional")}</span><input type="number" min="0" step="0.01" aria-label="Recovery amount" value={stockForm.recoverAmount} onChange={event=>setStockForm({...stockForm,recoverAmount:event.target.value})}/></label><label>{t("Recovery account")}<Select aria-label="Recovery account" value={stockForm.accountId} onChange={event=>setStockForm({...stockForm,accountId:event.target.value})}><option value="">{t("Choose account")}</option>{accounts.map(account=><option key={account.id} value={account.id}>{account.name}</option>)}</Select></label></div>}{stockAction==="transfer"&&<label>{t("Destination branch")}<Select aria-label="Destination branch" value={stockForm.toBranchId} onChange={event=>setStockForm({...stockForm,toBranchId:event.target.value})}><option value="">{t("Choose branch")}</option>{branches.filter(b=>b.id!==branchId).map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</Select></label>}<label>{t("Quantity")}<input type="number" min="1" step="1" value={stockForm.quantity} onChange={event=>setStockForm({...stockForm,quantity:event.target.value})}/></label></>}<label>{t("Note")} <span className="form-optional">{t("Optional")}</span><input maxLength={255} value={stockForm.note} onChange={event=>setStockForm({...stockForm,note:event.target.value})}/></label>{actionStock&&<p className="stock-operation-scope">{t("Available")}: {actionStock.quantity} {actionStock.unit} · {t("Batch")} {actionStock.batchNumber}</p>}{stockAction==="opening"&&<p className="stock-operation-scope">{t("Adding an existing medicine/batch increases quantity and updates its expiry and prices.")}</p>}{error&&<p className="pos-dialog-error" role="alert">{error}</p>}<button className="purchase-primary-action full" disabled={savingStock||!hasPermission(stockAction==="opening"?"stock:create":"stock:update")} onClick={()=>void saveStockAction()}>{savingStock?t("Saving…"):t("Confirm operation")}</button></fieldset></div></div>}
    {selectedMedicine && <div className="data-dialog-backdrop" role="presentation" onClick={() => setSelectedMedicine(null)}><div className="data-dialog panel" role="dialog" aria-modal="true" aria-label={t("Medicine batch details")} onClick={(event) => event.stopPropagation()}><button className="data-dialog-close" onClick={() => setSelectedMedicine(null)}>{t("Close")}</button><p className="eyebrow">{t("MEDICINE DETAILS")}</p><h2>{selectedMedicine.name}</h2><p>{selectedMedicine.generic?.name || selectedMedicine.genericName || t("Generic not set")} · {selectedMedicine.strength || selectedMedicine.dosageForm || t("No strength/form")}</p><div className="data-dialog-batches"><h3>{t("Branch batches")}</h3>{(selectedMedicine.stocks ?? []).filter((stock) => stock.branchId === branchId).length ? (selectedMedicine.stocks ?? []).filter((stock) => stock.branchId === branchId).map((stock) => <div key={stock.id}><span><strong>{t("Batch")} {stock.batchNumber}</strong><small>{t("Expires")} {expiryLabel(stock.expiryDate)}</small></span><span><strong>{stock.quantity} {stock.unit}</strong><small>{bdt(number(stock.mrp))} {t("MRP")} · {stock.rackNumber || t("No rack assigned")}</small></span></div>) : <div className="data-dialog-empty">{t("No batch records for this branch.")}</div>}</div></div></div>}
  </section>;
}
