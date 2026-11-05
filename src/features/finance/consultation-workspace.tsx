"use client";
import { DataSkeleton } from "@/components/ui/skeleton";
import { Select } from "@/components/ui/select";
import { useLanguage } from "@/lib/i18n/language-provider";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
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
function getError(error: unknown) { return error instanceof ApiClientError ? error.message : "Could not complete this finance request."; }

export function ConsultationWorkspace() {
 const {t,language}=useLanguage();
 const money=(value:number)=>new Intl.NumberFormat(language==="bn"?"bn-BD":"en-BD",{style:"currency",currency:"BDT",maximumFractionDigits:2}).format(value||0);
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
  const canPay = hasPermission("transaction:update") && hasPermission("account:read");
  const mutationLock=useRef(false),listRequest=useRef(0),detailRequest=useRef(0);

  useEffect(() => {
    let active = true;
    Promise.allSettled([canRead&&canPay?api.get<unknown>("/finance/accounts?page=1&limit=100&isActive=true"):Promise.resolve([])]).then(([accountResult]) => {
      if (!active) return;
      if (accountResult.status === "fulfilled") { const options = rows<Account>(accountResult.value).filter((item) => item.isActive !== false); setAccounts(options); setAccountId(options[0]?.id ?? ""); }
    });
    return () => { active = false; };
  }, [canRead,canPay]);

  const load = useCallback(async (requestedPage: number, term: string) => {
    const request=++listRequest.current;
    if (!canRead) { setLoading(false); return; }
    setLoading(true); setError(""); setSelectedIds([]);
    const params = new URLSearchParams({ page: String(requestedPage), limit: String(pageSize) });
    if (branchId) params.set("branchId", branchId);
    if (term.trim()) params.set("search", term.trim());
    try {
      const endpoint = view === "payments" ? "/finance/consultation-charges/payments" : "/finance/consultation-charges/charges";
      if (view !== "payments") params.set("isPaid", view === "paid" ? "true" : "false");
      const result = await api.getWithMeta<{ data: unknown; meta?: Row }>(`${endpoint}?${params}`);
      if(request!==listRequest.current)return;
      const meta = result.meta ?? {};
      if (view === "payments") { setPayments(rows<Payment>(result.data)); setCharges([]); }
      else { setCharges(rows<Charge>(result.data)); setPayments([]); }
      setTotal(num(meta.total)); setTotalPages(num(meta.totalPages) || 1); setPage(requestedPage);
    } catch (cause) { if(request===listRequest.current){setError(getError(cause)); setCharges([]); setPayments([]);} }
    finally { if(request===listRequest.current)setLoading(false); }
  }, [branchId, canRead, view]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(1, query); }, 0); return () => window.clearTimeout(timer); }, [branchId, query, view, load]);
  const selectedCharges = useMemo(() => charges.filter((charge) => selectedIds.includes(charge.id)), [charges, selectedIds]);
  const selectedTotal = selectedCharges.reduce((sum, charge) => sum + num(charge.commissionAmount), 0);
  const doctors = [...new Set(selectedCharges.map((item) => item.doctor?.fullName).filter(Boolean))];

  function toggleCharge(charge: Charge, checked: boolean) {
    setSelectedIds((current) => checked ? [...current, charge.id] : current.filter((id) => id !== charge.id));
  }
  async function payCharges(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();if(mutationLock.current||!canPay)return; setError("");
    if (!branchId || !selectedCharges.length || !accountId) { setError("Select at least one charge and a payment account."); return; }
    const doctorIds = [...new Set(selectedCharges.map((charge) => charge.doctorId))];
    const branchIds = [...new Set(selectedCharges.map((charge) => charge.branchId))];
    if (doctorIds.length !== 1 || branchIds.length !== 1) { setError("A grouped payment can include charges for only one doctor and one branch."); return; }
    if(branchIds[0]!==branchId||selectedCharges.some(charge=>charge.isPaid)||selectedCharges.length!==new Set(selectedIds).size){setError("Refresh and select unpaid charges in the active branch.");return;}
    mutationLock.current=true;setSaving(true);
    try {
      await api.post("/finance/consultation-charges/pay", { branchId: branchIds[0], doctorId: doctorIds[0], chargeIds: selectedIds, accountId, paymentMethod, ...(note.trim() ? { note: note.trim() } : {}) });
      setPayDialog(false); setNote(""); setSelectedIds([]); await load(1, query);
    } catch (cause) { setError(getError(cause)); }
    finally { mutationLock.current=false;setSaving(false); }
  }
  async function openPayment(id: string) {
    const request=++detailRequest.current;setLoading(true); setError("");
    try { const result = await api.get<unknown>(`/finance/consultation-charges/payments/${encodeURIComponent(id)}`); if(request===detailRequest.current)setSelectedPayment(result as Row); }
    catch (cause) { setError(getError(cause)); }
    finally { setLoading(false); }
  }

  if (!canRead) return <section className="consultation-page"><div className="page-heading-row"><div><p className="eyebrow">{t("FINANCE · DOCTOR SETTLEMENTS")}</p><h1>{t("Consultation charges")}</h1></div></div><div className="notice-card"><CircleAlert size={18}/><p>{t("Your account needs")} <strong>{t("consultation-charge:read")}</strong> {t("to view doctor consultation charges.")}</p></div></section>;
  return <section className="consultation-page data-page">
    <div className="page-heading-row"><div><p className="eyebrow">{t("FINANCE · DOCTOR SETTLEMENTS")}</p><h1>{t("Consultation charges")}</h1><p className="page-subtitle">{t("Review doctor commissions, settle selected unpaid charges and inspect payment vouchers.")}</p></div></div>
    <div className="consultation-summary"><article><i><Clock3 size={17}/></i><span><small>{view === "paid" ? t("Paid charges") : view === "payments" ? t("Payment vouchers") : t("Charges in view")}</small><strong>{loading ? "—" : total.toLocaleString(language==="bn"?"bn-BD":"en-BD")}</strong></span></article><article><i><Wallet size={17}/></i><span><small>{t("Selected payable")}</small><strong>{money(selectedTotal)}</strong></span></article></div>
    <section className="panel consultation-card"><nav className="data-tabs consultation-tabs">{([["unpaid", "Unpaid charges"], ["paid", "Paid charges"], ["payments", "Payment history"]] as [View, string][]).map(([key, label]) => <button disabled={saving} type="button" key={key} className={view === key ? "selected" : ""} onClick={() => { setView(key); setSelectedPayment(null); }}>{t(label)}</button>)}</nav>
      <form className="consultation-toolbar" onSubmit={(event) => { event.preventDefault(); setQuery(search); }}><span><Search size={15}/><input disabled={saving} aria-label={t("Search consultation records")} placeholder={t("Search doctor, invoice or appointment")} value={search} onChange={(event) => setSearch(event.target.value)}/></span><button disabled={saving} type="submit">{t("Search")}</button></form>
      {error && !payDialog && <div className="data-error"><CircleAlert size={15}/><span>{t(error)}</span><button disabled={saving} type="button" onClick={() => void load(page, query)}>{t("Retry")}</button></div>}
      {view !== "payments" ? <><div className="consultation-table-wrap"><table className="consultation-table"><thead><tr>{view === "unpaid" && <th><span className="sr-only">{t("Select charge")}</span></th>}<th>{t("Doctor")}</th><th>{t("Invoice / appointment")}</th><th>{t("Consultation")}</th><th>{t("Commission")}</th><th>{t("Created")}</th>{view === "paid" && <th>{t("Paid at")}</th>}</tr></thead><tbody>{charges.map((charge) => <tr key={charge.id}>{view === "unpaid" && <td><input disabled={saving} aria-label={t("Select charge for {name}",{name:charge.doctor?.fullName||t("Doctor")})} type="checkbox" checked={selectedIds.includes(charge.id)} onChange={(event) => toggleCharge(charge, event.target.checked)} /></td>}<td><strong>{charge.doctor?.fullName || t("Doctor")}</strong></td><td><span>{charge.sale?.invoiceNumber || "—"}</span><small>{charge.appointment?.serialNumber ? t("Appointment {number}",{number:charge.appointment.serialNumber}) : t("No appointment reference")}</small></td><td>{money(num(charge.totalAmount))}</td><td><strong>{money(num(charge.commissionAmount))}</strong><small>{num(charge.commissionPercentage)}{t("% commission")}</small></td><td>{charge.createdAt ? new Date(charge.createdAt).toLocaleDateString(language==="bn"?"bn-BD":"en-BD",{timeZone:"Asia/Dhaka"}) : "—"}</td>{view === "paid" && <td>{charge.paidAt ? new Date(charge.paidAt).toLocaleString(language==="bn"?"bn-BD":"en-BD",{timeZone:"Asia/Dhaka"}) : "—"}</td>}</tr>)}</tbody></table>{!loading && !error && charges.length === 0 && <div className="consultation-empty"><FileText size={21}/><strong>{t("No")} {view === "paid" ? t("paid") : t("unpaid")} {t("consultation charges")}</strong><span>{t("Change the branch or search filters to see other records.")}</span></div>}{loading && <DataSkeleton>{t("Loading consultation charges…")}</DataSkeleton>}</div>{view === "unpaid" && canPay && selectedIds.length > 0 && <div className="consultation-bulk-bar"><span><strong>{selectedIds.length}</strong> {t("charge")}{selectedIds.length === 1 ? "" : t("s")} {t("selected ·")} {doctors.length > 1 ? `${doctors.length} doctors (select a single doctor to pay)` : doctors[0] || t("One doctor")}</span><button type="button" className="purchase-primary-action" disabled={doctors.length !== 1 || !accounts.length} onClick={() => { setError(""); setPayDialog(true); }}>{doctors.length === 1 ? <>{t("Pay selected ·")} {money(selectedTotal)} <ArrowUpRight size={14}/></> : t("Select one doctor")}</button></div>}</> : <div className="consultation-table-wrap"><table className="consultation-table"><thead><tr><th>{t("Voucher")}</th><th>{t("Doctor")}</th><th>{t("Account")}</th><th>{t("Method")}</th><th>{t("Amount")}</th><th>{t("Date")}</th><th></th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id}><td><strong>{payment.paymentNumber}</strong></td><td>{payment.doctor?.fullName || t("Doctor")}</td><td>{payment.account?.name || "—"}</td><td>{t(payment.paymentMethod)}</td><td><strong>{money(num(payment.totalAmount))}</strong></td><td>{payment.createdAt ? new Date(payment.createdAt).toLocaleDateString(language==="bn"?"bn-BD":"en-BD",{timeZone:"Asia/Dhaka"}) : "—"}</td><td><button disabled={saving} className="consultation-detail-button" type="button" onClick={() => void openPayment(payment.id)}>{t("Details")}</button></td></tr>)}</tbody></table>{!loading && !error && payments.length === 0 && <div className="consultation-empty"><FileText size={21}/><strong>{t("No consultation payment vouchers")}</strong><span>{t("Completed grouped settlements will appear here.")}</span></div>}{loading && <DataSkeleton>{t("Loading payment history…")}</DataSkeleton>}</div>}
      <div className="consultation-pagination"><span>{total.toLocaleString(language==="bn"?"bn-BD":"en-BD")} {t("records · page")} {page} {t("of")} {totalPages}</span><div><button type="button" disabled={loading || page <= 1} onClick={() => void load(page - 1, query)}>{t("Previous")}</button><button type="button" disabled={loading || page >= totalPages} onClick={() => void load(page + 1, query)}>{t("Next")}</button></div></div>
    </section>
    {payDialog && <div className="pos-dialog-backdrop" role="presentation" onClick={() => !saving && setPayDialog(false)}><section className="consultation-dialog" role="dialog" aria-modal="true" aria-labelledby="consultation-pay-title" onClick={(event) => event.stopPropagation()}><div className="consultation-dialog-head"><i><Wallet size={18}/></i><button type="button" className="pos-icon-action" disabled={saving} onClick={() => !saving&&setPayDialog(false)} aria-label={t("Close payment dialog")}><X size={16}/></button></div><h2 id="consultation-pay-title">{t("Pay doctor charges")}</h2><p>{selectedIds.length} {t("unpaid charge")}{selectedIds.length === 1 ? "" : t("s")} {t("for")} {doctors[0]}.</p><div className="consultation-pay-total"><span>{t("Settlement total")}</span><strong>{money(selectedTotal)}</strong></div><form onSubmit={(event) => void payCharges(event)}><label>{t("Pay from account")}<Select disabled={saving} required value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="">{t("Choose account")}</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {t(account.type)} {account.currentBalance !== undefined ? `· ${money(num(account.currentBalance))}` : ""}</option>)}</Select></label><label>{t("Payment method")}<Select disabled={saving} value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>{methods.map((method) => <option key={method} value={method}>{t(method)}</option>)}</Select></label><label>{t("Note")} <small>{t("Optional")}</small><textarea disabled={saving} rows={2} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder={t("Voucher note")}/></label>{error && <div className="pos-dialog-error" role="alert">{t(error)}</div>}<button className="purchase-primary-action full" type="submit" disabled={saving || !accountId}>{saving ? t("Processing settlement…") : <>{t("Confirm payment")} <Check size={15}/></>}</button></form><p className="consultation-caution">{t("The backend checks account balance and records one voucher plus a finance transaction.")}</p></section></div>}
    {selectedPayment && <div className="pos-dialog-backdrop" role="presentation" onClick={() => {detailRequest.current++;setSelectedPayment(null);}}><section className="consultation-dialog consultation-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="consultation-detail-title" onClick={(event) => event.stopPropagation()}><div className="consultation-dialog-head"><i><FileText size={18}/></i><button disabled={saving} type="button" className="pos-icon-action" onClick={() => {detailRequest.current++;setSelectedPayment(null);}} aria-label={t("Close voucher details")}><X size={16}/></button></div><p className="eyebrow">{t("CONSULTATION SETTLEMENT")}</p><h2 id="consultation-detail-title">{String(selectedPayment.paymentNumber ?? "Payment voucher")}</h2><div className="consultation-detail-grid"><div><small>{t("Doctor")}</small><strong>{String((selectedPayment.doctor as Row | undefined)?.fullName ?? "—")}</strong></div><div><small>{t("Account")}</small><strong>{String((selectedPayment.account as Row | undefined)?.name ?? "—")}</strong></div><div><small>{t("Amount")}</small><strong>{money(num(selectedPayment.totalAmount))}</strong></div><div><small>{t("Method")}</small><strong>{t(String(selectedPayment.paymentMethod ?? "—"))}</strong></div><div><small>{t("Date")}</small><strong>{selectedPayment.createdAt ? new Date(String(selectedPayment.createdAt)).toLocaleString(language==="bn"?"bn-BD":"en-BD",{timeZone:"Asia/Dhaka"}) : "—"}</strong></div>{Boolean(selectedPayment.note) && <p className="consultation-voucher-note">{String(selectedPayment.note)}</p>}</div><h3>{t("Included charges")}</h3><div className="consultation-voucher-charges">{rows<Charge & Row>(selectedPayment.charges).map((charge) => <div key={String(charge.id)}><span><strong>{String((charge.sale as Row | undefined)?.invoiceNumber ?? (charge.appointment as Row | undefined)?.serialNumber ?? "Consultation charge")}</strong><small>{charge.createdAt ? new Date(String(charge.createdAt)).toLocaleDateString(language==="bn"?"bn-BD":"en-BD",{timeZone:"Asia/Dhaka"}) : ""}</small></span><strong>{money(num(charge.commissionAmount))}</strong></div>)}</div></section></div>}
  </section>;
}
