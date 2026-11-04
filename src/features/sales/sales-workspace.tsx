"use client";

import { FilterPopover } from "@/components/ui/filter-popover";
import { Select } from "@/components/ui/select";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowDownLeft, Check, ChevronRight, CircleAlert, ClipboardList, CreditCard, FileText, RotateCcw, Search, ShieldAlert, X } from "lucide-react";
import { RecordFilter } from "@/components/record-filter";
import { api } from "@/lib/api/client";
import { readPagination } from "@/lib/api/pagination";
import { SaleReceipt } from "./sale-receipt";
import { duePaymentError, priorReturnQuantities, returnItemKey, returnQuantityError, lineReturnLimit, saleFilterError, hasReturnHistoryList } from "./sales-policy";
import { useAuth } from "@/components/providers/auth-provider";
import { useLanguage } from "@/lib/i18n/language-provider";
import { useActiveBranch } from "@/components/providers/active-branch-provider";

type Data = Record<string, unknown>;
type Account = { id: string; name: string; type: string };
type SaleLine = { id: string; medicineId?: string | null; serviceId?: string | null; itemName: string; itemDescription?: string | null; unit: string; price: number; mrp: number; quantity: number; discountPercentage?: number; discountAmount?: number; totalPrice?: number; batchNumber?: string | null; expiryDate?: string | null };
type Sale = { id: string; invoiceNumber: string; branchId: string; branch?: { id?: string; name: string }; customerId: string; customer?: { id?: string; name: string; phone?: string; customerNumber?: string }; type: string; status: string; paymentStatus: string; paymentMethod: string; totalPrice: number; netPrice: number; paidAmount: number; dueAmount: number; discountAmount: number; taxAmount: number; createdAt: string; createdBy?: string; note?: string; saleItems: SaleLine[] };
type SaleReturn = { id: string; saleId: string; sale?: { id: string; invoiceNumber: string }; invoiceNumber?: string; branchId: string; branch?: { id?: string; name?: string }; customer?: { name: string; phone?: string }; status: string; type?: string; totalPrice: number; createdAt: string; note?: string; saleReturnItems: SaleLine[] };
type Mode = "sales" | "returns";
const methods = ["cash", "card", "online", "cheque", "bKash", "Nagad", "Rocket", "Bank Transfer"] as const;
function list<T>(value: unknown): T[] { if (Array.isArray(value)) return value as T[]; if (value && typeof value === "object") { const obj = value as Data; if ("data" in obj) return list<T>(obj.data); for (const key of ["sales", "returns", "data", "branches", "accounts", "saleReturnItems"]) if (key in obj) return list<T>(obj[key]); } return []; }
function amount(v: unknown) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function apiDateBoundary(date: string, edge: "start" | "end") { return new Date(`${date}T${edge === "start" ? "00:00:00.000" : "23:59:59.999"}+06:00`).toISOString(); }
function err(error: unknown) { return error instanceof Error ? error.message : "Could not complete this request. Please try again."; }
function badge(status: string) { return status === "completed" || status === "paid" ? "good" : status === "partial" || status === "pending" ? "warn" : status === "due" || status === "returned" ? "soon" : "danger"; }
const pagination = readPagination;

export function SalesWorkspace({ mode }: { mode: Mode }) {
  const { hasPermission } = useAuth();
  const { activeBranchId: branchId } = useActiveBranch();
  const { t, language } = useLanguage();
  const bdt=(v:number)=>new Intl.NumberFormat(language==="bn"?"bn-BD":"en-BD",{style:"currency",currency:"BDT",maximumFractionDigits:2}).format(v||0);
  const locale=language==="bn"?"bn-BD":"en-GB";
  const dateTime=(value:string,dateOnly=false)=>new Date(value).toLocaleString(locale,{timeZone:"Asia/Dhaka",dateStyle:"medium",...(dateOnly?{}:{timeStyle:"short" as const})});
  const canReadSales = hasPermission("sale:read");
  const mutationLock = useRef(false);
  const listRequest = useRef(0);
  const detailRequest = useRef(0);
  const canReadReturns = hasPermission("sale-return:read");
  const canCreateReturn = hasPermission("sale-return:create");
  const canUpdateReturn = hasPermission("sale-return:update");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [returns, setReturns] = useState<SaleReturn[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [method, setMethod] = useState("");
  const [saleType, setSaleType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [invoiceFilter,setInvoiceFilter]=useState("");
  const [relatedFilters,setRelatedFilters]=useState<Record<string,string>>({});
  const [page, setPage] = useState(1);
  const [pageInfo, setPageInfo] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [reprintSale, setReprintSale] = useState<Sale | null>(null);
  const [selectedReturn, setSelectedReturn] = useState<SaleReturn | null>(null);
  const [paySale, setPaySale] = useState<Sale | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [refundAccountId, setRefundAccountId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<(typeof methods)[number]>("cash");
  const [returnQuery, setReturnQuery] = useState("");
  const [returnCandidate, setReturnCandidate] = useState<Sale | null>(null);
  const [returnedQuantities, setReturnedQuantities] = useState<Record<string, number>>({});
  const [returnQty, setReturnQty] = useState<Record<string, number>>({});
  const [returnNote, setReturnNote] = useState("");
  const [returnStatus, setReturnStatus] = useState<"pending" | "completed">("pending");
  const [returnListSearch, setReturnListSearch] = useState("");
  const [returnType, setReturnType] = useState("");
  const [returnStartDate, setReturnStartDate] = useState("");
  const [returnEndDate, setReturnEndDate] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    const requestId = ++listRequest.current;
    if ((mode === "returns" && !canReadReturns) || (mode === "sales" && !canReadSales)) {
      setReturns([]); setPageInfo({ total: 0, page: 1, limit: 20, totalPages: 1 }); setLoading(false); return;
    }
    const filterProblem = mode === "sales" ? saleFilterError(startDate,endDate,minAmount,maxAmount) : saleFilterError(returnStartDate,returnEndDate,"","");
    if(filterProblem){setError(filterProblem);setSales([]);setReturns([]);setPageInfo({total:0,page:1,limit:20,totalPages:1});setLoading(false);return;}
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (branchId) params.set("branchId", branchId);
    if (search.trim()) params.set("search", search.trim());
    if (status) params.set("status", status);
    if (paymentStatus) params.set("paymentStatus", paymentStatus);
    if (method) params.set("paymentMethod", method);
    if (saleType) params.set("type", saleType);
    if (startDate) params.set("startDate", apiDateBoundary(startDate, "start"));
    if (endDate) params.set("endDate", apiDateBoundary(endDate, "end"));
    if (minAmount) params.set("minAmount", minAmount);
    if (maxAmount) params.set("maxAmount", maxAmount);
    if(invoiceFilter.trim())params.set("invoiceNumber",invoiceFilter.trim());
    for(const [key,value] of Object.entries(relatedFilters))if(value.trim())params.set(key,value.trim());
    const returnParams = new URLSearchParams({ page: String(page), limit: "20" });
    if (branchId) returnParams.set("branchId", branchId);
    if (returnListSearch.trim()) returnParams.set("search", returnListSearch.trim());
    if (status) returnParams.set("status", status);
    if (returnType) returnParams.set("type", returnType);
    if (returnStartDate) returnParams.set("startDate", apiDateBoundary(returnStartDate, "start"));
    if (returnEndDate) returnParams.set("endDate", apiDateBoundary(returnEndDate, "end"));
    const endpoint = mode === "sales" ? `/sales?${params.toString()}` : `/sales/returns?${returnParams.toString()}`;
    try {
      const result = await api.getWithMeta<unknown>(endpoint,{signal});
      if(signal?.aborted || requestId!==listRequest.current)return;
      const rows = mode === "sales" ? list<Sale>(result) : list<SaleReturn>(result);
      if (mode === "sales") setSales(rows as Sale[]); else setReturns(rows as SaleReturn[]);
      const nextPageInfo=pagination(result,rows.length,page);setPageInfo(nextPageInfo);if(page>nextPageInfo.totalPages)setPage(nextPageInfo.totalPages);setError("");
    } catch (cause) { if(!signal?.aborted&&requestId===listRequest.current){setSales([]);setReturns([]);setPageInfo({total:0,page:1,limit:20,totalPages:1});setError(err(cause));} }
    finally { if(!signal?.aborted&&requestId===listRequest.current)setLoading(false); }
  }, [branchId, canReadReturns, canReadSales, endDate, method, minAmount, maxAmount, mode, page, paymentStatus, returnEndDate, returnListSearch, returnStartDate, returnType, saleType, search, startDate, status, invoiceFilter, relatedFilters]);

  useEffect(() => {
    let live = true;
    async function loadOptions() {
      const accountResult = await Promise.allSettled([hasPermission("account:read") ? api.get<unknown>("/finance/accounts?page=1&limit=100&isActive=true") : Promise.resolve([])]).then(([result]) => result);
      if (!live) return;
      if (accountResult.status === "fulfilled") { const rows = list<Account>(accountResult.value).filter((a) => ["cash", "bank", "mfs"].includes(a.type)); setAccounts(rows); setAccountId(rows.find((a) => a.type === "cash")?.id ?? rows[0]?.id ?? ""); }
    }
    void loadOptions();
    return () => { live = false; };
  }, [hasPermission]);
  useEffect(() => { const controller=new AbortController(); const timer = window.setTimeout(() => { void load(controller.signal); }, 130); return () => {window.clearTimeout(timer);controller.abort();}; }, [load]);

  const salesStats = useMemo(() => ({ count: pageInfo.total, paid: sales.filter((s) => s.paymentStatus === "paid").length, outstanding: sales.reduce((sum, s) => sum + amount(s.dueAmount), 0), total: sales.reduce((sum, s) => sum + amount(s.netPrice), 0) }), [pageInfo.total, sales]);
  const returnStats = useMemo(() => ({ pending: returns.filter((item) => item.status === "pending").length, processed: returns.filter((item) => item.status === "completed").reduce((sum, item) => sum + amount(item.totalPrice), 0), rejected: returns.filter((item) => item.status === "rejected").length }), [returns]);
  async function openSale(sale: Sale) {
    if(!canReadSales)return;
    const requestId=++detailRequest.current;setError("");
    try { const detail = await api.get<Sale>(`/sales/${encodeURIComponent(sale.id)}`); if(requestId===detailRequest.current)setSelectedSale(detail); }
    catch (cause) { if(requestId===detailRequest.current)setError(err(cause)); }
  }
  async function submitPayment() {
    if(mutationLock.current||!paySale)return;
    if(!canReadSales||!hasPermission("sale:update")||!hasPermission("account:read")){setError("Your role cannot collect sale payments.");return;}
    const problem=duePaymentError(paySale,payAmount,accountId);if(problem){setError(problem);return;}
    mutationLock.current=true;setSaving(true);setError("");
    try {
      const fresh=await api.get<Sale>(`/sales/${encodeURIComponent(paySale.id)}`);
      setPaySale(fresh);
      const currentProblem=duePaymentError(fresh,payAmount,accountId);if(currentProblem){setError(currentProblem);return;}
      const updated=await api.post<Sale>(`/sales/${encodeURIComponent(fresh.id)}/payments`,{accountId,amount:Number(payAmount),paymentMethod,...(paymentNote.trim()?{note:paymentNote.trim()}:{})});
      setPaySale(null);setPayAmount("");setPaymentNote("");await load();
      setNotice(`Payment recorded for ${fresh.invoiceNumber}.${updated.dueAmount!=null?` Remaining due: ${bdt(amount(updated.dueAmount))}.`:''}`);
    }catch(cause){setError(err(cause));}finally{mutationLock.current=false;setSaving(false);}
  }
  async function updatePendingSaleStatus(sale: Sale, next: "completed" | "rejected") {
    if(mutationLock.current||!hasPermission("sale:update")||!canReadSales)return;
    const message = next === "completed"
      ? "Complete this sale? This will deduct stock for POS items and update its cash register session."
      : "Reject this pending sale? This cannot be reversed from this screen.";
    if (!window.confirm(message)) return;
    mutationLock.current=true;setSaving(true); setError("");
    try { const fresh=await api.get<Sale>(`/sales/${encodeURIComponent(sale.id)}`);setSelectedSale(fresh);if(fresh.status!=="pending")throw new Error("This invoice status has changed. Refresh it first.");await api.patch<unknown>(`/sales/${encodeURIComponent(sale.id)}`, { status: next }); setSelectedSale(null); await load(); setNotice(next === "completed" ? `Sale ${sale.invoiceNumber} completed.` : `Sale ${sale.invoiceNumber} rejected.`); }
    catch (cause) { setError(err(cause)); }
    finally { mutationLock.current=false;setSaving(false); }
  }
  async function lookupReturnSale() {
    if (!returnQuery.trim()||saving) return;
    if(!canReadSales||!canReadReturns||!canCreateReturn){setError("Invoice and return-history access are required to prepare a return.");return;}
    setError(""); setSaving(true);
    try {
      const params = new URLSearchParams({ search: returnQuery.trim(), page: "1", limit: "10" });
      if (branchId) params.set("branchId", branchId);
      const exactParams=new URLSearchParams({invoiceNumber:returnQuery.trim(),page:"1",limit:"2"});if(branchId)exactParams.set("branchId",branchId);
      let matches=list<Sale>(await api.get<unknown>(`/sales?${exactParams}`));
      if(!matches.length)matches=list<Sale>(await api.get<unknown>(`/sales?${params}`));
      const exact = matches.find((sale) => (sale.invoiceNumber??"").toLowerCase() === returnQuery.trim().toLowerCase());
      if (exact) await loadReturnCandidate(exact);
      else if (matches.length === 1) await loadReturnCandidate(matches[0]);
      else { setError(matches.length ? "More than one sale matched. Refine the invoice/customer search." : "No sale matched that invoice or customer."); }
    } catch (cause) { setError(err(cause)); }
    finally { setSaving(false); }
  }
  async function returnHistory(saleId:string) {
    const history:SaleReturn[]=[];let totalPages=1;let totalExpected=0;
    for(let page=1;page<=totalPages;page++){
      const result=await api.getWithMeta<unknown>(`/sales/returns?saleId=${encodeURIComponent(saleId)}&page=${page}&limit=100`);
      if(!hasReturnHistoryList(result))throw new Error("Return history could not be read. Refresh before continuing.");
      const items=list<SaleReturn>(result);
      if(items.some(item=>item.saleId!==saleId))throw new Error("The return history does not match this invoice.");
      const meta=pagination(result,items.length,page,100);totalExpected=meta.total;
      history.push(...items);totalPages=meta.totalPages;
      if(totalPages>1000)throw new Error("This invoice has too much return history to validate here.");
    }
    if(history.length<totalExpected||new Set(history.map(item=>item.id)).size!==history.length)throw new Error("The full return history could not be verified. Refresh before continuing.");
    return history;
  }
  async function loadReturnCandidate(sale:Sale){
    if(!canReadSales||!canReadReturns)throw new Error("Invoice and return-history access are required to prepare a return.");
    const [detail,history]=await Promise.all([api.get<Sale>(`/sales/${encodeURIComponent(sale.id)}`),returnHistory(sale.id)]);
    if(!["completed","returned"].includes(detail.status))throw new Error("Returns can only be prepared for completed or previously returned invoices.");
    const previous=priorReturnQuantities(history);
    setReturnQty(Object.fromEntries((detail.saleItems??[]).map(item=>[item.id,0])));
    setReturnedQuantities(previous);setReturnNote("");setReturnStatus("pending");setRefundAccountId("");
    setReturnCandidate(detail);
  }
  async function startReturn(sale: Sale) {
    setSelectedSale(null); setSaving(true); setError("");
    try { await loadReturnCandidate(sale); }
    catch (cause) { setError(err(cause)); }
    finally { setSaving(false); }
  }
  async function submitReturn() {
    if(mutationLock.current||!returnCandidate)return;
    if(!canCreateReturn||!canReadReturns||!canReadSales){setError("Your role cannot prepare a verified return.");return;}
    const selected=(returnCandidate.saleItems??[]).filter(item=>amount(returnQty[item.id])>0).map(item=>({...item,quantity:amount(returnQty[item.id])}));
    const problem=returnQuantityError(returnCandidate.saleItems??[],selected,returnedQuantities,true);if(problem){setError(problem);return;}
    if(returnStatus==="completed"&&!window.confirm("Complete this return? Stock may be restored and the original invoice due reduced before any cash refund."))return;
    mutationLock.current=true;setSaving(true);setError("");
    try{
      const [fresh,history]=await Promise.all([api.get<Sale>(`/sales/${encodeURIComponent(returnCandidate.id)}`),returnHistory(returnCandidate.id)]);
      if(!["completed","returned"].includes(fresh.status))throw new Error("This invoice is no longer eligible for a return. Refresh it first.");
      const previous=priorReturnQuantities(history);setReturnedQuantities(previous);
      const freshSelected=selected.map(item=>{const original=fresh.saleItems?.find(line=>line.id===item.id);if(!original)throw new Error("An invoice line changed. Reopen the invoice before returning it.");return {...original,quantity:item.quantity};});
      const changed=returnQuantityError(fresh.saleItems??[],freshSelected,previous,true);if(changed){setError(changed);return;}
      const result=await api.post<SaleReturn>("/sales/returns",{
        saleId:fresh.id,status:returnStatus,note:returnNote.trim()||undefined,
        ...(returnStatus==="completed"&&refundAccountId?{accountId:refundAccountId}:{}),
        saleReturnItems:freshSelected.map(item=>({medicineId:item.medicineId,serviceId:item.serviceId,itemName:item.itemName,itemDescription:item.itemDescription||undefined,unit:item.unit,price:amount(item.price),mrp:amount(item.mrp),quantity:item.quantity,batchNumber:item.batchNumber||undefined,expiryDate:item.expiryDate||undefined})),
      });
      setReturnCandidate(null);setReturnQuery("");setReturnNote("");setReturnQty({});setRefundAccountId("");await load();
      setNotice(returnStatus==="completed"?`Return completed.${result.totalPrice!=null?` Return value: ${bdt(amount(result.totalPrice))}.`:''} Check the invoice for due reduction and any refund.`:"Return request saved for review.");
    }catch(cause){setError(err(cause));}finally{mutationLock.current=false;setSaving(false);}
  }
  async function openReturn(item:SaleReturn){
    if(!canReadReturns)return;
    const requestId=++detailRequest.current;setError("");
    try{const fresh=await api.get<SaleReturn>(`/sales/returns/${encodeURIComponent(item.id)}`);if(requestId===detailRequest.current)setSelectedReturn({...item,...fresh});}catch(cause){if(requestId===detailRequest.current)setError(err(cause));}
  }
  async function updateReturnStatus(item:SaleReturn,next:"completed"|"rejected"){
    if(mutationLock.current)return;
    if(!canUpdateReturn||!canReadReturns){setError("Your role cannot review returns.");return;}
    if(next==="completed"&&!canReadSales){setError("Invoice access is required to verify this return before approval.");return;}
    if(!window.confirm(next==="completed"?"Approve this return? Inventory may change and existing due is reduced before any cash refund.":"Reject this pending return request?"))return;
    mutationLock.current=true;setSaving(true);setError("");
    try{
      const fresh=await api.get<SaleReturn>(`/sales/returns/${encodeURIComponent(item.id)}`);
      setSelectedReturn({...item,...fresh});
      if(fresh.status!=="pending")throw new Error("This return has already been reviewed. Refresh the list.");
      if(next==="completed"){
        if(!fresh.saleId)throw new Error("The return is missing its original invoice reference.");
        const [sale,history]=await Promise.all([api.get<Sale>(`/sales/${encodeURIComponent(fresh.saleId)}`),returnHistory(fresh.saleId)]);
        if(!["completed","returned"].includes(sale.status))throw new Error("The original invoice is not eligible for return processing.");
        const problem=returnQuantityError(sale.saleItems??[],fresh.saleReturnItems??[],priorReturnQuantities(history,fresh.id));
        if(problem)throw new Error(problem);
      }
      await api.patch(`/sales/returns/${encodeURIComponent(fresh.id)}/status`,{status:next});setSelectedReturn(null);await load();setNotice(next==="completed"?"Return approved. Check the invoice settlement and refund transaction.":"Return request rejected.");
    }catch(cause){setError(err(cause));}finally{mutationLock.current=false;setSaving(false);}
  }

  if((mode==="sales"&&!canReadSales)||(mode==="returns"&&!canReadReturns))return <section className="sales-page"><h1>{t(mode==="sales"?"Sales history":"Sales returns")}</h1><div className="data-empty"><ShieldAlert/><strong>{t("Your role cannot view this page.")}</strong></div></section>;

  return <section className="sales-page">
    <div className="page-heading-row"><div><p className="eyebrow">{t("PHARMACY")} · {t(mode === "sales" ? "TRANSACTIONS" : "RETURNS")}</p><h1>{t(mode === "sales" ? "Sales history" : "Sales returns")}</h1><p className="page-subtitle">{t(mode === "sales" ? "Review invoices, payments and customer balances." : "Review return requests against the original invoice and sold batches.")}</p></div></div>
    {(error || notice) && <div className={`sales-alert ${error ? "error" : "success"}`} role={error?"alert":"status"}>{error ? <CircleAlert size={15}/> : <Check size={15}/>}<span>{error || notice}</span><button onClick={() => { setError(""); setNotice(""); }} aria-label="Dismiss"><X size={14}/></button></div>}
    <nav className="data-tabs"><Link href="/sales" className={mode === "sales" ? "selected" : ""}><ClipboardList size={15}/> {t("Sales")}</Link>{hasPermission("sale-return:read") && <Link href="/returns" className={mode === "returns" ? "selected" : ""}><RotateCcw size={15}/> {t("RETURNS")}</Link>}</nav>
    {mode === "sales" ? <>
      <div className="sales-metrics"><div><span className="sales-metric-icon green"><FileText size={16}/></span><small>{t("Invoices matched")}</small><strong>{loading ? "—" : salesStats.count}</strong></div><div><span className="sales-metric-icon blue"><CreditCard size={16}/></span><small>{t("Paid this page")}</small><strong>{loading ? "—" : salesStats.paid}</strong></div><div><span className="sales-metric-icon amber"><ArrowDownLeft size={16}/></span><small>{t("Due shown")}</small><strong>{loading ? "—" : bdt(salesStats.outstanding)}</strong></div><div><span className="sales-metric-icon slate"><FileText size={16}/></span><small>{t("Sales value shown")}</small><strong>{loading ? "—" : bdt(salesStats.total)}</strong></div></div>
      <div className="sales-card panel"><div className="sales-toolbar"><div className="data-search"><Search size={16}/><input placeholder={t("Invoice, customer name, phone or number…")} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }}/></div><button aria-expanded={filtersOpen} className={`data-filter-button ${filtersOpen ? "selected" : ""}`} onClick={() => setFiltersOpen(!filtersOpen)}><Search size={14}/> {t("Filters")}</button></div>
        {filtersOpen && <FilterPopover className="sales-filter-drawer" onClose={() => setFiltersOpen(false)}>{hasPermission("customer:read")&&<RecordFilter label="Customer" endpoint="/customers" searchKey="name" value={relatedFilters.customerId||""} onChange={id=>{setPage(1);setRelatedFilters(f=>({...f,customerId:id}));}}/>}{branchId&&<RecordFilter label="Register session" endpoint={`/pharmacy/cash-register?branchId=${encodeURIComponent(branchId)}`} searchKey="" session value={relatedFilters.cashRegisterSessionId||""} onChange={id=>{setPage(1);setRelatedFilters(f=>({...f,cashRegisterSessionId:id}));}}/>}{["createdBy","updatedBy"].map(key=><label key={key}>{t(key==="createdBy"?"Created by":"Updated by")}<input value={relatedFilters[key]||""} placeholder={t("Username")} onChange={e=>{setPage(1);setRelatedFilters(f=>({...f,[key]:e.target.value}));}}/></label>)}<label>{t("Invoice number")}<input value={invoiceFilter} onChange={e=>{setInvoiceFilter(e.target.value);setPage(1);}} placeholder={t("Exact match")}/></label><label>{t("Status")}<Select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">{t("All")}</option><option value="completed">{t("Completed")}</option><option value="pending">{t("Pending")}</option><option value="rejected">{t("Rejected")}</option><option value="returned">{t("Returned")}</option></Select></label><label>{t("Sale type")}<Select value={saleType} onChange={(event) => { setSaleType(event.target.value); setPage(1); }}><option value="">{t("All types")}</option><option value="pos">POS</option></Select></label><label>{t("Payment")}<Select value={paymentStatus} onChange={(event) => { setPaymentStatus(event.target.value); setPage(1); }}><option value="">{t("All states")}</option><option value="paid">{t("Paid")}</option><option value="partial">{t("Partial")}</option><option value="due">{t("Due")}</option></Select></label><label>{t("Method")}<Select value={method} onChange={(event) => { setMethod(event.target.value); setPage(1); }}><option value="">{t("All methods")}</option>{methods.map((m) => <option key={m}>{m}</option>)}</Select></label><label>{t("From")}<input type="date" max={endDate || undefined} value={startDate} onChange={(event) => { setStartDate(event.target.value); setPage(1); }}/></label><label>{t("To")}<input type="date" min={startDate || undefined} value={endDate} onChange={(event) => { setEndDate(event.target.value); setPage(1); }}/></label><label>{t("Min total")}<input type="number" min="0" step="0.01" value={minAmount} onChange={(event) => { setMinAmount(event.target.value); setPage(1); }}/></label><label>{t("Max total")}<input type="number" min={minAmount || "0"} step="0.01" value={maxAmount} onChange={(event) => { setMaxAmount(event.target.value); setPage(1); }}/></label><button type="button" onClick={() => { setStatus(""); setPaymentStatus(""); setMethod(""); setSaleType(""); setStartDate(""); setEndDate(""); setMinAmount(""); setMaxAmount("");setInvoiceFilter("");setRelatedFilters({}); setPage(1); }}>{t("Clear filters")}</button></FilterPopover>}
        <div className="sales-table-head"><span>{t("Invoice / customer")}</span><span>{t("Date / branch")}</span><span>{t("Total / paid")}</span><span>{t("Payment")}</span><span>{t("Status")}</span><span></span></div>
        {sales.map((sale) => <div className="sales-row" key={sale.id}><button className="sales-invoice" onClick={() => void openSale(sale)}><span className="sales-row-icon"><FileText size={15}/></span><span><strong>{sale.invoiceNumber}</strong><small>{sale.customer?.name || "Customer"} · {sale.customer?.phone || "No phone"}</small></span></button><div className="sales-date"><strong>{dateTime(sale.createdAt)}</strong><small>{sale.branch?.name || "Branch"}</small></div><div className="sales-total"><strong>{bdt(amount(sale.netPrice))}</strong><small>{bdt(amount(sale.paidAmount))} paid · {bdt(amount(sale.dueAmount))} due</small></div><span className={`data-status ${badge(sale.paymentStatus)}`}>{sale.paymentStatus} · {sale.paymentMethod}</span><span className={`data-status ${badge(sale.status)}`}>{sale.status}</span><button className="data-row-action" onClick={() => void openSale(sale)} aria-label={`View invoice ${sale.invoiceNumber}`}><ChevronRight size={16}/></button></div>)}
        {!loading && sales.length === 0 && <div className="data-empty"><FileText size={22}/><strong>{t("No sales found")}</strong><span>{t("Change search or filter values and try again.")}</span></div>}{loading && <div className="data-loading">{t("Loading sales…")}</div>}
        <div className="sales-pagination"><span>{pageInfo.total ? `${(page-1)*pageInfo.limit+1}–${Math.min(page*pageInfo.limit,pageInfo.total)} of ${pageInfo.total}` : "No records"}</span><div><button disabled={page <= 1 || loading} onClick={() => setPage(page-1)}>Previous</button><span>Page {page} of {Math.max(1,pageInfo.totalPages)}</span><button disabled={page >= pageInfo.totalPages || loading} onClick={() => setPage(page+1)}>Next</button></div></div>
      </div>
    </> : <>
      {canCreateReturn && <div className="return-lookup panel"><div><span className="return-lookup-icon"><RotateCcw size={18}/></span><span><strong>{t("Start from an original sale")}</strong><small>{t("Search exact invoice number or customer name/phone.")}</small></span></div><div className="return-lookup-form"><div className="data-search"><Search size={16}/><input placeholder={t("Invoice number or customer…")} value={returnQuery} onChange={(event) => setReturnQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void lookupReturnSale(); }}/></div><button className="sales-primary-action" disabled={saving} onClick={() => void lookupReturnSale()}>{saving ? t("Searching…") : t("Find sale")}</button></div></div>}
      {!canReadReturns ? <div className="data-empty panel"><ShieldAlert size={22}/><strong>{t("Return access required")}</strong><span>{t("Your role cannot view return requests. Ask an administrator for sale-return:read access.")}</span></div> : <>
      <div className="sales-metrics return-metrics"><div><span className="sales-metric-icon amber"><RotateCcw size={16}/></span><small>{t("Return requests")}</small><strong>{loading ? "—" : pageInfo.total}</strong></div><div><span className="sales-metric-icon blue"><FileText size={16}/></span><small>{t("Pending on this page")}</small><strong>{loading ? "—" : returnStats.pending}</strong></div><div><span className="sales-metric-icon green"><CreditCard size={16}/></span><small>{t("Refunded on this page")}</small><strong>{loading ? "—" : bdt(returnStats.processed)}</strong></div><div><span className="sales-metric-icon slate"><X size={16}/></span><small>{t("Rejected on this page")}</small><strong>{loading ? "—" : returnStats.rejected}</strong></div></div>
      <div className="sales-card panel"><div className="sales-toolbar return-toolbar"><div className="data-search"><Search size={16}/><input placeholder={t("Search invoice, customer or phone…")} value={returnListSearch} onChange={(event) => { setReturnListSearch(event.target.value); setPage(1); }}/></div><FilterPopover className="return-filters"><label><span>{t("Status")}</span><Select className="sales-compact-select" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">{t("All return states")}</option><option value="pending">{t("Pending")}</option><option value="completed">{t("Completed")}</option><option value="rejected">{t("Rejected")}</option></Select></label><label><span>{t("Sale type")}</span><Select className="sales-compact-select" value={returnType} onChange={(event) => { setReturnType(event.target.value); setPage(1); }}><option value="">{t("All types")}</option><option value="pos">POS</option></Select></label><label><span>{t("From")}</span><input type="date" max={returnEndDate || undefined} value={returnStartDate} onChange={(event) => { setReturnStartDate(event.target.value); setPage(1); }}/></label><label><span>{t("To")}</span><input type="date" min={returnStartDate || undefined} value={returnEndDate} onChange={(event) => { setReturnEndDate(event.target.value); setPage(1); }}/></label><button type="button" className="return-clear-filters" onClick={() => { setStatus(""); setReturnType(""); setReturnStartDate(""); setReturnEndDate(""); setReturnListSearch(""); setPage(1); }}>{t("Clear filters")}</button></FilterPopover></div>
        <div className="sales-table-head return-table-head"><span>{t("Invoice / customer")}</span><span>{t("Requested")}</span><span>{t("Items")}</span><span>{t("Return value")}</span><span>{t("Status")}</span><span></span></div>
        {returns.map((item) => <div className="sales-row return-row" key={item.id}><button className="sales-invoice" onClick={() => void openReturn(item)}><span className="sales-row-icon return-icon"><RotateCcw size={15}/></span><span><strong>{item.sale?.invoiceNumber || item.invoiceNumber || t("Return request")}</strong><small>{item.customer?.name || t("Customer")} · {item.customer?.phone || t("No phone")}</small></span></button><div className="sales-date"><strong>{dateTime(item.createdAt,true)}</strong><small>{item.branch?.name || t("Branch")} · {item.type || t("Sale")}</small></div><span>{item.saleReturnItems?.reduce((sum,line)=>sum+amount(line.quantity),0) ?? 0} {t("units")}</span><strong className="return-amount">{bdt(amount(item.totalPrice))}</strong><span className={`data-status ${badge(item.status)}`}>{t(item.status.charAt(0).toUpperCase() + item.status.slice(1))}</span><button className="data-row-action" onClick={() => void openReturn(item)} aria-label={`${t("View return")} ${item.invoiceNumber || item.sale?.invoiceNumber || ""}`}><ChevronRight size={16}/></button></div>)}
        {!loading && returns.length === 0 && <div className="data-empty"><RotateCcw size={22}/><strong>{t("No return requests")}</strong><span>{t("Search an invoice above to start a return review.")}</span></div>}{loading && <div className="data-loading">{t("Loading return requests…")}</div>}
        <div className="sales-pagination"><span>{pageInfo.total ? `${(page-1)*pageInfo.limit+1}–${Math.min(page*pageInfo.limit,pageInfo.total)} ${t("of")} ${pageInfo.total}` : t("No records")}</span><div><button disabled={page<=1||loading} onClick={()=>setPage(page-1)}>{t("Previous")}</button><span>{t("Page")} {page} {t("of")} {Math.max(1,pageInfo.totalPages)}</span><button disabled={page>=pageInfo.totalPages||loading} onClick={()=>setPage(page+1)}>{t("Next")}</button></div></div>
      </div></>}
    </>}

    {reprintSale && <SaleReceipt sale={reprintSale} onClose={() => setReprintSale(null)} />}
    {selectedSale && <div className="sales-backdrop" role="presentation" onClick={() => {if(!saving)setSelectedSale(null);}}><div className="sales-detail-drawer sales-invoice-drawer" role="dialog" aria-modal="true" aria-label="Sale details" onClick={(event)=>event.stopPropagation()}><div className="sales-detail-head"><div><p className="eyebrow">INVOICE</p><h2>{selectedSale.invoiceNumber}</h2><p>{selectedSale.customer?.name} · {selectedSale.customer?.phone}</p></div><button className="purchase-close" disabled={saving} onClick={()=>{if(!saving)setSelectedSale(null);}} aria-label="Close"><X size={18}/></button></div><div className="sales-invoice-body"><div className="sales-detail-metrics"><span><small>Sale status</small><b className={`data-status ${badge(selectedSale.status)}`}>{selectedSale.status}</b></span><span><small>Payment</small><b className={`data-status ${badge(selectedSale.paymentStatus)}`}>{selectedSale.paymentStatus}</b></span><span><small>Net total</small><strong>{bdt(amount(selectedSale.netPrice))}</strong></span><span><small>Outstanding due</small><strong>{bdt(amount(selectedSale.dueAmount))}</strong></span></div><h3 className="sales-detail-title">Items · {selectedSale.saleItems?.length ?? 0}</h3>{selectedSale.saleItems?.map((item)=><div className="sales-detail-line" key={item.id}><span><strong>{item.itemName}</strong><small>{item.quantity} {item.unit} · Batch {item.batchNumber || "—"} · exp {item.expiryDate?new Date(item.expiryDate).toLocaleDateString("en-GB"):"—"}</small></span><b>{bdt(item.totalPrice == null ? amount(item.price)*amount(item.quantity)-amount(item.discountAmount) : amount(item.totalPrice))}</b></div>)}<div className="sales-detail-totals"><span>Subtotal <b>{bdt(amount(selectedSale.totalPrice))}</b></span><span>Discount <b>−{bdt(amount(selectedSale.discountAmount))}</b></span><span>Tax <b>{bdt(amount(selectedSale.taxAmount))}</b></span><span>Paid <b>{bdt(amount(selectedSale.paidAmount))}</b></span><strong>Due <b>{bdt(amount(selectedSale.dueAmount))}</b></strong></div>{error&&<p role="alert" className="pos-dialog-error">{error}</p>}</div><div className="sales-detail-actions"><button className="purchase-save-pending" onClick={() => setReprintSale(selectedSale)}>{t("Print receipt")}</button>{canCreateReturn && ["completed","returned"].includes(selectedSale.status) && <button disabled={!canReadReturns||saving} title={!canReadReturns?"Return-history access is required":undefined} className="purchase-save-pending" onClick={()=>void startReturn(selectedSale)}>Start return</button>}{selectedSale.status!=="rejected"&&amount(selectedSale.dueAmount)>0&&hasPermission("sale:update")&&hasPermission("account:read")&&<button className="sales-primary-action" onClick={()=>{setError("");setPaymentNote("");setPaySale(selectedSale);setPayAmount("");setSelectedSale(null);}}>Collect due</button>}{selectedSale.status==="pending"&&hasPermission("sale:update")&&<><button className="purchase-save-pending" disabled={saving} onClick={()=>void updatePendingSaleStatus(selectedSale,"rejected")}>Reject sale</button><button className="sales-primary-action" disabled={saving} onClick={()=>void updatePendingSaleStatus(selectedSale,"completed")}>{saving?"Updating…":"Complete sale"}</button></>}</div></div></div>}
    {paySale && <div className="sales-backdrop" role="presentation" onClick={()=>{if(!saving)setPaySale(null);}}><div className="supplier-dialog panel" role="dialog" aria-modal="true" aria-label="Collect sale due" onClick={event=>event.stopPropagation()}>
      <button className="purchase-close" disabled={saving} onClick={()=>setPaySale(null)} aria-label="Close"><X size={18}/></button><span className="supplier-dialog-icon"><CreditCard size={18}/></span><h2>{t("Collect outstanding due")}</h2><p>{paySale.invoiceNumber} · {t("Remaining")} {bdt(amount(paySale.dueAmount))}</p>
      <form onSubmit={event=>{event.preventDefault();void submitPayment();}}><fieldset disabled={saving} className="sales-action-fields">
        <label>{t("Amount")}<input type="number" step="0.01" min="0.01" max={paySale.dueAmount} required value={payAmount} onChange={event=>setPayAmount(event.target.value)} placeholder="0.00"/></label>
        <button type="button" className="purchase-save-pending" onClick={()=>setPayAmount(amount(paySale.dueAmount).toFixed(2))}>{t("Pay full due")}</button>
        <label>{t("Account")}<Select aria-label="Payment account" required value={accountId} onChange={event=>setAccountId(event.target.value)}><option value="">{t("Select account")}</option>{accounts.map(account=><option key={account.id} value={account.id}>{account.name} · {account.type}</option>)}</Select></label>
        <label>{t("Method")}<Select aria-label="Payment method" value={paymentMethod} onChange={event=>setPaymentMethod(event.target.value as (typeof methods)[number])}>{methods.map(method=><option key={method}>{method}</option>)}</Select></label>
        <label>{t("Payment note")}<textarea rows={2} value={paymentNote} onChange={event=>setPaymentNote(event.target.value)}/></label>
        {payAmount&&Number.isFinite(Number(payAmount))&&<p className="sales-action-summary">{t("Due after this payment")}: {bdt(Math.max(0,amount(paySale.dueAmount)-Number(payAmount)))}</p>}
        {error&&<p role="alert" className="pos-dialog-error">{error}</p>}
        <button type="submit" className="purchase-primary-action full" disabled={saving||!accounts.length}>{saving?t("Saving…"):t("Record payment")}</button>
      </fieldset></form>
    </div></div>}
    {returnCandidate && <div className="sales-backdrop" role="presentation" onClick={()=>{if(!saving)setReturnCandidate(null);}}><div className="sales-detail-drawer return-drawer" role="dialog" aria-modal="true" aria-label="Create sale return" onClick={event=>event.stopPropagation()}>
      <div className="sales-detail-head"><div><p className="eyebrow">RETURN REVIEW · {returnCandidate.invoiceNumber}</p><h2>{returnCandidate.customer?.name||"Customer"}</h2><p>{t("Check the sold batch and remaining return quantity.")}</p></div><button disabled={saving} className="purchase-close" onClick={()=>setReturnCandidate(null)} aria-label="Close"><X size={18}/></button></div>
      <div className="return-warning"><ShieldAlert size={15}/><span>{t("Pending requests reserve the return allowance. Check the original goods before confirming a return.")}</span></div>
      <fieldset disabled={saving} className="sales-action-fields"><div className="return-lines">{returnCandidate.saleItems?.map(item=>{
        const previous=returnedQuantities[returnItemKey(item)]??0;
        const remaining=lineReturnLimit(item,returnCandidate.saleItems,returnedQuantities,returnQty);
        return <div className="return-line" key={item.id}><div><strong>{item.itemName}</strong><small>{t("Sold")} {item.quantity} · {t("Previously requested for batch")} {previous}</small><small>{t("Batch")} {item.batchNumber||"—"} · {t("Available to select")} {remaining}</small></div><label>{t("Return qty")}<input aria-label={`Return quantity for ${item.itemName} (${item.batchNumber||item.id})`} type="number" min="0" step={item.medicineId?1:0.01} max={remaining} value={returnQty[item.id]??0} onChange={event=>setReturnQty(current=>({...current,[item.id]:Math.max(0,Math.min(remaining,amount(event.target.value)))}))}/></label><b>{bdt(amount(item.price)*amount(returnQty[item.id]))}</b></div>;
      })}</div>
      <label className="return-note-field">{t("Reason / notes")}<textarea rows={3} value={returnNote} onChange={event=>setReturnNote(event.target.value)} placeholder={t("Record the reason and item condition")}/></label>
      <label className="return-status-field">{t("Request state")}<Select aria-label="Return request state" value={returnStatus} onChange={event=>setReturnStatus(event.target.value as "pending"|"completed")}><option value="pending">{t("Pending review")}</option><option value="completed">{t("Complete now")}</option></Select></label>
      {returnStatus==="completed"&&hasPermission("account:read")&&<label>{t("Refund account")}<Select aria-label="Refund account" value={refundAccountId} onChange={event=>setRefundAccountId(event.target.value)}><option value="">{t("Use original payment account")}</option>{accounts.map(account=><option key={account.id} value={account.id}>{account.name} · {account.type}</option>)}</Select></label>}
      <p className="sales-action-summary">{t(returnStatus==="pending"?"Refund account is selected from the original payments when this request is approved.":"Existing due is reduced before any cash refund. Final settlement is shown after saving.")}</p>
      <div className="return-estimate"><span>{t("Original item value before return adjustments")}</span><strong>{bdt((returnCandidate.saleItems??[]).reduce((sum,item)=>sum+amount(item.price)*amount(returnQty[item.id]),0))}</strong></div>
      {error&&<p role="alert" className="pos-dialog-error">{error}</p>}
      <button className="purchase-primary-action full" disabled={saving} onClick={()=>void submitReturn()}>{saving?t("Saving…"):returnStatus==="completed"?t("Complete return"):t("Submit return request")}</button></fieldset>
    </div></div>}
    {selectedReturn && <div className="sales-backdrop" role="presentation" onClick={()=>{if(!saving)setSelectedReturn(null);}}><div className="sales-detail-drawer" role="dialog" aria-modal="true" aria-label="Return request details" onClick={(event)=>event.stopPropagation()}><div className="sales-detail-head"><div><p className="eyebrow">RETURN REQUEST · {selectedReturn.sale?.invoiceNumber||selectedReturn.invoiceNumber}</p><h2>{selectedReturn.customer?.name||"Customer"}</h2><p>{dateTime(selectedReturn.createdAt)}</p></div><button className="purchase-close" disabled={saving} onClick={()=>{if(!saving)setSelectedReturn(null);}} aria-label="Close"><X size={18}/></button></div><div className="sales-detail-metrics"><span><small>Status</small><b className={`data-status ${badge(selectedReturn.status)}`}>{selectedReturn.status}</b></span><span><small>Return value</small><strong>{bdt(amount(selectedReturn.totalPrice))}</strong></span></div>{selectedReturn.saleReturnItems?.map((line)=><div className="sales-detail-line" key={line.id}><span><strong>{line.itemName}</strong><small>{line.quantity} {line.unit} · Batch {line.batchNumber}</small></span><b>{bdt(amount(line.totalPrice))}</b></div>)}<div className="sales-detail-totals"><span>{t("Item total")}<b>{bdt((selectedReturn.saleReturnItems??[]).reduce((sum,line)=>sum+(line.totalPrice==null?amount(line.price)*amount(line.quantity):amount(line.totalPrice)),0))}</b></span><span>{t("Net adjustment")}<b>{bdt(amount(selectedReturn.totalPrice)-(selectedReturn.saleReturnItems??[]).reduce((sum,line)=>sum+(line.totalPrice==null?amount(line.price)*amount(line.quantity):amount(line.totalPrice)),0))}</b></span><strong>{t("Saved return value")}<b>{bdt(amount(selectedReturn.totalPrice))}</b></strong></div>{selectedReturn.note&&<p className="purchase-detail-note">{selectedReturn.note}</p>}{selectedReturn.status==="pending"&&canUpdateReturn&&<div className="sales-detail-actions"><button className="purchase-save-pending" disabled={saving} onClick={()=>void updateReturnStatus(selectedReturn,"rejected")}>Reject</button><button className="sales-primary-action" disabled={saving} onClick={()=>void updateReturnStatus(selectedReturn,"completed")}>{saving?"Processing…":"Approve & process"}</button></div>}{error&&<p role="alert" className="pos-dialog-error">{error}</p>}<p className="purchase-register-note"><AlertCircle size={12}/> Existing due is reduced before any cash refund. Approval uses the original payment account.</p></div></div>}
  </section>;
}
