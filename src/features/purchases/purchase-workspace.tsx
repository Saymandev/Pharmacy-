"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowDownLeft, Check, ChevronRight, CircleAlert, Clock3, FilePlus2, Filter, Package, Plus, Search, Truck, X } from "lucide-react";
import { api } from "@/lib/api/client";
import { purchaseTotals, purchaseDraftError, purchasePaymentError, supplierFormError } from "./purchase-policy";
import { readPagination } from "@/lib/api/pagination";
import { saleFilterError } from "../sales/sales-policy";
import { useAuth } from "@/components/providers/auth-provider";
import { useActiveBranch } from "@/components/providers/active-branch-provider";

type Data = Record<string, unknown>;
type Option = { id: string; name: string; phone?: string; address?: string };
type Supplier = Option & { email?: string | null };
type Medicine = { id: string; name: string; genericName?: string; strength?: string; unit?: string; purchasePrice?: number; salePrice?: number; mrp?: number };
type Account = { id: string; name: string; type: string };
type PurchaseItem = { medicineId: string; itemName: string; itemDescription?: string; unit: string; price: number; salePrice: number; mrp: number; quantity: number; batchNumber: string; expiryDate: string; rackNumber?: string };
type PurchaseTransaction = { id: string; txnId?: string; amount: number; paymentMethod?: string; note?: string; createdAt: string; flowType?: string };
type Purchase = { id: string; poNumber?: string; branchId: string; supplierId: string; branch?: { name: string }; supplier?: { name: string; phone?: string }; status: string; paymentStatus: string; totalPrice: number; paidAmount: number; dueAmount: number; discountAmount?: number; createdAt: string; note?: string; purchaseItems?: PurchaseItem[]; transactions?: PurchaseTransaction[] };
type Tab = "purchases" | "suppliers";
type PurchasePagination = { total?: number; page?: number; limit?: number; totalPages?: number };
const methods = ["cash", "card", "online", "cheque", "bKash", "Nagad", "Rocket", "Bank Transfer"] as const;
function list<T>(value: unknown): T[] { if (Array.isArray(value)) return value as T[]; if (value && typeof value === "object") { const obj = value as Data; if ("data" in obj) return list<T>(obj.data); for (const key of ["branches", "suppliers", "purchases", "accounts", "medicines"]) if (key in obj) return list<T>(obj[key]); } return []; }
function n(value: unknown) { const x = Number(value); return Number.isFinite(x) ? x : 0; }
function taka(value: number) { return new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT", maximumFractionDigits: 2 }).format(value || 0); }
function errorText(error: unknown) { return error instanceof Error ? error.message : "Could not complete the request. Please try again."; }
function statusClass(status: string) { return status === "completed" || status === "paid" ? "good" : status === "partial" ? "soon" : status === "rejected" ? "danger" : "warn"; }

export function PurchaseWorkspace() {
  const { hasPermission } = useAuth();
  const { activeBranchId: branchId } = useActiveBranch();
  const mutationLock=useRef(false);
  const listRequest=useRef(0);
  const detailRequest=useRef(0);
  const currentBranch=useRef(branchId);
  useEffect(()=>{currentBranch.current=branchId;},[branchId]);
  const [draftBranch,setDraftBranch]=useState("");
  const [paymentNote,setPaymentNote]=useState("");
  const [tab, setTab] = useState<Tab>("purchases");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerDialog, setRegisterDialog] = useState(false);
  const [openingCash, setOpeningCash] = useState("0");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Required<PurchasePagination>>({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [newPurchase, setNewPurchase] = useState(false);
  const [newSupplier, setNewSupplier] = useState(false);
  const [selected, setSelected] = useState<Purchase | null>(null);
  const [queryMedicine, setQueryMedicine] = useState("");
  const [medicineResults, setMedicineResults] = useState<Medicine[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [discountMode, setDiscountMode] = useState<"percent" | "fixed">("percent");
  const [discountInput, setDiscountInput] = useState(0);
  const [paidInput, setPaidInput] = useState(0);
  const [accountId, setAccountId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<(typeof methods)[number]>("cash");
  const [note, setNote] = useState("");
  const [supplierForm, setSupplierForm] = useState({ name: "", address: "", phone: "", email: "" });
  const [paymentTarget, setPaymentTarget] = useState<Purchase | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentAccount, setPaymentAccount] = useState("");

  const load = useCallback(async (signal?:AbortSignal) => {
    const requestId=++listRequest.current;
    if(!hasPermission("purchase:read")){setPurchases([]);setLoading(false);return;}
    const filterError=saleFilterError(startDate,endDate,minAmount,maxAmount);if(filterError){setPurchases([]);setPagination({total:0,page:1,limit:20,totalPages:1});setError(filterError);setLoading(false);return;}
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (branchId) params.set("branchId", branchId);
    if (search.trim()) params.set("search", search.trim());
    if (statusFilter) params.set("status", statusFilter);
    if (paymentFilter) params.set("paymentStatus", paymentFilter);
    if (supplierFilter) params.set("supplierId", supplierFilter);
    if (poNumber.trim()) params.set("poNumber", poNumber.trim());
    if (typeFilter) params.set("type", typeFilter);
    if (methodFilter) params.set("paymentMethod", methodFilter);
    if (minAmount) params.set("minAmount", minAmount);
    if (maxAmount) params.set("maxAmount", maxAmount);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    try {
      const [purchaseResponse, supplierResult] = await Promise.allSettled([
        api.getWithMeta<unknown>(`/pharmacy/purchases?${params.toString()}`,{signal}),
        hasPermission("supplier:read")?api.get<unknown>(`/pharmacy/suppliers?page=1&limit=100${search.trim() && tab === "suppliers" ? `&search=${encodeURIComponent(search.trim())}` : ""}`,{signal}):Promise.resolve([]),
      ]);
      if(signal?.aborted||requestId!==listRequest.current)return;
      if(purchaseResponse.status!=="fulfilled")throw purchaseResponse.reason;
      const purchaseRows=list<Purchase>(purchaseResponse.value);setPurchases(purchaseRows);
      const meta=readPagination(purchaseResponse.value,purchaseRows.length,page,20);setPagination(meta);if(page>meta.totalPages)setPage(meta.totalPages);
      if(supplierResult.status==="fulfilled")setSuppliers(list<Supplier>(supplierResult.value));
      setError("");
    } catch (cause) { if(!signal?.aborted&&requestId===listRequest.current){setPurchases([]);setPagination({total:0,page:1,limit:20,totalPages:1});setError(errorText(cause));} }
    finally { if(!signal?.aborted&&requestId===listRequest.current)setLoading(false); }
  }, [hasPermission,branchId, endDate, methodFilter, minAmount, maxAmount, page, paymentFilter, poNumber, search, startDate, statusFilter, supplierFilter, tab, typeFilter]);

  useEffect(() => {
    let alive = true;
    async function init() {
      const results = await Promise.allSettled([
        hasPermission("supplier:read")?api.get<unknown>("/pharmacy/suppliers?page=1&limit=100"):Promise.resolve([]),
        hasPermission("account:read")?api.get<unknown>("/finance/accounts?page=1&limit=100&isActive=true"):Promise.resolve([]),
      ]);
      if (!alive) return;
      if (results[0].status === "fulfilled") setSuppliers(list<Supplier>(results[0].value));
      if (results[1].status === "fulfilled") { const options = list<Account>(results[1].value).filter((item) => ["cash", "bank", "mfs"].includes(item.type)); setAccounts(options); setAccountId(options.find((item) => item.type === "cash")?.id ?? options[0]?.id ?? ""); setPaymentAccount(options.find((item) => item.type === "cash")?.id ?? options[0]?.id ?? ""); }
    }
    void init();
    return () => { alive = false; };
  }, [hasPermission]);

  useEffect(() => { const controller=new AbortController();const timer = window.setTimeout(() => { void load(controller.signal); }, 150); return () => {window.clearTimeout(timer);controller.abort();}; }, [load]);
  useEffect(() => {
    if (!branchId) return;
    let active = true;
    api.get<unknown>(`/pharmacy/cash-register/active?branchId=${encodeURIComponent(branchId)}`)
      .then((session) => { if (active) setRegisterOpen(Boolean(session && typeof session === "object" && (session as Data).id)); })
      .catch(() => { if (active) setRegisterOpen(false); });
    return () => { active = false; };
  }, [branchId]);
  useEffect(() => {
    if (!queryMedicine.trim()) return;
    const controller=new AbortController();
    const timer = window.setTimeout(async () => {
      try { const result = await api.get<unknown>(`/pharmacy/medicines?page=1&limit=8&search=${encodeURIComponent(queryMedicine.trim())}&isActive=true`,{signal:controller.signal});if(!controller.signal.aborted)setMedicineResults(list<Medicine>(result)); }
      catch { if(!controller.signal.aborted)setMedicineResults([]); }
    }, 220);
    return () => {window.clearTimeout(timer);controller.abort();};
  }, [queryMedicine]);

  const {subtotal,discount,total,paid,due}=useMemo(()=>purchaseTotals(items,discountMode,discountInput,paidInput),[items,discountMode,discountInput,paidInput]);
  const stats = useMemo(() => ({ total: purchases.length, pending: purchases.filter((p) => p.status === "pending").length, due: purchases.filter((p) => n(p.dueAmount) > 0).length, spend: purchases.reduce((sum, p) => sum + n(p.totalPrice), 0) }), [purchases]);

  function addMedicine(medicine: Medicine) {
    setItems((current) => {
      const existing = current.find((item) => item.medicineId === medicine.id && !item.batchNumber);
      if (existing) return current;
      return [...current, { medicineId: medicine.id, itemName: medicine.name, itemDescription: [medicine.genericName, medicine.strength].filter(Boolean).join(" · ") || undefined, unit: medicine.unit || "Pcs", price: n(medicine.purchasePrice), salePrice: n(medicine.salePrice), mrp: n(medicine.mrp), quantity: 1, batchNumber: "", expiryDate: "", rackNumber: "" }];
    });
    setQueryMedicine(""); setMedicineResults([]);
  }
  function patchItem(index: number, patch: Partial<PurchaseItem>) { setItems((current) => current.map((item, i) => i === index ? { ...item, ...patch } : item)); }
  function resetPurchase() { if(mutationLock.current)return;setNewPurchase(false); setItems([]); setSupplierId(""); setDiscountInput(0); setPaidInput(0); setNote(""); setError(""); }

  async function createPurchase(status:"pending"|"completed"){
    if(mutationLock.current)return;
    setError("");setNotice("");
    if(!hasPermission("purchase:create")){setError("Your role cannot create purchases.");return;}
    if(!branchId||branchId!==draftBranch||!supplierId){setError("Choose the purchase branch and supplier. Reopen the draft if the active branch changed.");return;}
    const problem=purchaseDraftError(items,discountMode,discountInput,paidInput,accountId);if(problem){setError(problem);return;}
    mutationLock.current=true;setSaving(true);
    try{
      const session=await api.get<Data|null>(`/pharmacy/cash-register/active?branchId=${encodeURIComponent(draftBranch)}`);
      if(!session?.id){setRegisterOpen(false);setRegisterDialog(true);setError("Open the branch cash register before creating a purchase.");return;}
      if(currentBranch.current!==draftBranch)throw new Error("The active branch changed. Reopen the purchase draft.");
      const created=await api.post<Purchase>("/pharmacy/purchases",{branchId:draftBranch,supplierId,type:"pharmacy",status,discountPercentage:subtotal>0?discount/subtotal*100:0,discountAmount:discount,paymentMethod,paidAmount:paid,dueAmount:due,paymentStatus:due<=0?"paid":paid>0?"partial":"due",...(paid>0?{payments:[{accountId,amount:paid,paymentMethod}]}:{}),note:note.trim()||undefined,purchaseItems:items.map(item=>({...item,batchNumber:item.batchNumber.trim(),expiryDate:new Date(`${item.expiryDate}T12:00:00+06:00`).toISOString()}))});
      setNewPurchase(false);setItems([]);setSupplierId("");setDiscountInput(0);setPaidInput(0);setNote("");setQueryMedicine("");setMedicineResults([]);
      if(currentBranch.current===draftBranch)await load();setNotice(status==="completed"?`Purchase ${created.poNumber||""} received. Check its posted batches.`:`Purchase ${created.poNumber||""} saved as pending. Receive it when the goods arrive.`);
    }catch(cause){setError(errorText(cause));}finally{mutationLock.current=false;setSaving(false);}
  }
  async function openPurchase(purchase:Purchase){
    if(!hasPermission("purchase:read"))return;const requestId=++detailRequest.current;setError("");
    try{const detail=await api.get<Purchase>(`/pharmacy/purchases/${encodeURIComponent(purchase.id)}`);if(requestId===detailRequest.current)setSelected(detail);}catch(cause){if(requestId===detailRequest.current)setError(errorText(cause));}
  }
  async function changePurchaseStatus(purchase:Purchase,status:"completed"|"rejected"){
    if(mutationLock.current||!hasPermission("purchase:update"))return;
    if(!window.confirm(status==="completed"?"Receive this purchase and post its batches to inventory?":"Reject this pending purchase? Review any existing supplier payments separately."))return;
    mutationLock.current=true;setSaving(true);setError("");
    try{const fresh=await api.get<Purchase>(`/pharmacy/purchases/${encodeURIComponent(purchase.id)}`);setSelected(fresh);if(fresh.status!=="pending")throw new Error("This purchase is no longer pending. Refresh its details.");await api.patch(`/pharmacy/purchases/${encodeURIComponent(fresh.id)}/status`,{status});setSelected(null);await load();setNotice(status==="completed"?"Purchase received. Verify the posted batch quantities.":"Pending purchase rejected.");}catch(cause){setError(errorText(cause));}finally{mutationLock.current=false;setSaving(false);}
  }
  async function receivePurchase(purchase:Purchase){return changePurchaseStatus(purchase,"completed");}
  async function recordPayment(){
    if(mutationLock.current||!paymentTarget)return;
    if(!hasPermission("purchase:update")||!hasPermission("account:read")){setError("Your role cannot record supplier payments.");return;}
    const problem=purchasePaymentError(paymentTarget,paymentAmount,paymentAccount);if(problem){setError(problem);return;}
    mutationLock.current=true;setSaving(true);setError("");
    try{const fresh=await api.get<Purchase>(`/pharmacy/purchases/${encodeURIComponent(paymentTarget.id)}`);setPaymentTarget(fresh);const changed=purchasePaymentError(fresh,paymentAmount,paymentAccount);if(changed){setError(changed);return;}const updated=await api.post<Purchase>(`/pharmacy/purchases/${encodeURIComponent(fresh.id)}/payments`,{accountId:paymentAccount,amount:Number(paymentAmount),paymentMethod,...(paymentNote.trim()?{note:paymentNote.trim()}:{})});setPaymentTarget(null);setSelected(updated);setPaymentAmount("");setPaymentNote("");await load();setNotice(`Supplier payment recorded.${updated.dueAmount!=null?` Remaining due: ${taka(n(updated.dueAmount))}.`:''}`);}catch(cause){setError(errorText(cause));}finally{mutationLock.current=false;setSaving(false);}
  }
  async function createSupplier() {
    if(mutationLock.current||!hasPermission("supplier:create"))return;
    const problem=supplierFormError(supplierForm);if(problem){setError(problem);return;}
    mutationLock.current=true;
    setSaving(true); setError("");
    try { const created = await api.post<Supplier>("/pharmacy/suppliers", Object.fromEntries(Object.entries(supplierForm).map(([key,value])=>[key,value.trim()]))); setSupplierForm({ name: "", address: "", phone: "", email: "" }); setNewSupplier(false); await load(); if (created.id) setSupplierId(created.id); setNotice("Supplier added to the directory."); }
    catch (cause) { setError(errorText(cause)); }
    finally { mutationLock.current=false; setSaving(false); }
  }
  async function openRegister() {
    if(mutationLock.current||!branchId||!hasPermission("sale:create"))return;
    if(!/^\d+(?:\.\d{1,2})?$/.test(openingCash)||!Number.isFinite(Number(openingCash))){setError("Enter a valid opening balance with at most two decimal places.");return;}
    mutationLock.current=true;
    setSaving(true); setError("");
    try { await api.post<unknown>("/pharmacy/cash-register/open", { branchId, openingBalance: Math.max(0, n(openingCash)) }); setRegisterOpen(true); setRegisterDialog(false); setNotice("Cash register session opened."); }
    catch (cause) { setError(errorText(cause)); }
    finally { mutationLock.current=false; setSaving(false); }
  }

  const filteredSuppliers = useMemo(() => suppliers, [suppliers]);
  function clearPurchaseFilters() {
    setPage(1); setSearch(""); setStatusFilter(""); setPaymentFilter(""); setSupplierFilter(""); setPoNumber(""); setTypeFilter(""); setMethodFilter("");
    setMinAmount(""); setMaxAmount(""); setStartDate(""); setEndDate("");
  }
  if(!hasPermission("purchase:read"))return <section className="purchase-page"><h1>Purchases</h1><div className="data-empty"><CircleAlert/><strong>Your role cannot view purchases.</strong></div></section>;

  return <section className="purchase-page">
    <div className="page-heading-row"><div><p className="eyebrow">PHARMACY · PROCUREMENT</p><h1>Suppliers &amp; purchases</h1><p className="page-subtitle">Manage supplier orders, stock receiving and outstanding payments.</p></div><div className="purchase-page-context"><span className={`purchase-register-pill ${registerOpen ? "open" : "closed"}`}><i/>{registerOpen ? "Register open" : "Register closed"}</span>{!registerOpen && hasPermission("sale:create") && <button className="purchase-open-register" onClick={() => setRegisterDialog(true)}>Open</button>}</div></div>
    {(error || notice) && <div className={`purchase-alert ${error ? "error" : "success"}`}>{error ? <CircleAlert size={15}/> : <Check size={15}/>}<span>{error || notice}</span><button onClick={() => { setError(""); setNotice(""); }} aria-label="Dismiss"><X size={14}/></button></div>}
    <nav className="data-tabs">{hasPermission("purchase:read")&&<button className={tab === "purchases" ? "selected" : ""} onClick={() => setTab("purchases")}><FilePlus2 size={15}/> Purchase orders</button>}{hasPermission("supplier:read")&&<button className={tab === "suppliers" ? "selected" : ""} onClick={() => setTab("suppliers")}><Truck size={15}/> Suppliers</button>}</nav>
    {tab === "purchases" ? <>
      <div className="purchase-metrics"><div><span className="purchase-metric-icon green"><FilePlus2 size={16}/></span><small>Orders matching filters</small><strong>{loading ? "—" : pagination.total}</strong></div><div><span className="purchase-metric-icon amber"><Clock3 size={16}/></span><small>Awaiting receipt · page</small><strong>{loading ? "—" : stats.pending}</strong></div><div><span className="purchase-metric-icon blue"><ArrowDownLeft size={16}/></span><small>Orders with dues · page</small><strong>{loading ? "—" : stats.due}</strong></div><div><span className="purchase-metric-icon slate"><Package size={16}/></span><small>Purchase value · page</small><strong>{loading ? "—" : taka(stats.spend)}</strong></div></div>
      <div className="purchase-card panel"><div className="purchase-toolbar"><div className="data-search"><Search size={16}/><input placeholder="Search PO, supplier or note…" value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }}/></div><select value={statusFilter} onChange={(event) => { setPage(1); setStatusFilter(event.target.value); }} aria-label="Filter by order status"><option value="">All statuses</option><option value="pending">Pending</option><option value="completed">Received</option><option value="rejected">Rejected</option></select><select value={paymentFilter} onChange={(event) => { setPage(1); setPaymentFilter(event.target.value); }} aria-label="Filter by payment status"><option value="">All payments</option><option value="due">Due</option><option value="partial">Partial</option><option value="paid">Paid</option></select><button className={`data-filter-button ${filtersOpen ? "selected" : ""}`} type="button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((open) => !open)}><Filter size={15}/> More filters</button>{hasPermission("purchase:create")&&<button className="purchase-primary-action" onClick={() => { setDraftBranch(branchId);setError(""); setNewPurchase(true); }}><Plus size={15}/> New purchase</button>}</div>
        {filtersOpen && <div className="purchase-filter-grid"><label>Supplier<select value={supplierFilter} onChange={(event) => { setPage(1); setSupplierFilter(event.target.value); }}><option value="">All suppliers</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label><label>Purchase type<select value={typeFilter} onChange={(event) => { setPage(1); setTypeFilter(event.target.value); }}><option value="">All types</option><option value="pharmacy">Pharmacy</option><option value="hospital">Hospital</option><option value="clinic">Clinic</option></select></label><label>Payment method<select value={methodFilter} onChange={(event) => { setPage(1); setMethodFilter(event.target.value); }}><option value="">All methods</option>{methods.map((method) => <option key={method}>{method}</option>)}</select></label><label>PO number<input value={poNumber} onChange={(event) => { setPage(1); setPoNumber(event.target.value); }} placeholder="Enter PO number"/></label><label>From date<input type="date" max={endDate || undefined} value={startDate} onChange={(event) => { setPage(1); setStartDate(event.target.value); }}/></label><label>To date<input type="date" min={startDate || undefined} value={endDate} onChange={(event) => { setPage(1); setEndDate(event.target.value); }}/></label><label>Minimum amount<input type="number" min="0" max={maxAmount || undefined} value={minAmount} onChange={(event) => { setPage(1); setMinAmount(event.target.value); }}/></label><label>Maximum amount<input type="number" min={minAmount || "0"} value={maxAmount} onChange={(event) => { setPage(1); setMaxAmount(event.target.value); }}/></label><button type="button" className="purchase-filter-clear" onClick={clearPurchaseFilters}>Clear filters</button></div>}
        <div className="purchase-list-head"><span>Order / supplier</span><span>Date / branch</span><span>Items</span><span>Amount</span><span>Status</span><span></span></div>
        {purchases.map((purchase) => <div className="purchase-row" key={purchase.id}><div className="purchase-main"><span className="purchase-row-icon"><FilePlus2 size={16}/></span><span><strong>{purchase.poNumber || `PO-${purchase.id.slice(0, 7)}`}</strong><small>{purchase.supplier?.name || "Supplier"}</small></span></div><div className="purchase-date"><strong>{new Date(purchase.createdAt).toLocaleDateString("en-GB")}</strong><small>{purchase.branch?.name || "Branch"}</small></div><span className="purchase-count">{purchase.purchaseItems?.length ?? 0} lines</span><div className="purchase-amount"><strong>{taka(n(purchase.totalPrice) - n(purchase.discountAmount))}</strong><small>{taka(n(purchase.dueAmount))} due</small></div><div className="purchase-statuses"><span className={`data-status ${statusClass(purchase.status)}`}>{purchase.status === "completed" ? "Received" : purchase.status}</span><span className={`data-status ${statusClass(purchase.paymentStatus)}`}>{purchase.paymentStatus}</span></div><button className="data-row-action" onClick={() => void openPurchase(purchase)} aria-label={`View ${purchase.poNumber || "purchase"}`}><ChevronRight size={16}/></button></div>)}
        {!loading && purchases.length === 0 && <div className="data-empty"><FilePlus2 size={22}/><strong>No purchase orders found</strong><span>Clear filters or create a purchase order.</span></div>}{loading && <div className="data-loading">Loading purchase history…</div>}
        {pagination.totalPages > 1 && <div className="purchase-pagination"><span>Showing page {pagination.page} of {pagination.totalPages} · {pagination.total.toLocaleString("en-BD")} orders</span><div><button type="button" disabled={loading || page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button><button type="button" disabled={loading || page >= pagination.totalPages} onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))}>Next</button></div></div>}
      </div>
    </> : <div className="purchase-card panel"><div className="purchase-toolbar"><div className="data-search"><Search size={16}/><input placeholder="Search supplier, phone or address…" value={search} onChange={(event) => setSearch(event.target.value)}/></div>{hasPermission("supplier:create")&&<button className="purchase-primary-action" onClick={() => { setError(""); setNewSupplier(true); }}><Plus size={15}/> Add supplier</button>}</div><div className="supplier-grid">{filteredSuppliers.map((supplier) => <article className="supplier-card" key={supplier.id}><span className="supplier-avatar"><Truck size={17}/></span><strong>{supplier.name}</strong><small>{supplier.phone || "No phone"}</small><small>{supplier.address || "No address on file"}</small><span className="supplier-email">{supplier.email || "Email not provided"}</span></article>)}</div>{!loading && suppliers.length === 0 && <div className="data-empty"><Truck size={22}/><strong>No suppliers found</strong><span>Add your first supplier to create a purchase order.</span></div>}{loading && <div className="data-loading">Loading suppliers…</div>}</div>}

    {newPurchase && <div className="purchase-backdrop" role="presentation" onClick={resetPurchase}><div className="purchase-drawer" role="dialog" aria-modal="true" aria-label="New purchase order" onClick={(event) => event.stopPropagation()}><div className="purchase-drawer-head"><div><p className="eyebrow">PROCUREMENT</p><h2>New purchase order</h2><p>Enter supplier batches and receiving prices.</p></div><button className="purchase-close" onClick={resetPurchase} aria-label="Close"><X size={18}/></button></div>
      {error && <div className="purchase-alert error"><AlertCircle size={15}/><span>{error}</span></div>}
      <div className="purchase-form-context"><label><span>Supplier</span><select value={supplierId} onChange={(event) => setSupplierId(event.target.value)}><option value="">Select supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name} · {supplier.phone || "no phone"}</option>)}</select></label>{hasPermission("supplier:create")&&<button className="supplier-inline-add" onClick={() => setNewSupplier(true)}>Add supplier</button>}</div>
      <div className="purchase-medicine-search"><Search size={16}/><input placeholder="Search medicine to add to order…" value={queryMedicine} onChange={(event) => setQueryMedicine(event.target.value)}/></div>
      {queryMedicine.trim() && medicineResults.length > 0 && <div className="purchase-medicine-results">{medicineResults.map((medicine) => <button key={medicine.id} onClick={() => addMedicine(medicine)}><span><strong>{medicine.name}</strong><small>{medicine.genericName || medicine.strength || medicine.unit}</small></span><span>{taka(n(medicine.purchasePrice))}<Plus size={15}/></span></button>)}</div>}
      <div className="purchase-items-list">{items.map((item, index) => <div className="purchase-item-card" key={`${item.medicineId}-${index}`}><div className="purchase-item-title"><span className="purchase-row-icon"><Package size={15}/></span><span><strong>{item.itemName}</strong><small>{item.itemDescription || item.unit}</small></span><button onClick={() => setItems((current) => current.filter((_, i) => i !== index))} aria-label={`Remove ${item.itemName}`}><X size={15}/></button></div><div className="purchase-item-grid"><label>Batch no.<input required value={item.batchNumber} onChange={(event) => patchItem(index, { batchNumber: event.target.value })} placeholder="e.g. B-1042"/></label><label>Expiry<input required type="date" value={item.expiryDate} onChange={(event) => patchItem(index, { expiryDate: event.target.value })}/></label><label>Quantity<input required type="number" min="1" step="1" value={item.quantity} onChange={(event) => patchItem(index, { quantity: Number(event.target.value) })}/></label><label>Unit cost<input type="number" min="0" step="0.01" value={item.price} onChange={(event) => patchItem(index, { price: Math.max(0, n(event.target.value)) })}/></label><label>Sale price<input type="number" min="0" step="0.01" value={item.salePrice} onChange={(event) => patchItem(index, { salePrice: Math.max(0, n(event.target.value)) })}/></label><label>MRP<input type="number" min="0" step="0.01" value={item.mrp} onChange={(event) => patchItem(index, { mrp: Math.max(0, n(event.target.value)) })}/></label><label className="rack-field">Rack<input value={item.rackNumber || ""} onChange={(event) => patchItem(index, { rackNumber: event.target.value })} placeholder="Optional"/></label><strong className="purchase-item-line-total">{taka(item.price * item.quantity)}</strong></div></div>)}{items.length === 0 && <div className="purchase-no-items"><Package size={20}/><span>Search and add medicines to this purchase.</span></div>}</div>
      <div className="purchase-summary"><div className="purchase-discount-controls"><span>Order discount</span><div><input type="number" min="0" max={discountMode === "percent" ? 100 : subtotal} value={discountInput} onChange={(event) => setDiscountInput(Number(event.target.value))}/><select value={discountMode} onChange={(event) => setDiscountMode(event.target.value as "percent" | "fixed")}><option value="percent">%</option><option value="fixed">BDT</option></select></div></div><div><span>Subtotal</span><strong>{taka(subtotal)}</strong></div><div><span>Discount</span><strong>−{taka(discount)}</strong></div><div className="purchase-grand-total"><span>Total payable</span><strong>{taka(total)}</strong></div><label className="purchase-payment-label">Paid now<span className="purchase-currency-input">৳<input type="number" min="0" max={total} value={paidInput} onChange={(event) => setPaidInput(Number(event.target.value))}/></span></label><div className="purchase-payment-row"><label>Account<select value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="">Select account</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.type}</option>)}</select></label><label>Method<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as (typeof methods)[number])}>{methods.map((method) => <option key={method}>{method}</option>)}</select></label></div><div className="purchase-outstanding"><span>Supplier due</span><strong>{taka(due)}</strong></div><label className="purchase-note-label">Order note<textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional reference or delivery note"/></label></div>
      <div className="purchase-drawer-actions">{hasPermission("purchase:create")&&<button className="purchase-save-pending" disabled={saving || items.length === 0} onClick={() => void createPurchase("pending")}>{saving ? "Saving…" : "Save pending"}</button>} {hasPermission("purchase:create")&&<button className="purchase-primary-action" disabled={saving || items.length === 0} onClick={() => void createPurchase("completed")}><Check size={15}/>{saving ? "Receiving…" : "Receive & post stock"}</button>}</div><p className={`purchase-register-note ${registerOpen ? "ready" : ""}`}><AlertCircle size={12}/>{registerOpen ? "Register is open. Purchases can be submitted." : "Open a cash register session before creating a purchase."}</p></div></div>}
    {newSupplier && <div className="purchase-backdrop" role="presentation" onClick={() => {if(!saving)setNewSupplier(false);}}><div className="supplier-dialog panel" role="dialog" aria-modal="true" aria-label="Add supplier" onClick={(event) => event.stopPropagation()}><button className="purchase-close" onClick={() => {if(!saving)setNewSupplier(false);}} aria-label="Close"><X size={18}/></button><span className="supplier-dialog-icon"><Truck size={19}/></span><h2>Add supplier</h2><p>Save contact details for purchase orders.</p><label>Supplier name<input value={supplierForm.name} onChange={(event) => setSupplierForm({ ...supplierForm, name: event.target.value })} placeholder="Company or supplier name"/></label><label>Phone<input inputMode="tel" value={supplierForm.phone} onChange={(event) => setSupplierForm({ ...supplierForm, phone: event.target.value })} placeholder="At least 10 digits"/></label><label>Address<input value={supplierForm.address} onChange={(event) => setSupplierForm({ ...supplierForm, address: event.target.value })} placeholder="Full address"/></label><label>Email <small>optional</small><input type="email" value={supplierForm.email} onChange={(event) => setSupplierForm({ ...supplierForm, email: event.target.value })} placeholder="supplier@example.com"/></label>{error && <div className="purchase-alert error">{error}</div>}<button className="purchase-primary-action full" disabled={saving||!hasPermission("supplier:create")} onClick={() => void createSupplier()}>{saving ? "Saving…" : "Save supplier"}</button></div></div>}
    {selected && <div className="purchase-backdrop" role="presentation" onClick={() => {if(!saving)setSelected(null);}}><div className="purchase-detail-drawer" role="dialog" aria-modal="true" aria-label="Purchase order details" onClick={(event) => event.stopPropagation()}><div className="purchase-drawer-head"><div><p className="eyebrow">PURCHASE ORDER</p><h2>{selected.poNumber || `PO-${selected.id.slice(0, 7)}`}</h2><p>{selected.supplier?.name || "Supplier"} · {new Date(selected.createdAt).toLocaleString("en-GB",{timeZone:"Asia/Dhaka"})}</p></div><button className="purchase-close" onClick={() => {if(!saving)setSelected(null);}} aria-label="Close"><X size={18}/></button></div><div className="purchase-detail-summary"><span><small>Order status</small><b className={`data-status ${statusClass(selected.status)}`}>{selected.status === "completed" ? "Received" : selected.status}</b></span><span><small>Payment state</small><b className={`data-status ${statusClass(selected.paymentStatus)}`}>{selected.paymentStatus}</b></span><span><small>Total</small><strong>{taka(n(selected.totalPrice)-n(selected.discountAmount))}</strong></span><span><small>Due</small><strong>{taka(n(selected.dueAmount))}</strong></span></div><h3 className="purchase-detail-title">Items · {selected.purchaseItems?.length ?? 0}</h3>{selected.purchaseItems?.map((item, i) => <div className="purchase-detail-item" key={`${item.medicineId}-${i}`}><span><strong>{item.itemName}</strong><small>Batch {item.batchNumber} · exp {new Date(item.expiryDate).toLocaleDateString("en-GB")}</small></span><span>{item.quantity} × {taka(item.price)}<small>{item.rackNumber || "No rack"}</small></span></div>)}{selected.transactions?.length ? <><h3 className="purchase-detail-title">Payment history · {selected.transactions.length}</h3>{selected.transactions.map(transaction => <div className="purchase-detail-item" key={transaction.id}><span><strong>{transaction.txnId || "Payment"}</strong><small>{new Date(transaction.createdAt).toLocaleString("en-GB",{timeZone:"Asia/Dhaka"})} · {transaction.paymentMethod || "—"}</small></span><span>{taka(n(transaction.amount))}<small>{transaction.note || "Supplier payment"}</small></span></div>)}</> : null}{selected.note && <p className="purchase-detail-note">{selected.note}</p>}{error&&<p className="purchase-alert error" role="alert">{error}</p>}{selected.status==="pending"&&hasPermission("purchase:update")&&<button className="purchase-save-pending" disabled={saving} onClick={()=>void changePurchaseStatus(selected,"rejected")}>Reject pending purchase</button>}{selected.status === "pending" && hasPermission("purchase:update") && <button className="purchase-primary-action full" disabled={saving} onClick={() => void receivePurchase(selected)}><Check size={15}/>{saving ? "Receiving…" : "Receive purchase & post stock"}</button>}{n(selected.dueAmount) > 0 && selected.status !== "rejected" && hasPermission("purchase:update") && <button className="purchase-pay-button" onClick={() => { setError("");setPaymentNote("");setPaymentTarget(selected); setPaymentAmount(""); setPaymentAccount(accountId); }}>Record supplier payment</button>}</div></div>}
    {paymentTarget && <div className="purchase-backdrop" role="presentation" onClick={() => {if(!saving)setPaymentTarget(null);}}><div className="supplier-dialog panel" role="dialog" aria-modal="true" aria-label="Record purchase payment" onClick={(event) => event.stopPropagation()}><button className="purchase-close" onClick={() => {if(!saving)setPaymentTarget(null);}} aria-label="Close"><X size={18}/></button><span className="supplier-dialog-icon"><ArrowDownLeft size={19}/></span><h2>Record supplier payment</h2><p>{paymentTarget.poNumber} · Outstanding {taka(n(paymentTarget.dueAmount))}</p><label>Amount<input disabled={saving} type="number" step="0.01" min="0.01" max={paymentTarget.dueAmount} value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} placeholder="0.00"/></label><label>Account<select value={paymentAccount} onChange={(event) => setPaymentAccount(event.target.value)}><option value="">Select account</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.type}</option>)}</select></label><label>Method<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as (typeof methods)[number])}>{methods.map((method) => <option key={method}>{method}</option>)}</select></label><button type="button" className="purchase-save-pending" disabled={saving} onClick={()=>setPaymentAmount(n(paymentTarget.dueAmount).toFixed(2))}>Pay full due</button><label>Payment note<textarea disabled={saving} rows={2} value={paymentNote} onChange={event=>setPaymentNote(event.target.value)}/></label>{error&&<p role="alert" className="purchase-alert error">{error}</p>}<button className="purchase-primary-action full" disabled={saving} onClick={() => void recordPayment()}>{saving ? "Saving…" : "Save payment"}</button></div></div>}
    {registerDialog && <div className="purchase-backdrop register-backdrop" role="presentation" onClick={() => {if(!saving)setRegisterDialog(false);}}><div className="supplier-dialog panel" role="dialog" aria-modal="true" aria-label="Open cash register" onClick={(event) => event.stopPropagation()}><button className="purchase-close" onClick={() => {if(!saving)setRegisterDialog(false);}} aria-label="Close"><X size={18}/></button><span className="supplier-dialog-icon"><Clock3 size={19}/></span><h2>Open cash register</h2><p>Purchases require an active cashier session for this branch.</p><label>Opening cash balance<input type="number" min="0" value={openingCash} onChange={(event) => setOpeningCash(event.target.value)}/></label>{error && <div className="purchase-alert error">{error}</div>}<button className="purchase-primary-action full" disabled={saving || !branchId || !hasPermission("sale:create")} onClick={() => void openRegister()}>{saving ? "Opening…" : "Open register"}</button></div></div>}
  </section>;
}
