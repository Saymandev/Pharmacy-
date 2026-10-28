"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowUpRight, Check, CircleAlert, Clock3, FileText, Search, Wallet, X } from "lucide-react";
import { api, ApiClientError } from "@/lib/api/client";
import { useAuth } from "@/components/providers/auth-provider";
import { useActiveBranch } from "@/components/providers/active-branch-provider";

type Row = Record<string, unknown>;
type Account = { id: string; name: string; type: string; currentBalance?: number; isActive?: boolean };
type Charge = { id: string; branchId: string; doctorId: string; totalAmount: number; commissionPercentage: number; commissionAmount: number; isPaid: boolean; paidAt?: string | null; createdAt: string; doctor?: { id: string; fullName: string }; sale?: { invoiceNumber?: string; createdAt?: string }; appointment?: { serialNumber?: string } };
type Payment = { id: string; paymentNumber: string; totalAmount: number; paymentMethod: string; note?: string | null; createdAt: string; doctor?: { id: string; fullName: string }; account?: { id: string; name: string } };
type View = "unpaid" | "paid" | "payments";
const pageSize = 12;
const methods = ["cash", "card", "online", "cheque", "bKash", "Nagad", "Rocket", "Bank Transfer"];

function rows<T>(value: unknown): T[] { if (Array.isArray(value)) return value as T[]; if (value && typeof value === "object") { const record = value as Row; if ("data" in record) return rows<T>(record.data); for (const key of ["branches", "accounts", "charges", "payments"]) if (key in record) return rows<T>(record[key]); } return []; }
function num(value: unknown) { const result = Number(value); return Number.isFinite(result) ? result : 0; }
function money(value: number) { return new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT", maximumFractionDigits: 2 }).format(value || 0); }
function getError(error: unknown) { return error instanceof ApiClientError ? error.message : "Could not complete this finance request."; }

export function ConsultationWorkspace() {
  const { hasPermission } = useAuth();
  const { activeBranchId: branchId } = useActiveBranch();
  const [view, setView] = useState<View>("unpaid");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<Row | null>(null);
  const [payDialog, setPayDialog] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const canRead = hasPermission("consultation-charge:read");
  const canPay = hasPermission("transaction:update");

  useEffect(() => {
    let active = true;
    Promise.allSettled([api.get<unknown>("/finance/accounts?page=1&limit=100&isActive=true")]).then(([accountResult]) => {
      if (!active) return;
      if (accountResult.status === "fulfilled") { const options = rows<Account>(accountResult.value).filter((item) => item.isActive !== false); setAccounts(options); setAccountId(options[0]?.id ?? ""); }
    });
    return () => { active = false; };
  }, []);

  const load = useCallback(async (requestedPage: number, term: string) => {
    if (!canRead) { setLoading(false); return; }
    setLoading(true); setError(""); setSelectedIds([]);
    const params = new URLSearchParams({ page: String(requestedPage), limit: String(pageSize) });
    if (branchId) params.set("branchId", branchId);
    if (term.trim()) params.set("search", term.trim());
    try {
      const endpoint = view === "payments" ? "/finance/consultation-charges/payments" : "/finance/consultation-charges/charges";
      if (view !== "payments") params.set("isPaid", view === "paid" ? "true" : "false");
      const result = await api.getWithMeta<{ data: unknown; meta?: Row }>(`${endpoint}?${params}`);
      const meta = result.meta ?? {};
      if (view === "payments") { setPayments(rows<Payment>(result.data)); setCharges([]); }
      else { setCharges(rows<Charge>(result.data)); setPayments([]); }
      setTotal(num(meta.total)); setTotalPages(num(meta.totalPages) || 1); setPage(requestedPage);
    } catch (cause) { setError(getError(cause)); setCharges([]); setPayments([]); }
    finally { setLoading(false); }
  }, [branchId, canRead, view]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(1, query); }, 0); return () => window.clearTimeout(timer); }, [branchId, query, view, load]);
  const selectedCharges = useMemo(() => charges.filter((charge) => selectedIds.includes(charge.id)), [charges, selectedIds]);
  const selectedTotal = selectedCharges.reduce((sum, charge) => sum + num(charge.commissionAmount), 0);
  const doctors = [...new Set(charges.map((item) => item.doctor?.fullName).filter(Boolean))];

  function toggleCharge(charge: Charge, checked: boolean) {
    setSelectedIds((current) => checked ? [...current, charge.id] : current.filter((id) => id !== charge.id));
  }
  async function payCharges(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (!branchId || !selectedCharges.length || !accountId) { setError("Select at least one charge and a payment account."); return; }
    const doctorIds = [...new Set(selectedCharges.map((charge) => charge.doctorId))];
    const branchIds = [...new Set(selectedCharges.map((charge) => charge.branchId))];
    if (doctorIds.length !== 1 || branchIds.length !== 1) { setError("A grouped payment can include charges for only one doctor and one branch."); return; }
    setSaving(true);
    try {
      await api.post("/finance/consultation-charges/pay", { branchId: branchIds[0], doctorId: doctorIds[0], chargeIds: selectedIds, accountId, paymentMethod, ...(note.trim() ? { note: note.trim() } : {}) });
      setPayDialog(false); setNote(""); setSelectedIds([]); await load(1, query);
    } catch (cause) { setError(getError(cause)); }
    finally { setSaving(false); }
  }
  async function openPayment(id: string) {
    setLoading(true); setError("");
    try { const result = await api.get<unknown>(`/finance/consultation-charges/payments/${encodeURIComponent(id)}`); setSelectedPayment(result as Row); }
    catch (cause) { setError(getError(cause)); }
    finally { setLoading(false); }
  }

  if (!canRead) return <section className="consultation-page"><div className="page-heading-row"><div><p className="eyebrow">FINANCE · DOCTOR SETTLEMENTS</p><h1>Consultation charges</h1></div></div><div className="notice-card"><CircleAlert size={18}/><p>Your account needs <strong>consultation-charge:read</strong> to view doctor consultation charges.</p></div></section>;
  return <section className="consultation-page data-page">
    <div className="page-heading-row"><div><p className="eyebrow">FINANCE · DOCTOR SETTLEMENTS</p><h1>Consultation charges</h1><p className="page-subtitle">Review doctor commissions, settle selected unpaid charges and inspect payment vouchers.</p></div></div>
    <div className="consultation-summary"><article><i><Clock3 size={17}/></i><span><small>{view === "paid" ? "Paid charges" : view === "payments" ? "Payment vouchers" : "Charges in view"}</small><strong>{loading ? "—" : total.toLocaleString("en-BD")}</strong></span></article><article><i><Wallet size={17}/></i><span><small>Selected payable</small><strong>{money(selectedTotal)}</strong></span></article></div>
    <section className="panel consultation-card"><nav className="data-tabs consultation-tabs">{([["unpaid", "Unpaid charges"], ["paid", "Paid charges"], ["payments", "Payment history"]] as [View, string][]).map(([key, label]) => <button type="button" key={key} className={view === key ? "selected" : ""} onClick={() => { setView(key); setSelectedPayment(null); }}>{label}</button>)}</nav>
      <form className="consultation-toolbar" onSubmit={(event) => { event.preventDefault(); setQuery(search); }}><span><Search size={15}/><input aria-label="Search consultation records" placeholder="Search doctor, invoice or appointment" value={search} onChange={(event) => setSearch(event.target.value)}/></span><button type="submit">Search</button></form>
      {error && !payDialog && <div className="data-error"><CircleAlert size={15}/><span>{error}</span><button type="button" onClick={() => void load(page, query)}>Retry</button></div>}
      {view !== "payments" ? <><div className="consultation-table-wrap"><table className="consultation-table"><thead><tr>{view === "unpaid" && <th><span className="sr-only">Select charge</span></th>}<th>Doctor</th><th>Invoice / appointment</th><th>Consultation</th><th>Commission</th><th>Created</th>{view === "paid" && <th>Paid at</th>}</tr></thead><tbody>{charges.map((charge) => <tr key={charge.id}>{view === "unpaid" && <td><input aria-label={`Select charge for ${charge.doctor?.fullName || "doctor"}`} type="checkbox" checked={selectedIds.includes(charge.id)} onChange={(event) => toggleCharge(charge, event.target.checked)} /></td>}<td><strong>{charge.doctor?.fullName || "Doctor"}</strong></td><td><span>{charge.sale?.invoiceNumber || "—"}</span><small>{charge.appointment?.serialNumber ? `Appointment ${charge.appointment.serialNumber}` : "No appointment reference"}</small></td><td>{money(num(charge.totalAmount))}</td><td><strong>{money(num(charge.commissionAmount))}</strong><small>{num(charge.commissionPercentage)}% commission</small></td><td>{charge.createdAt ? new Date(charge.createdAt).toLocaleDateString("en-BD") : "—"}</td>{view === "paid" && <td>{charge.paidAt ? new Date(charge.paidAt).toLocaleString("en-BD") : "—"}</td>}</tr>)}</tbody></table>{!loading && charges.length === 0 && <div className="consultation-empty"><FileText size={21}/><strong>No {view === "paid" ? "paid" : "unpaid"} consultation charges</strong><span>Change the branch or search filters to see other records.</span></div>}{loading && <div className="consultation-empty">Loading consultation charges…</div>}</div>{view === "unpaid" && canPay && selectedIds.length > 0 && <div className="consultation-bulk-bar"><span><strong>{selectedIds.length}</strong> charge{selectedIds.length === 1 ? "" : "s"} selected · {doctors.length > 1 ? `${doctors.length} doctors (select a single doctor to pay)` : doctors[0] || "One doctor"}</span><button type="button" className="purchase-primary-action" disabled={doctors.length !== 1 || !accounts.length} onClick={() => { setError(""); setPayDialog(true); }}>{doctors.length === 1 ? <>Pay selected · {money(selectedTotal)} <ArrowUpRight size={14}/></> : "Select one doctor"}</button></div>}</> : <div className="consultation-table-wrap"><table className="consultation-table"><thead><tr><th>Voucher</th><th>Doctor</th><th>Account</th><th>Method</th><th>Amount</th><th>Date</th><th></th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id}><td><strong>{payment.paymentNumber}</strong></td><td>{payment.doctor?.fullName || "Doctor"}</td><td>{payment.account?.name || "—"}</td><td>{payment.paymentMethod}</td><td><strong>{money(num(payment.totalAmount))}</strong></td><td>{payment.createdAt ? new Date(payment.createdAt).toLocaleDateString("en-BD") : "—"}</td><td><button className="consultation-detail-button" type="button" onClick={() => void openPayment(payment.id)}>Details</button></td></tr>)}</tbody></table>{!loading && payments.length === 0 && <div className="consultation-empty"><FileText size={21}/><strong>No consultation payment vouchers</strong><span>Completed grouped settlements will appear here.</span></div>}{loading && <div className="consultation-empty">Loading payment history…</div>}</div>}
      <div className="consultation-pagination"><span>{total.toLocaleString("en-BD")} records · page {page} of {totalPages}</span><div><button type="button" disabled={loading || page <= 1} onClick={() => void load(page - 1, query)}>Previous</button><button type="button" disabled={loading || page >= totalPages} onClick={() => void load(page + 1, query)}>Next</button></div></div>
    </section>
    {payDialog && <div className="pos-dialog-backdrop" role="presentation" onClick={() => !saving && setPayDialog(false)}><section className="consultation-dialog" role="dialog" aria-modal="true" aria-labelledby="consultation-pay-title" onClick={(event) => event.stopPropagation()}><div className="consultation-dialog-head"><i><Wallet size={18}/></i><button type="button" className="pos-icon-action" onClick={() => setPayDialog(false)} aria-label="Close payment dialog"><X size={16}/></button></div><h2 id="consultation-pay-title">Pay doctor charges</h2><p>{selectedIds.length} unpaid charge{selectedIds.length === 1 ? "" : "s"} for {doctors[0]}.</p><div className="consultation-pay-total"><span>Settlement total</span><strong>{money(selectedTotal)}</strong></div><form onSubmit={(event) => void payCharges(event)}><label>Pay from account<select required value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="">Choose account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.type} {account.currentBalance !== undefined ? `· ${money(num(account.currentBalance))}` : ""}</option>)}</select></label><label>Payment method<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>{methods.map((method) => <option key={method}>{method}</option>)}</select></label><label>Note <small>Optional</small><textarea rows={2} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Voucher note"/></label>{error && <div className="pos-dialog-error" role="alert">{error}</div>}<button className="purchase-primary-action full" type="submit" disabled={saving || !accountId}>{saving ? "Processing settlement…" : <>Confirm payment <Check size={15}/></>}</button></form><p className="consultation-caution">The backend checks account balance and records one voucher plus a finance transaction.</p></section></div>}
    {selectedPayment && <div className="pos-dialog-backdrop" role="presentation" onClick={() => setSelectedPayment(null)}><section className="consultation-dialog consultation-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="consultation-detail-title" onClick={(event) => event.stopPropagation()}><div className="consultation-dialog-head"><i><FileText size={18}/></i><button type="button" className="pos-icon-action" onClick={() => setSelectedPayment(null)} aria-label="Close voucher details"><X size={16}/></button></div><p className="eyebrow">CONSULTATION SETTLEMENT</p><h2 id="consultation-detail-title">{String(selectedPayment.paymentNumber ?? "Payment voucher")}</h2><div className="consultation-detail-grid"><div><small>Doctor</small><strong>{String((selectedPayment.doctor as Row | undefined)?.fullName ?? "—")}</strong></div><div><small>Account</small><strong>{String((selectedPayment.account as Row | undefined)?.name ?? "—")}</strong></div><div><small>Amount</small><strong>{money(num(selectedPayment.totalAmount))}</strong></div><div><small>Method</small><strong>{String(selectedPayment.paymentMethod ?? "—")}</strong></div><div><small>Date</small><strong>{selectedPayment.createdAt ? new Date(String(selectedPayment.createdAt)).toLocaleString("en-BD") : "—"}</strong></div>{Boolean(selectedPayment.note) && <p className="consultation-voucher-note">{String(selectedPayment.note)}</p>}</div><h3>Included charges</h3><div className="consultation-voucher-charges">{rows<Charge & Row>(selectedPayment.charges).map((charge) => <div key={String(charge.id)}><span><strong>{String((charge.sale as Row | undefined)?.invoiceNumber ?? (charge.appointment as Row | undefined)?.serialNumber ?? "Consultation charge")}</strong><small>{charge.createdAt ? new Date(String(charge.createdAt)).toLocaleDateString("en-BD") : ""}</small></span><strong>{money(num(charge.commissionAmount))}</strong></div>)}</div></section></div>}
  </section>;
}
