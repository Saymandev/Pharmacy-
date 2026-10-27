"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowDownLeft, Check, ChevronRight, CircleAlert, ClipboardList, CreditCard, FileText, RotateCcw, Search, ShieldAlert, X } from "lucide-react";
import { api, ApiClientError } from "@/lib/api/client";
import { useAuth } from "@/components/providers/auth-provider";

type Data = Record<string, unknown>;
type Branch = { id: string; name: string };
type Account = { id: string; name: string; type: string };
type SaleLine = { id: string; medicineId?: string | null; serviceId?: string | null; itemName: string; itemDescription?: string | null; unit: string; price: number; mrp: number; quantity: number; discountPercentage?: number; discountAmount?: number; totalPrice?: number; batchNumber?: string | null; expiryDate?: string | null };
type Sale = { id: string; invoiceNumber: string; branchId: string; branch?: { id?: string; name: string }; customerId: string; customer?: { id?: string; name: string; phone?: string; customerNumber?: string }; type: string; status: string; paymentStatus: string; paymentMethod: string; totalPrice: number; netPrice: number; paidAmount: number; dueAmount: number; discountAmount: number; taxAmount: number; createdAt: string; createdBy?: string; note?: string; saleItems: SaleLine[] };
type SaleReturn = { id: string; saleId: string; sale?: { id: string; invoiceNumber: string }; invoiceNumber?: string; branchId: string; customer?: { name: string; phone?: string }; status: string; totalPrice: number; createdAt: string; note?: string; saleReturnItems: SaleLine[] };
type Mode = "sales" | "returns";
const methods = ["cash", "card", "online", "cheque", "bKash", "Nagad", "Rocket", "Bank Transfer"] as const;
function list<T>(value: unknown): T[] { if (Array.isArray(value)) return value as T[]; if (value && typeof value === "object") { const obj = value as Data; if ("data" in obj) return list<T>(obj.data); for (const key of ["sales", "returns", "data", "branches", "accounts", "saleReturnItems"]) if (key in obj) return list<T>(obj[key]); } return []; }
function amount(v: unknown) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function bdt(v: number) { return new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT", maximumFractionDigits: 2 }).format(v || 0); }
function err(error: unknown) { return error instanceof ApiClientError ? error.message : "Could not complete this request. Please try again."; }
function badge(status: string) { return status === "completed" || status === "paid" ? "good" : status === "partial" || status === "pending" ? "warn" : status === "due" ? "soon" : "danger"; }
function pagination(value: unknown) { let obj = value as Data | null; while (obj && typeof obj === "object") { if (obj.pagination && typeof obj.pagination === "object") return obj.pagination as { total: number; page: number; limit: number; totalPages: number }; if (obj.data && typeof obj.data === "object" && !Array.isArray(obj.data)) obj = obj.data as Data; else break; } return { total: 0, page: 1, limit: 20, totalPages: 1 }; }

export function SalesWorkspace({ mode }: { mode: Mode }) {
  const { hasPermission } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [branchId, setBranchId] = useState("");
  const [sales, setSales] = useState<Sale[]>([]);
  const [returns, setReturns] = useState<SaleReturn[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [method, setMethod] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageInfo, setPageInfo] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [selectedReturn, setSelectedReturn] = useState<SaleReturn | null>(null);
  const [paySale, setPaySale] = useState<Sale | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<(typeof methods)[number]>("cash");
  const [returnQuery, setReturnQuery] = useState("");
  const [returnCandidate, setReturnCandidate] = useState<Sale | null>(null);
  const [returnedQuantities, setReturnedQuantities] = useState<Record<string, number>>({});
  const [returnQty, setReturnQty] = useState<Record<string, number>>({});
  const [returnNote, setReturnNote] = useState("");
  const [returnStatus, setReturnStatus] = useState<"pending" | "completed">("pending");
  const [returnListSearch, setReturnListSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (branchId) params.set("branchId", branchId);
    if (search.trim()) params.set("search", search.trim());
    if (status) params.set("status", status);
    if (paymentStatus) params.set("paymentStatus", paymentStatus);
    if (method) params.set("paymentMethod", method);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (minAmount) params.set("minAmount", minAmount);
    if (maxAmount) params.set("maxAmount", maxAmount);
    const endpoint = mode === "sales" ? `/sales?${params.toString()}` : `/sales/returns?${new URLSearchParams({ page: String(page), limit: "20", ...(branchId ? { branchId } : {}), ...(returnListSearch.trim() ? { search: returnListSearch.trim() } : {}), ...(status ? { status } : {}) }).toString()}`;
    try {
      const result = await api.get<unknown>(endpoint);
      if (mode === "sales") setSales(list<Sale>(result)); else setReturns(list<SaleReturn>(result));
      setPageInfo(pagination(result)); setError("");
    } catch (cause) { setError(err(cause)); }
    finally { setLoading(false); }
  }, [branchId, endDate, method, minAmount, maxAmount, mode, page, paymentStatus, returnListSearch, search, startDate, status]);

  useEffect(() => {
    let live = true;
    async function loadOptions() {
      const [branchResult, accountResult] = await Promise.allSettled([api.get<unknown>("/branches?page=1&limit=100"), api.get<unknown>("/finance/accounts?page=1&limit=100&isActive=true")]);
      if (!live) return;
      if (branchResult.status === "fulfilled") { const rows = list<Branch>(branchResult.value); setBranches(rows); setBranchId(rows[0]?.id ?? ""); }
      if (accountResult.status === "fulfilled") { const rows = list<Account>(accountResult.value).filter((a) => ["cash", "bank", "mfs"].includes(a.type)); setAccounts(rows); setAccountId(rows.find((a) => a.type === "cash")?.id ?? rows[0]?.id ?? ""); }
    }
    void loadOptions();
    return () => { live = false; };
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 130); return () => window.clearTimeout(timer); }, [load]);

  const salesStats = useMemo(() => ({ count: pageInfo.total, paid: sales.filter((s) => s.paymentStatus === "paid").length, outstanding: sales.reduce((sum, s) => sum + amount(s.dueAmount), 0), total: sales.reduce((sum, s) => sum + amount(s.netPrice), 0) }), [pageInfo.total, sales]);
  async function openSale(sale: Sale) {
    setError("");
    try { const detail = await api.get<Sale>(`/sales/${sale.id}`); setSelectedSale(detail); }
    catch { setSelectedSale(sale); }
  }
  async function submitPayment() {
    if (!paySale || !accountId || amount(payAmount) <= 0 || amount(payAmount) > amount(paySale.dueAmount)) { setError("Payment amount must be above zero and no more than the outstanding due."); return; }
    setSaving(true); setError("");
    try { await api.post<unknown>(`/sales/${paySale.id}/payments`, { accountId, amount: amount(payAmount), paymentMethod }); setPaySale(null); setPayAmount(""); await load(); setNotice(`Payment added to ${paySale.invoiceNumber}.`); }
    catch (cause) { setError(err(cause)); }
    finally { setSaving(false); }
  }
  async function updatePendingSaleStatus(sale: Sale, next: "completed" | "rejected") {
    const message = next === "completed"
      ? "Complete this sale? This will deduct stock for POS items and update its cash register session."
      : "Reject this pending sale? This cannot be reversed from this screen.";
    if (!window.confirm(message)) return;
    setSaving(true); setError("");
    try { await api.patch<unknown>(`/sales/${sale.id}`, { status: next }); setSelectedSale(null); await load(); setNotice(next === "completed" ? `Sale ${sale.invoiceNumber} completed.` : `Sale ${sale.invoiceNumber} rejected.`); }
    catch (cause) { setError(err(cause)); }
    finally { setSaving(false); }
  }
  async function lookupReturnSale() {
    if (!returnQuery.trim()) return;
    setError(""); setSaving(true);
    try {
      const params = new URLSearchParams({ search: returnQuery.trim(), page: "1", limit: "10" });
      if (branchId) params.set("branchId", branchId);
      const found = await api.get<unknown>(`/sales?${params.toString()}`);
      const matches = list<Sale>(found);
      const exact = matches.find((sale) => sale.invoiceNumber.toLowerCase() === returnQuery.trim().toLowerCase());
      if (exact) await loadReturnCandidate(exact);
      else if (matches.length === 1) await loadReturnCandidate(matches[0]);
      else { setError(matches.length ? "More than one sale matched. Refine the invoice/customer search." : "No sale matched that invoice or customer."); }
    } catch (cause) { setError(err(cause)); }
    finally { setSaving(false); }
  }
  async function loadReturnCandidate(sale: Sale) {
    const detail = await api.get<Sale>(`/sales/${sale.id}`);
    setReturnCandidate(detail);
    setReturnQty(Object.fromEntries((detail.saleItems ?? []).map((item) => [item.id, 0])));
    const prior = await api.get<unknown>(`/sales/returns?saleId=${encodeURIComponent(sale.id)}&page=1&limit=100`);
    const returnRows = list<SaleReturn>(prior).filter((item) => item.status !== "rejected");
    const amounts: Record<string, number> = {};
    for (const row of returnRows) for (const line of row.saleReturnItems ?? []) {
      const key = `${line.medicineId || line.serviceId || line.itemName}|${line.batchNumber || ""}`;
      amounts[key] = (amounts[key] || 0) + amount(line.quantity);
    }
    setReturnedQuantities(amounts);
  }
  async function startReturn(sale: Sale) {
    setSelectedSale(null); setSaving(true); setError("");
    try { await loadReturnCandidate(sale); }
    catch (cause) { setError(err(cause)); }
    finally { setSaving(false); }
  }
  async function submitReturn() {
    if (!returnCandidate) return;
    const selected = (returnCandidate.saleItems ?? []).filter((item) => amount(returnQty[item.id]) > 0);
    if (!selected.length) { setError("Enter a return quantity for at least one sale line."); return; }
    const exceeds = selected.some((item) => {
      const key = `${item.medicineId || item.serviceId || item.itemName}|${item.batchNumber || ""}`;
      return amount(returnQty[item.id]) + amount(returnedQuantities[key]) > amount(item.quantity);
    });
    if (exceeds) { setError("Requested return is greater than the sold quantity remaining after previous requests."); return; }
    setSaving(true); setError("");
    try {
      await api.post<unknown>("/sales/returns", {
        saleId: returnCandidate.id, status: returnStatus, note: returnNote.trim() || undefined,
        saleReturnItems: selected.map((item) => ({ medicineId: item.medicineId, serviceId: item.serviceId, itemName: item.itemName, itemDescription: item.itemDescription || undefined, unit: item.unit, price: amount(item.price), mrp: amount(item.mrp), quantity: amount(returnQty[item.id]), batchNumber: item.batchNumber || undefined, expiryDate: item.expiryDate || undefined })),
      });
      setReturnCandidate(null); setReturnQuery(""); setReturnNote(""); setReturnQty({}); await load(); setNotice(returnStatus === "completed" ? "Return completed. Backend processed stock/refund actions." : "Return request saved for review.");
    } catch (cause) { setError(err(cause)); }
    finally { setSaving(false); }
  }
  async function updateReturnStatus(item: SaleReturn, next: "completed" | "rejected") {
    setSaving(true); setError("");
    try { await api.patch<unknown>(`/sales/returns/${item.id}/status`, { status: next }); setSelectedReturn(null); await load(); setNotice(next === "completed" ? "Return approved and processed." : "Return request rejected."); }
    catch (cause) { setError(err(cause)); }
    finally { setSaving(false); }
  }

  return <section className="sales-page">
    <div className="page-heading-row"><div><p className="eyebrow">PHARMACY · {mode === "sales" ? "TRANSACTIONS" : "RETURNS"}</p><h1>{mode === "sales" ? "Sales history" : "Sales returns"}</h1><p className="page-subtitle">{mode === "sales" ? "Review invoices, payments and customer balances." : "Review return requests against the original invoice and sold batches."}</p></div><label className="data-branch-select"><span>Branch</span><select value={branchId} onChange={(event) => { setBranchId(event.target.value); setPage(1); }}><option value="">All branches</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label></div>
    {(error || notice) && <div className={`sales-alert ${error ? "error" : "success"}`}>{error ? <CircleAlert size={15}/> : <Check size={15}/>}<span>{error || notice}</span><button onClick={() => { setError(""); setNotice(""); }} aria-label="Dismiss"><X size={14}/></button></div>}
    <nav className="data-tabs"><a href="/sales" className={mode === "sales" ? "selected" : ""}><ClipboardList size={15}/> Sales</a><a href="/returns" className={mode === "returns" ? "selected" : ""}><RotateCcw size={15}/> Returns</a></nav>
    {mode === "sales" ? <>
      <div className="sales-metrics"><div><span className="sales-metric-icon green"><FileText size={16}/></span><small>Invoices matched</small><strong>{loading ? "—" : salesStats.count}</strong></div><div><span className="sales-metric-icon blue"><CreditCard size={16}/></span><small>Paid this page</small><strong>{loading ? "—" : salesStats.paid}</strong></div><div><span className="sales-metric-icon amber"><ArrowDownLeft size={16}/></span><small>Due shown</small><strong>{loading ? "—" : bdt(salesStats.outstanding)}</strong></div><div><span className="sales-metric-icon slate"><FileText size={16}/></span><small>Sales value shown</small><strong>{loading ? "—" : bdt(salesStats.total)}</strong></div></div>
      <div className="sales-card panel"><div className="sales-toolbar"><div className="data-search"><Search size={16}/><input placeholder="Invoice, customer name, phone or number…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }}/></div><button className={`data-filter-button ${filtersOpen ? "selected" : ""}`} onClick={() => setFiltersOpen(!filtersOpen)}><Search size={14}/> Filters</button></div>
        {filtersOpen && <div className="sales-filter-drawer"><label>Status<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All</option><option value="completed">Completed</option><option value="pending">Pending</option><option value="rejected">Rejected</option></select></label><label>Payment<select value={paymentStatus} onChange={(event) => { setPaymentStatus(event.target.value); setPage(1); }}><option value="">All states</option><option value="paid">Paid</option><option value="partial">Partial</option><option value="due">Due</option></select></label><label>Method<select value={method} onChange={(event) => { setMethod(event.target.value); setPage(1); }}><option value="">All methods</option>{methods.map((m) => <option key={m}>{m}</option>)}</select></label><label>From<input type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); setPage(1); }}/></label><label>To<input type="date" value={endDate} onChange={(event) => { setEndDate(event.target.value); setPage(1); }}/></label><label>Min total<input inputMode="decimal" value={minAmount} onChange={(event) => { setMinAmount(event.target.value); setPage(1); }}/></label><label>Max total<input inputMode="decimal" value={maxAmount} onChange={(event) => { setMaxAmount(event.target.value); setPage(1); }}/></label><button onClick={() => { setStatus(""); setPaymentStatus(""); setMethod(""); setStartDate(""); setEndDate(""); setMinAmount(""); setMaxAmount(""); setPage(1); }}>Clear filters</button></div>}
        <div className="sales-table-head"><span>Invoice / customer</span><span>Date / branch</span><span>Total / paid</span><span>Payment</span><span>Status</span><span></span></div>
        {sales.map((sale) => <div className="sales-row" key={sale.id}><button className="sales-invoice" onClick={() => void openSale(sale)}><span className="sales-row-icon"><FileText size={15}/></span><span><strong>{sale.invoiceNumber}</strong><small>{sale.customer?.name || "Customer"} · {sale.customer?.phone || "No phone"}</small></span></button><div className="sales-date"><strong>{new Date(sale.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</strong><small>{sale.branch?.name || branches.find((branch) => branch.id === sale.branchId)?.name || "Branch"}</small></div><div className="sales-total"><strong>{bdt(amount(sale.netPrice))}</strong><small>{bdt(amount(sale.paidAmount))} paid · {bdt(amount(sale.dueAmount))} due</small></div><span className={`data-status ${badge(sale.paymentStatus)}`}>{sale.paymentStatus} · {sale.paymentMethod}</span><span className={`data-status ${badge(sale.status)}`}>{sale.status}</span><button className="data-row-action" onClick={() => void openSale(sale)} aria-label={`View invoice ${sale.invoiceNumber}`}><ChevronRight size={16}/></button></div>)}
        {!loading && sales.length === 0 && <div className="data-empty"><FileText size={22}/><strong>No sales found</strong><span>Change search or filter values and try again.</span></div>}{loading && <div className="data-loading">Loading sales…</div>}
        <div className="sales-pagination"><span>{pageInfo.total ? `${(page-1)*pageInfo.limit+1}–${Math.min(page*pageInfo.limit,pageInfo.total)} of ${pageInfo.total}` : "No records"}</span><div><button disabled={page <= 1 || loading} onClick={() => setPage(page-1)}>Previous</button><span>Page {page} of {Math.max(1,pageInfo.totalPages)}</span><button disabled={page >= pageInfo.totalPages || loading} onClick={() => setPage(page+1)}>Next</button></div></div>
      </div>
    </> : <>
      <div className="return-lookup panel"><div><span className="return-lookup-icon"><RotateCcw size={18}/></span><span><strong>Start from an original sale</strong><small>Search exact invoice number or customer name/phone.</small></span></div><div className="return-lookup-form"><div className="data-search"><Search size={16}/><input placeholder="Invoice number or customer…" value={returnQuery} onChange={(event) => setReturnQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void lookupReturnSale(); }}/></div><button className="sales-primary-action" disabled={saving} onClick={() => void lookupReturnSale()}>{saving ? "Searching…" : "Find sale"}</button></div></div>
      <div className="sales-card panel"><div className="sales-toolbar"><div className="data-search"><Search size={16}/><input placeholder="Filter return requests…" value={returnListSearch} onChange={(event) => { setReturnListSearch(event.target.value); setPage(1); }}/></div><select className="sales-compact-select" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All return states</option><option value="pending">Pending</option><option value="completed">Completed</option><option value="rejected">Rejected</option></select></div>
        <div className="sales-table-head return-table-head"><span>Invoice / customer</span><span>Requested</span><span>Items</span><span>Refund total</span><span>Status</span><span></span></div>
        {returns.map((item) => <div className="sales-row return-row" key={item.id}><button className="sales-invoice" onClick={() => setSelectedReturn(item)}><span className="sales-row-icon return-icon"><RotateCcw size={15}/></span><span><strong>{item.sale?.invoiceNumber || item.invoiceNumber || "Return request"}</strong><small>{item.customer?.name || "Customer"} · {item.customer?.phone || ""}</small></span></button><div className="sales-date"><strong>{new Date(item.createdAt).toLocaleDateString("en-GB")}</strong><small>{item.saleReturnItems?.length ?? 0} line(s)</small></div><span>{item.saleReturnItems?.reduce((sum,line)=>sum+amount(line.quantity),0) ?? 0} units</span><strong className="return-amount">{bdt(amount(item.totalPrice))}</strong><span className={`data-status ${badge(item.status)}`}>{item.status}</span><button className="data-row-action" onClick={() => setSelectedReturn(item)} aria-label="View return"><ChevronRight size={16}/></button></div>)}
        {!loading && returns.length === 0 && <div className="data-empty"><RotateCcw size={22}/><strong>No return requests</strong><span>Search an invoice above to start a return review.</span></div>}{loading && <div className="data-loading">Loading return requests…</div>}
        <div className="sales-pagination"><span>{pageInfo.total ? `${(page-1)*pageInfo.limit+1}–${Math.min(page*pageInfo.limit,pageInfo.total)} of ${pageInfo.total}` : "No records"}</span><div><button disabled={page<=1||loading} onClick={()=>setPage(page-1)}>Previous</button><span>Page {page} of {Math.max(1,pageInfo.totalPages)}</span><button disabled={page>=pageInfo.totalPages||loading} onClick={()=>setPage(page+1)}>Next</button></div></div>
      </div>
    </>}

    {selectedSale && <div className="sales-backdrop" role="presentation" onClick={() => setSelectedSale(null)}><div className="sales-detail-drawer" role="dialog" aria-modal="true" aria-label="Sale details" onClick={(event)=>event.stopPropagation()}><div className="sales-detail-head"><div><p className="eyebrow">INVOICE</p><h2>{selectedSale.invoiceNumber}</h2><p>{selectedSale.customer?.name} · {selectedSale.customer?.phone}</p></div><button className="purchase-close" onClick={()=>setSelectedSale(null)} aria-label="Close"><X size={18}/></button></div><div className="sales-detail-metrics"><span><small>Sale status</small><b className={`data-status ${badge(selectedSale.status)}`}>{selectedSale.status}</b></span><span><small>Payment</small><b className={`data-status ${badge(selectedSale.paymentStatus)}`}>{selectedSale.paymentStatus}</b></span><span><small>Net total</small><strong>{bdt(amount(selectedSale.netPrice))}</strong></span><span><small>Outstanding due</small><strong>{bdt(amount(selectedSale.dueAmount))}</strong></span></div><h3 className="sales-detail-title">Items · {selectedSale.saleItems?.length ?? 0}</h3>{selectedSale.saleItems?.map((item)=><div className="sales-detail-line" key={item.id}><span><strong>{item.itemName}</strong><small>{item.quantity} {item.unit} · Batch {item.batchNumber || "—"} · exp {item.expiryDate?new Date(item.expiryDate).toLocaleDateString("en-GB"):"—"}</small></span><b>{bdt(amount(item.totalPrice) || amount(item.price)*amount(item.quantity))}</b></div>)}<div className="sales-detail-totals"><span>Subtotal <b>{bdt(amount(selectedSale.totalPrice))}</b></span><span>Discount <b>−{bdt(amount(selectedSale.discountAmount))}</b></span><span>Tax <b>{bdt(amount(selectedSale.taxAmount))}</b></span><span>Paid <b>{bdt(amount(selectedSale.paidAmount))}</b></span><strong>Due <b>{bdt(amount(selectedSale.dueAmount))}</b></strong></div><div className="sales-detail-actions"><button className="purchase-save-pending" onClick={()=>void startReturn(selectedSale)}>Start return</button>{amount(selectedSale.dueAmount)>0&&<button className="sales-primary-action" onClick={()=>{setPaySale(selectedSale);setPayAmount("");setSelectedSale(null);}}>Collect due</button>}{selectedSale.status==="pending"&&hasPermission("sale:update")&&<><button className="purchase-save-pending" disabled={saving} onClick={()=>void updatePendingSaleStatus(selectedSale,"rejected")}>Reject sale</button><button className="sales-primary-action" disabled={saving} onClick={()=>void updatePendingSaleStatus(selectedSale,"completed")}>{saving?"Updating…":"Complete sale"}</button></>}</div></div></div>}
    {paySale && <div className="sales-backdrop" role="presentation" onClick={()=>setPaySale(null)}><div className="supplier-dialog panel" role="dialog" aria-modal="true" aria-label="Collect sale due" onClick={(event)=>event.stopPropagation()}><button className="purchase-close" onClick={()=>setPaySale(null)} aria-label="Close"><X size={18}/></button><span className="supplier-dialog-icon"><CreditCard size={18}/></span><h2>Collect outstanding due</h2><p>{paySale.invoiceNumber} · Remaining {bdt(amount(paySale.dueAmount))}</p><label>Amount<input type="number" min="0.01" max={paySale.dueAmount} value={payAmount} onChange={(event)=>setPayAmount(event.target.value)} placeholder="0.00"/></label><label>Account<select value={accountId} onChange={(event)=>setAccountId(event.target.value)}><option value="">Select account</option>{accounts.map((a)=><option key={a.id} value={a.id}>{a.name} · {a.type}</option>)}</select></label><label>Method<select value={paymentMethod} onChange={(event)=>setPaymentMethod(event.target.value as (typeof methods)[number])}>{methods.map((m)=><option key={m}>{m}</option>)}</select></label><button className="purchase-primary-action full" disabled={saving} onClick={()=>void submitPayment()}>{saving?"Saving…":"Record payment"}</button></div></div>}
    {returnCandidate && <div className="sales-backdrop" role="presentation" onClick={()=>setReturnCandidate(null)}><div className="sales-detail-drawer return-drawer" role="dialog" aria-modal="true" aria-label="Create sale return" onClick={(event)=>event.stopPropagation()}><div className="sales-detail-head"><div><p className="eyebrow">RETURN REVIEW · {returnCandidate.invoiceNumber}</p><h2>{returnCandidate.customer?.name || "Customer"}</h2><p>Set quantities within the sold remainder for each batch.</p></div><button className="purchase-close" onClick={()=>setReturnCandidate(null)} aria-label="Close"><X size={18}/></button></div><div className="return-warning"><ShieldAlert size={15}/><span>Backend does not enforce cumulative return quantity. This form caps each line using previous non-rejected requests; verify original goods before completion.</span></div><div className="return-lines">{returnCandidate.saleItems?.map((item)=>{const key=`${item.medicineId||item.serviceId||item.itemName}|${item.batchNumber||""}`;const remaining=Math.max(0,amount(item.quantity)-amount(returnedQuantities[key]));return <div className="return-line" key={item.id}><div><strong>{item.itemName}</strong><small>Sold {item.quantity} · already requested {returnedQuantities[key]||0} · available {remaining}</small><small>Batch {item.batchNumber||"—"} · expiry {item.expiryDate?new Date(item.expiryDate).toLocaleDateString("en-GB"):"—"}</small></div><label>Return qty<input type="number" min="0" max={remaining} value={returnQty[item.id]||0} onChange={(event)=>setReturnQty({...returnQty,[item.id]:Math.min(remaining,Math.max(0,Math.floor(amount(event.target.value))))})}/></label><b>{bdt(amount(item.price)*amount(returnQty[item.id]))}</b></div>;})}</div><label className="return-note-field">Reason / notes<textarea rows={3} value={returnNote} onChange={(event)=>setReturnNote(event.target.value)} placeholder="Record the reason and item condition"/></label><label className="return-status-field">Request state<select value={returnStatus} onChange={(event)=>setReturnStatus(event.target.value as "pending"|"completed")}><option value="pending">Pending review (recommended)</option><option value="completed">Complete now</option></select></label><div className="return-estimate"><span>Estimated refund</span><strong>{bdt((returnCandidate.saleItems??[]).reduce((sum,item)=>sum+amount(item.price)*amount(returnQty[item.id]),0))}</strong></div><button className="purchase-primary-action full" disabled={saving} onClick={()=>void submitReturn()}>{saving?"Saving…":returnStatus==="completed"?"Complete return":"Submit return request"}</button></div></div>}
    {selectedReturn && <div className="sales-backdrop" role="presentation" onClick={()=>setSelectedReturn(null)}><div className="sales-detail-drawer" role="dialog" aria-modal="true" aria-label="Return request details" onClick={(event)=>event.stopPropagation()}><div className="sales-detail-head"><div><p className="eyebrow">RETURN REQUEST · {selectedReturn.sale?.invoiceNumber||selectedReturn.invoiceNumber}</p><h2>{selectedReturn.customer?.name||"Customer"}</h2><p>{new Date(selectedReturn.createdAt).toLocaleString("en-GB")}</p></div><button className="purchase-close" onClick={()=>setSelectedReturn(null)} aria-label="Close"><X size={18}/></button></div><div className="sales-detail-metrics"><span><small>Status</small><b className={`data-status ${badge(selectedReturn.status)}`}>{selectedReturn.status}</b></span><span><small>Refund estimate</small><strong>{bdt(amount(selectedReturn.totalPrice))}</strong></span></div>{selectedReturn.saleReturnItems?.map((line)=><div className="sales-detail-line" key={line.id}><span><strong>{line.itemName}</strong><small>{line.quantity} {line.unit} · Batch {line.batchNumber}</small></span><b>{bdt(amount(line.totalPrice))}</b></div>)}{selectedReturn.note&&<p className="purchase-detail-note">{selectedReturn.note}</p>}{selectedReturn.status==="pending"&&<div className="sales-detail-actions"><button className="purchase-save-pending" disabled={saving} onClick={()=>void updateReturnStatus(selectedReturn,"rejected")}>Reject</button><button className="sales-primary-action" disabled={saving} onClick={()=>void updateReturnStatus(selectedReturn,"completed")}>{saving?"Processing…":"Approve & process"}</button></div>}<p className="purchase-register-note"><AlertCircle size={12}/> Completing a return can change inventory and account balances.</p></div></div>}
  </section>;
}
